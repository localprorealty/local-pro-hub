import os
import sys
import time
import asyncio
import requests
from pathlib import Path
from datetime import datetime, timezone
from dotenv import load_dotenv

# Ensure we can import from backend root
sys.path.append(str(Path(__file__).resolve().parents[1]))

from config import get_settings
from supabase import create_client
from services.brokermint_sync import parse_cap_fields, resolve_sponsors, run_full_sync

BASE_URI = "https://my.brokermint.com/api"
DELAY_SECONDS = 0.3

def fetch_all_bm_users(api_key: str) -> list[dict]:
    """Fetch all users from BrokerMint list endpoint with full_info=1."""
    resp = requests.get(
        f"{BASE_URI}/v1/users",
        params={"api_key": api_key, "full_info": 1},
        timeout=60
    )
    resp.raise_for_status()
    data = resp.json()
    return data if isinstance(data, list) else data.get("users", data)

async def main_async():
    load_dotenv()
    settings = get_settings()
    url, service_key = settings.require_supabase()
    supabase = create_client(url, service_key)

    api_key = settings.brokermint_api_key
    if not api_key:
        print("ERROR: BROKERMINT_API_KEY is not set.")
        return

    # 1. Query surviving admin in public.users to act as approved_by
    admin_res = supabase.table("users").select("id").eq("role", "admin").eq("status", "active").limit(1).execute()
    if not admin_res.data:
        print("ERROR: No active admin found in public.users. Please create or approve at least one admin first.")
        return
    admin_id = admin_res.data[0]["id"]

    # 2. Fetch all users from BrokerMint
    print("Fetching all users from BrokerMint...")
    bm_users = fetch_all_bm_users(api_key)
    print(f"Loaded {len(bm_users)} users from BrokerMint.")

    success_count = 0
    failure_count = 0
    failed_ids = []

    print("\n=== STARTING BULK PROVISIONING ===")
    for idx, u in enumerate(bm_users, start=1):
        bm_id = u.get("id")
        email = (u.get("email") or "").strip().lower()
        first_name = u.get("first_name") or ""
        last_name = u.get("last_name") or ""
        full_name = f"{first_name} {last_name}".strip()
        active = u.get("active", True)
        phone = u.get("phone") or None
        license_number = u.get("License #") or None

        if not email or not bm_id:
            print(f"  [{idx}/{len(bm_users)}] Skipping user ID {bm_id} (missing email or ID).")
            continue

        print(f"  [{idx}/{len(bm_users)}] Processing {full_name} ({email})...")

        user_id = None
        created_new_auth = False

        # Try to create auth identity
        try:
            created = supabase.auth.admin.create_user({
                "email": email,
                "password": "localPro123!",
                "email_confirm": True,
                "user_metadata": {
                    "full_name": full_name,
                    "phone": phone or "",
                    "mls_id": license_number or "",
                    "brokermint_id": str(bm_id),
                    "requested_role": "agent"
                }
            })
            if created and created.user:
                user_id = created.user.id
                created_new_auth = True
        except Exception as e:
            err_msg = str(e).lower()
            if "already exists" in err_msg or "already registered" in err_msg or "conflict" in err_msg:
                # User already exists in Auth. Look up ID from public.users
                try:
                    res_exist = supabase.table("users").select("id").eq("email", email).execute()
                    if res_exist.data:
                        user_id = res_exist.data[0]["id"]
                except Exception as inner_e:
                    print(f"    Failed to query existing user in public.users: {inner_e}")
            else:
                print(f"    Auth creation failed for {email}: {e}")

        if not user_id:
            print(f"    FAILED: Could not establish a user ID for {email}")
            failure_count += 1
            failed_ids.append(bm_id)
            time.sleep(DELAY_SECONDS)
            continue

        # Map cap, split, and fee fields
        cap_fields = parse_cap_fields(u)

        # Update public.users row with BrokerMint state & active/suspended status
        try:
            # If we didn't just create a new auth user, the trigger might not have run or it exists
            # We use upsert or update. Since the profile row should exist, we do update.
            # Just in case the row doesn't exist in public.users, we can do upsert!
            profile_data = {
                "id": user_id,
                "email": email,
                "full_name": full_name,
                "phone": phone,
                "role": "agent",
                "status": "active" if active else "suspended",
                "approved_at": datetime.now(timezone.utc).isoformat() if active else None,
                "approved_by": admin_id,
                "brokermint_id": str(bm_id),
                "mls_id": license_number,
                "sponsor_raw": u.get("Sponsor"),
                "brokermint_synced_at": datetime.now(timezone.utc).isoformat(),
                **cap_fields
            }
            supabase.table("users").upsert(profile_data, on_conflict="id").execute()
            success_count += 1
            status_str = "active" if active else "suspended"
            print(f"    SUCCESS: Provisioned successfully (status: {status_str})")
        except Exception as e:
            print(f"    FAILED to update profile for {email}: {e}")
            failure_count += 1
            failed_ids.append(bm_id)

        time.sleep(DELAY_SECONDS)

    print(f"\n=== PROVISIONING SUMMARY ===")
    print(f"  - Successes: {success_count}")
    print(f"  - Failures: {failure_count}")
    if failed_ids:
        print(f"  - Failed BrokerMint IDs: {failed_ids}")

    # 3. Part 3: Wire up the follow-through
    print("\n=== STARTING FOLLOW-THROUGH SYNC PIPELINE ===")
    try:
        print("1. Running resolve_sponsors fresh...")
        await resolve_sponsors(supabase)
        print("   Sponsors resolved.")

        print("2. Running full BrokerMint sync (transactions, commissions, and revenue share calculations)...")
        sync_res = await run_full_sync(supabase)
        print("   Sync completed successfully.")
        print(f"   Agents synced: {sync_res.get('agents_synced')}")
        print(f"   Transactions synced: {sync_res.get('txns_synced')}")
        print(f"   Errors during sync: {len(sync_res.get('errors', []))}")
    except Exception as e:
        print(f"  ERROR during follow-through sync pipeline: {e}")

if __name__ == "__main__":
    asyncio.run(main_async())
