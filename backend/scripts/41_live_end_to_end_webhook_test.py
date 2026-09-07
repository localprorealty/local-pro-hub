import asyncio
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

# Add backend directory to path
sys.path.append(str(Path(__file__).resolve().parents[1]))

import httpx
from config import get_settings
from deps.auth import get_service_client
from routers.listings import transition_listing, TransitionRequest
from routers.brokermint import get_sync_health

BASE_URL = "https://my.brokermint.com/api"
AGENT_ID = "d2603037-0f9f-46bd-905e-4b9b9de3d35a"  # Andrew Wetzel
ADMIN_ID = "75abe437-e074-4e00-a5a9-5d650d91a6ba"

async def main():
    settings = get_settings()
    api_key = settings.brokermint_api_key
    if not api_key:
        print("ERROR: brokermint_api_key not found in settings")
        return

    supabase = get_service_client()

    print("======================================================================")
    print("STEP 5: REAL END-TO-END BROKERMINT WEBHOOK VERIFICATION")
    print("======================================================================")

    # ------------------------------------------------------------------
    # PART 1: Real transaction.created Webhook Test
    # ------------------------------------------------------------------
    print("\n--- 1. Creating Real Test Listing 1 in LocalPRO Hub ---")
    listing_1_payload = {
        "agent_id": AGENT_ID,
        "listing_type": "lease",
        "stage": "draft",
        "address_full": "901 Real Webhook Way, Dallas, TX 75248",
        "form_data": {
            "sellers": [
                {
                    "name": "Real Webhook Seller",
                    "email": "real-webhook@example.com",
                    "phone": "2145550101",
                }
            ],
            "street_number": "901",
            "street_name": "Real Webhook Way",
            "city": "Dallas",
            "state": "TX",
            "zip_code": "75248",
            "list_price": 3100.0,
            "list_date": "2026-07-22",
            "expire_date": "2026-12-31",
        },
    }
    res1 = supabase.table("listings").insert(listing_1_payload).execute()
    listing_1_id = res1.data[0]["id"]
    print(f"Created Listing 1 ID: {listing_1_id}")

    bm_txn_1_id = None
    contact_1_id = None

    try:
        print("\n--- Transitioning Listing 1 to 'docs_pending' (Calls BrokerMint API) ---")
        t_creation_start = datetime.now(timezone.utc)
        print(f"Transaction creation started at: {t_creation_start.isoformat()}")

        req = TransitionRequest(stage="docs_pending")
        trans_res = await transition_listing(listing_id=listing_1_id, req=req, agent_id=AGENT_ID)
        t_creation_end = datetime.now(timezone.utc)
        print(f"Transaction creation completed at: {t_creation_end.isoformat()}")

        bm_txn_1_id = trans_res.get("brokermint_transaction_id")
        print(f"★ Real BrokerMint Transaction 1 ID: {bm_txn_1_id}")

        # Extract created contact ID for cleanup
        updated_listing_1 = supabase.table("listings").select("form_data").eq("id", listing_1_id).single().execute()
        sellers = (updated_listing_1.data or {}).get("form_data", {}).get("sellers", [])
        if sellers and sellers[0].get("brokermint_contact_id"):
            contact_1_id = sellers[0]["brokermint_contact_id"]
            print(f"★ Created BrokerMint Contact 1 ID: {contact_1_id}")

        print(f"\n--- Waiting for Real Webhook to Arrive at Railway Endpoint for Txn {bm_txn_1_id} ---")
        webhook_1_event = None
        for attempt in range(1, 21):
            await asyncio.sleep(2)
            log_res = (
                supabase.table("bm_webhook_events_log")
                .select("*")
                .eq("transaction_id", str(bm_txn_1_id))
                .order("received_at", desc=True)
                .execute()
            )
            if log_res.data:
                webhook_1_event = log_res.data[0]
                print(f"✓ Webhook event detected after ~{attempt * 2}s!")
                break
            print(f"  Attempt {attempt}/20: Waiting for webhook delivery...")

        if not webhook_1_event:
            print("❌ TIMEOUT: Webhook event did not arrive in bm_webhook_events_log within 40 seconds.")
        else:
            print("\nReal Webhook Event Received in bm_webhook_events_log:")
            print(json.dumps(webhook_1_event, indent=2, default=str))

            received_dt = datetime.fromisoformat(webhook_1_event["received_at"])
            time_gap = (received_dt - t_creation_end).total_seconds()
            print(f"\n★ TIME GAP between BrokerMint creation and webhook receipt: {time_gap:.2f} seconds!")

            # Verify bm_transactions was synced synchronously
            print(f"\nVerifying bm_transactions sync for bm_id {bm_txn_1_id}...")
            txn_sync = supabase.table("bm_transactions").select("*").eq("bm_id", str(bm_txn_1_id)).execute()
            if txn_sync.data:
                print("✓ bm_transactions row exists and was synced via webhook:")
                row = txn_sync.data[0]
                print(f"  ID: {row.get('id')}")
                print(f"  bm_id: {row.get('bm_id')}")
                print(f"  Address: {row.get('address')}, {row.get('city')}, {row.get('state')} {row.get('zip')}")
                print(f"  Price: {row.get('price')}")
                print(f"  Status: {row.get('status')}")
                print(f"  Deleted At: {row.get('deleted_at')}")
            else:
                print("❌ ERROR: bm_transactions row not found.")

        # ------------------------------------------------------------------
        # PART 2: Real transaction.deleted Soft-Delete Test
        # ------------------------------------------------------------------
        print("\n======================================================================")
        print("--- 2. Creating Real Test Listing 2 for Deletion Test ---")
        listing_2_payload = {
            "agent_id": AGENT_ID,
            "listing_type": "lease",
            "stage": "draft",
            "address_full": "902 Delete Webhook Way, Dallas, TX 75248",
            "form_data": {
                "sellers": [
                    {
                        "name": "Delete Webhook Seller",
                        "email": "del-webhook@example.com",
                        "phone": "2145550102",
                    }
                ],
                "street_number": "902",
                "street_name": "Delete Webhook Way",
                "city": "Dallas",
                "state": "TX",
                "zip_code": "75248",
                "list_price": 3200.0,
                "list_date": "2026-07-22",
                "expire_date": "2026-12-31",
            },
        }
        res2 = supabase.table("listings").insert(listing_2_payload).execute()
        listing_2_id = res2.data[0]["id"]
        print(f"Created Listing 2 ID: {listing_2_id}")

        bm_txn_2_id = None
        contact_2_id = None

        req2 = TransitionRequest(stage="docs_pending")
        trans_res2 = await transition_listing(listing_id=listing_2_id, req=req2, agent_id=AGENT_ID)
        bm_txn_2_id = trans_res2.get("brokermint_transaction_id")
        print(f"★ Real BrokerMint Transaction 2 ID: {bm_txn_2_id}")

        updated_listing_2 = supabase.table("listings").select("form_data").eq("id", listing_2_id).single().execute()
        sellers2 = (updated_listing_2.data or {}).get("form_data", {}).get("sellers", [])
        if sellers2 and sellers2[0].get("brokermint_contact_id"):
            contact_2_id = sellers2[0]["brokermint_contact_id"]
            print(f"★ Created BrokerMint Contact 2 ID: {contact_2_id}")

        # Wait for initial webhook creation sync
        print("Waiting 6 seconds for initial creation sync to settle...")
        await asyncio.sleep(6)

        # Confirm it exists in bm_transactions before deletion
        pre_del = supabase.table("bm_transactions").select("bm_id, status, deleted_at").eq("bm_id", str(bm_txn_2_id)).execute()
        print(f"Pre-deletion bm_transactions state: {pre_del.data}")

        # Now Delete the transaction in BrokerMint
        print(f"\nDeleting Transaction {bm_txn_2_id} in BrokerMint via DELETE /v1/transactions/{bm_txn_2_id}...")
        async with httpx.AsyncClient(timeout=30) as client:
            del_resp = await client.delete(
                f"{BASE_URL}/v1/transactions/{bm_txn_2_id}",
                params={"api_key": api_key},
            )
            print(f"DELETE Transaction Status: {del_resp.status_code}")
            print(f"DELETE Transaction Body: {del_resp.text}")

        t_del = datetime.now(timezone.utc)

        # Wait for transaction.deleted webhook
        print("\nWaiting for transaction.deleted webhook to arrive...")
        webhook_del_event = None
        for attempt in range(1, 21):
            await asyncio.sleep(2)
            log_res = (
                supabase.table("bm_webhook_events_log")
                .select("*")
                .eq("transaction_id", str(bm_txn_2_id))
                .eq("event_type", "transaction.deleted")
                .execute()
            )
            if log_res.data:
                webhook_del_event = log_res.data[0]
                print(f"✓ transaction.deleted webhook detected after ~{attempt * 2}s!")
                break
            print(f"  Attempt {attempt}/20: Waiting for transaction.deleted webhook...")

        if not webhook_del_event:
            print("❌ TIMEOUT: transaction.deleted webhook did not arrive.")
        else:
            print("\nReal Webhook Event in bm_webhook_events_log:")
            print(json.dumps(webhook_del_event, indent=2, default=str))

            # Verify soft-delete in bm_transactions
            post_del = supabase.table("bm_transactions").select("bm_id, status, deleted_at").eq("bm_id", str(bm_txn_2_id)).execute()
            print("\nPost-deletion bm_transactions state:")
            print(json.dumps(post_del.data, indent=2, default=str))

        # ------------------------------------------------------------------
        # PART 3: Step 6 — Confirm Sync Health Reflects Reality
        # ------------------------------------------------------------------
        print("\n======================================================================")
        print("STEP 6: CONFIRM SYNC HEALTH REFLECTS REALITY")
        print("======================================================================")
        health = await get_sync_health(_admin_id=ADMIN_ID)
        print("GET /brokermint/sync-health Response:")
        print(json.dumps(health, indent=2, default=str))

    finally:
        # ------------------------------------------------------------------
        # CLEANUP
        # ------------------------------------------------------------------
        print("\n======================================================================")
        print("CLEANUP: DELETING TEST ASSETS")
        print("======================================================================")
        async with httpx.AsyncClient(timeout=30) as client:
            # Delete Txn 1 in BrokerMint if not deleted
            if bm_txn_1_id:
                print(f"Deleting BM Transaction 1 ({bm_txn_1_id})...")
                r = await client.delete(f"{BASE_URL}/v1/transactions/{bm_txn_1_id}", params={"api_key": api_key})
                print(f"  DELETE /v1/transactions/{bm_txn_1_id} -> {r.status_code}")

            # Delete Contact 1
            if contact_1_id:
                print(f"Deleting BM Contact 1 ({contact_1_id})...")
                r = await client.delete(f"{BASE_URL}/v1/contacts/{contact_1_id}", params={"api_key": api_key})
                print(f"  DELETE /v1/contacts/{contact_1_id} -> {r.status_code}")

            # Delete Contact 2
            if contact_2_id:
                print(f"Deleting BM Contact 2 ({contact_2_id})...")
                r = await client.delete(f"{BASE_URL}/v1/contacts/{contact_2_id}", params={"api_key": api_key})
                print(f"  DELETE /v1/contacts/{contact_2_id} -> {r.status_code}")

            # Verify 404s in BrokerMint for both transactions
            print("\nConfirming 404s for both transactions from BrokerMint...")
            if bm_txn_1_id:
                c1 = await client.get(f"{BASE_URL}/v1/transactions/{bm_txn_1_id}", params={"api_key": api_key})
                print(f"  GET /v1/transactions/{bm_txn_1_id} -> {c1.status_code} (Expect 404: {c1.status_code == 404})")
            if bm_txn_2_id:
                c2 = await client.get(f"{BASE_URL}/v1/transactions/{bm_txn_2_id}", params={"api_key": api_key})
                print(f"  GET /v1/transactions/{bm_txn_2_id} -> {c2.status_code} (Expect 404: {c2.status_code == 404})")

        # Delete Supabase listings
        print("\nDeleting temporary listings and bm_transactions rows in Supabase...")
        if listing_1_id:
            supabase.table("listings").delete().eq("id", listing_1_id).execute()
            print(f"  Deleted listing {listing_1_id}")
        if listing_2_id:
            supabase.table("listings").delete().eq("id", listing_2_id).execute()
            print(f"  Deleted listing {listing_2_id}")

        if bm_txn_1_id:
            supabase.table("bm_transactions").delete().eq("bm_id", str(bm_txn_1_id)).execute()
        if bm_txn_2_id:
            supabase.table("bm_transactions").delete().eq("bm_id", str(bm_txn_2_id)).execute()

        print("\n✓ CLEANUP COMPLETED!")

if __name__ == "__main__":
    asyncio.run(main())
