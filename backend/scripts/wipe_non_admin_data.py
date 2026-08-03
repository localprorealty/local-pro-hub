import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Ensure we can import from backend root
sys.path.append(str(Path(__file__).resolve().parents[1]))

from config import get_settings
from supabase import create_client

def main():
    load_dotenv()
    settings = get_settings()
    url, service_key = settings.require_supabase()
    supabase = create_client(url, service_key)

    # 1. Fetch all users from public.users
    res_users = supabase.table("users").select("id, email, role, full_name").execute()
    all_users = res_users.data or []

    admins = [u for u in all_users if u.get("role") == "admin"]
    non_admins = [u for u in all_users if u.get("role") != "admin"]

    if not admins:
        print("ERROR: No admin users found in the database. Aborting to prevent full lock-out.")
        return

    print("=== SURVIVING ADMINS ===")
    for adm in admins:
        print(f"  - {adm.get('email')} ({adm.get('full_name')})")

    print(f"\nFound {len(non_admins)} non-admin users to delete.")
    if not non_admins:
        print("No non-admin users found. Nothing to wipe.")
        return

    non_admin_ids = [u["id"] for u in non_admins]
    non_admin_emails = [u["email"] for u in non_admins]

    # Show count of items to delete in other tables
    print("\n=== SCANNING DEPENDENT TABLES ===")
    
    # helper to print count
    def get_count(table: str, col: str, ids: list) -> int:
        count = 0
        for i in range(0, len(ids), 100):
            chunk = ids[i:i+100]
            res = supabase.table(table).select(col, count="exact").in_(col, chunk).execute()
            if res.count is not None:
                count += res.count
        return count

    listings_count = get_count("listings", "agent_id", non_admin_ids)
    bookings_count = get_count("bookings", "photographer_id", non_admin_ids)
    milestones_count = get_count("agent_milestones", "user_id", non_admin_ids)
    email_log_count = get_count("milestone_email_log", "user_id", non_admin_ids)
    comms_count = get_count("bm_commissions", "user_id", non_admin_ids)
    earnings_count = get_count("revenue_share_earnings", "recipient_user_id", non_admin_ids)
    bonuses_count = get_count("revenue_share_completion_bonuses", "recipient_user_id", non_admin_ids)
    payments_count = get_count("revenue_share_payments", "recipient_user_id", non_admin_ids)
    overrides_count = get_count("agent_overrides", "user_id", non_admin_ids)
    logs_count = get_count("sponsor_resolution_log", "user_id", non_admin_ids)

    print(f"  - listings to delete: {listings_count}")
    print(f"  - bookings to delete: {bookings_count}")
    print(f"  - agent_milestones to delete: {milestones_count}")
    print(f"  - milestone_email_log to delete: {email_log_count}")
    print(f"  - bm_commissions to delete: {comms_count}")
    print(f"  - revenue_share_earnings to delete: {earnings_count}")
    print(f"  - revenue_share_completion_bonuses to delete: {bonuses_count}")
    print(f"  - revenue_share_payments to delete: {payments_count}")
    print(f"  - agent_overrides to delete: {overrides_count}")
    print(f"  - sponsor_resolution_log to delete: {logs_count}")

    # Prompt user for typed confirmation
    print("\n" + "!" * 50)
    print("WARNING: This will permanently delete all the non-admin records listed above.")
    print("!" * 50)
    confirm = input("Type 'yes wipe everything' to proceed: ")
    if confirm.strip() != "yes wipe everything":
        print("Wipe operation aborted by user.")
        return

    print("\n=== STARTING WIPE OPERATION ===")

    # Helper function to chunk delete
    def chunk_delete(table: str, col: str, ids: list):
        total = 0
        for i in range(0, len(ids), 100):
            chunk = ids[i:i+100]
            res = supabase.table(table).delete().in_(col, chunk).execute()
            if res.data:
                total += len(res.data)
        print(f"  Deleted {total} rows from {table}")

    # 1. Clear self-references in users & overrides first
    print("Clearing self-references...")
    for i in range(0, len(non_admin_ids), 100):
        chunk = non_admin_ids[i:i+100]
        supabase.table("users").update({"sponsor_id": None}).in_("sponsor_id", chunk).execute()
        supabase.table("agent_overrides").update({"sponsor_override": None}).in_("sponsor_override", chunk).execute()

    # 2. Delete contributions & payments
    print("Deleting revenue share data...")
    # Contributions cascade on payment/earning/bonus delete, but let's delete them directly first
    for i in range(0, len(non_admin_ids), 100):
        chunk = non_admin_ids[i:i+100]
        
        # Get earning IDs for these users
        earnings = supabase.table("revenue_share_earnings").select("id").in_("recipient_user_id", chunk).execute().data or []
        earning_ids = [e["id"] for e in earnings]
        if earning_ids:
            supabase.table("revenue_share_payment_contributions").delete().in_("earning_id", earning_ids).execute()
            
        # Get bonus IDs for these users
        bonuses = supabase.table("revenue_share_completion_bonuses").select("id").in_("recipient_user_id", chunk).execute().data or []
        bonus_ids = [b["id"] for b in bonuses]
        if bonus_ids:
            supabase.table("revenue_share_payment_contributions").delete().in_("bonus_id", bonus_ids).execute()

    chunk_delete("revenue_share_payments", "recipient_user_id", non_admin_ids)
    chunk_delete("revenue_share_earnings", "recipient_user_id", non_admin_ids)
    chunk_delete("revenue_share_earnings", "contributing_user_id", non_admin_ids)
    chunk_delete("revenue_share_completion_bonuses", "recipient_user_id", non_admin_ids)
    chunk_delete("revenue_share_completion_bonuses", "contributing_user_id", non_admin_ids)

    # 3. Delete overrides & resolution logs
    print("Deleting overrides and resolution logs...")
    chunk_delete("agent_overrides", "user_id", non_admin_ids)
    chunk_delete("sponsor_resolution_log", "user_id", non_admin_ids)

    # 4. Delete milestones & email logs
    print("Deleting milestones & email logs...")
    chunk_delete("milestone_email_log", "user_id", non_admin_ids)
    chunk_delete("agent_milestones", "user_id", non_admin_ids)

    # 5. Delete BrokerMint sync details
    print("Deleting BrokerMint sync details...")
    # Fetch transaction IDs from commissions of non-admins to delete transactions
    all_comms = []
    for i in range(0, len(non_admin_ids), 100):
        chunk = non_admin_ids[i:i+100]
        res = supabase.table("bm_commissions").select("transaction_id").in_("user_id", chunk).execute()
        if res.data:
            all_comms.extend(res.data)
            
    tx_ids = list(set([c["transaction_id"] for c in all_comms if c.get("transaction_id")]))
    
    # Delete commissions first
    chunk_delete("bm_commissions", "user_id", non_admin_ids)
    
    # Delete transactions
    if tx_ids:
        tx_deleted = 0
        for i in range(0, len(tx_ids), 100):
            chunk = tx_ids[i:i+100]
            res = supabase.table("bm_transactions").delete().in_("id", chunk).execute()
            if res.data:
                tx_deleted += len(res.data)
        print(f"  Deleted {tx_deleted} rows from bm_transactions")

    # 6. Delete bookings, listings, photographers & marketing members
    print("Deleting listings and bookings...")
    chunk_delete("bookings", "photographer_id", non_admin_ids)
    chunk_delete("listings", "agent_id", non_admin_ids)
    chunk_delete("photographers", "id", non_admin_ids)
    chunk_delete("marketing_team_members", "user_id", non_admin_ids)

    # 7. Delete Supabase Auth identities (this cascades to public.users profile row)
    print("\nDeleting Supabase Auth identities...")
    auth_deleted = 0
    auth_failed = []
    for uid in non_admin_ids:
        try:
            supabase.auth.admin.delete_user(uid)
            auth_deleted += 1
        except Exception as e:
            auth_failed.append(uid)
            print(f"  Failed to delete auth user {uid}: {e}")

    print(f"  Successfully deleted {auth_deleted} Supabase Auth users.")
    if auth_failed:
        print(f"  Warning: failed to delete {len(auth_failed)} auth users: {auth_failed}")

    # 8. Clean up any orphaned profile rows (just in case cascade failed)
    print("Cleaning up public.users records...")
    chunk_delete("users", "id", non_admin_ids)

    print("\n=== WIPE OPERATION COMPLETED SUCCESSFULLY ===")
    
    # Re-fetch users to print final admin verification
    res_final = supabase.table("users").select("email, role").execute()
    final_users = res_final.data or []
    print(f"Surviving users in public.users: {len(final_users)}")
    for u in final_users:
        print(f"  - {u.get('email')} (role: {u.get('role')})")

if __name__ == "__main__":
    main()
