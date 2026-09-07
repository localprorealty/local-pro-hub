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
from routers.brokermint import get_sync_health

BASE_URL = "https://my.brokermint.com/api"
ADMIN_ID = "75abe437-e074-4e00-a5a9-5d650d91a6ba"

TXN_1_ID = 4809319
TXN_2_ID = 4809320
CONTACT_1_ID = 22431297
CONTACT_2_ID = 22431298

async def main():
    settings = get_settings()
    api_key = settings.brokermint_api_key
    if not api_key:
        print("ERROR: brokermint_api_key not found in settings")
        return

    supabase = get_service_client()

    print("======================================================================")
    print("STEP 5 RE-RUN: REAL BROKERMINT WEBHOOK VERIFICATION WITH FIX")
    print("======================================================================")

    async with httpx.AsyncClient(timeout=30) as client:
        # ------------------------------------------------------------------
        # TEST 1: REAL TRANSACTION.UPDATED EVENT ON TXN 4809319
        # ------------------------------------------------------------------
        print(f"\n--- 1. Making Real Update to Transaction {TXN_1_ID} in BrokerMint ---")
        new_price = 3333.0
        update_payload = {
            "price": new_price,
            "sales_volume": new_price,
        }
        t_update_start = datetime.now(timezone.utc)
        print(f"Sending PUT /v1/transactions/{TXN_1_ID} with price={new_price} at {t_update_start.isoformat()}...")
        
        # In BrokerMint, PUT /v1/transactions/{id} updates fields
        put_resp = await client.put(
            f"{BASE_URL}/v1/transactions/{TXN_1_ID}",
            params={"api_key": api_key},
            json=update_payload,
        )
        print(f"PUT Status: {put_resp.status_code}")
        print(f"PUT Body: {put_resp.text}")

        print(f"\nWaiting for real transaction.updated webhook to arrive for Txn {TXN_1_ID}...")
        updated_event = None
        for attempt in range(1, 21):
            await asyncio.sleep(2)
            log_res = (
                supabase.table("bm_webhook_events_log")
                .select("*")
                .eq("transaction_id", str(TXN_1_ID))
                .eq("event_type", "transaction.updated")
                .order("received_at", desc=True)
                .execute()
            )
            if log_res.data:
                updated_event = log_res.data[0]
                print(f"✓ Real transaction.updated event detected after ~{attempt * 2}s!")
                break
            print(f"  Attempt {attempt}/20: Waiting for webhook...")

        if not updated_event:
            print("❌ TIMEOUT waiting for transaction.updated event.")
        else:
            print("\nReal Webhook Event in bm_webhook_events_log:")
            print(json.dumps(updated_event, indent=2, default=str))

            # Verify bm_transactions was synced synchronously
            print(f"\nChecking bm_transactions table for bm_id {TXN_1_ID}...")
            txn_sync = supabase.table("bm_transactions").select("*").eq("bm_id", str(TXN_1_ID)).execute()
            if txn_sync.data:
                row = txn_sync.data[0]
                print("✓ Real bm_transactions row confirmed:")
                print(f"  bm_id: {row.get('bm_id')}")
                print(f"  Address: {row.get('address')}")
                print(f"  Price: {row.get('price')} (Expected: {new_price})")
                print(f"  Status: {row.get('status')}")
                print(f"  Deleted At: {row.get('deleted_at')}")
                assert float(row.get("price", 0)) == new_price, f"Expected price {new_price}, got {row.get('price')}"
            else:
                print("❌ ERROR: bm_transactions row not found.")

        # ------------------------------------------------------------------
        # TEST 2: REAL TRANSACTION.DELETED SOFT-DELETE ON TXN 4809320
        # ------------------------------------------------------------------
        print(f"\n======================================================================")
        print(f"--- 2. Testing Real transaction.deleted Soft-Delete on Txn {TXN_2_ID} ---")
        
        # Ensure TXN_2_ID is present in bm_transactions before deletion so soft-delete can be verified
        from services.brokermint_sync import sync_single_transaction
        print(f"Ensuring Transaction {TXN_2_ID} is in bm_transactions before delete...")
        await sync_single_transaction(supabase, str(TXN_2_ID))
        pre_del = supabase.table("bm_transactions").select("bm_id, status, deleted_at").eq("bm_id", str(TXN_2_ID)).execute()
        print("Pre-delete state in bm_transactions:", pre_del.data)

        # Now call real BrokerMint DELETE API
        print(f"\nCalling DELETE /v1/transactions/{TXN_2_ID} in BrokerMint...")
        t_del_start = datetime.now(timezone.utc)
        del_resp = await client.delete(
            f"{BASE_URL}/v1/transactions/{TXN_2_ID}",
            params={"api_key": api_key},
        )
        print(f"DELETE Status: {del_resp.status_code}")
        print(f"DELETE Body: {del_resp.text}")

        print(f"\nWaiting for real transaction.deleted webhook for Txn {TXN_2_ID}...")
        del_event = None
        for attempt in range(1, 21):
            await asyncio.sleep(2)
            log_res = (
                supabase.table("bm_webhook_events_log")
                .select("*")
                .eq("transaction_id", str(TXN_2_ID))
                .eq("event_type", "transaction.deleted")
                .order("received_at", desc=True)
                .execute()
            )
            if log_res.data:
                del_event = log_res.data[0]
                print(f"✓ Real transaction.deleted webhook detected after ~{attempt * 2}s!")
                break
            print(f"  Attempt {attempt}/20: Waiting for transaction.deleted webhook...")

        if not del_event:
            print("❌ TIMEOUT waiting for transaction.deleted event.")
        else:
            print("\nReal transaction.deleted Event in bm_webhook_events_log:")
            print(json.dumps(del_event, indent=2, default=str))

            # Verify soft-delete in bm_transactions
            post_del = supabase.table("bm_transactions").select("bm_id, status, deleted_at").eq("bm_id", str(TXN_2_ID)).execute()
            print("\nPost-delete state in bm_transactions:")
            print(json.dumps(post_del.data, indent=2, default=str))
            if post_del.data:
                row2 = post_del.data[0]
                assert row2.get("status") == "cancelled", f"Expected status 'cancelled', got {row2.get('status')}"
                assert row2.get("deleted_at") is not None, "Expected deleted_at to be populated"
                print("✓ Confirmed: status='cancelled' and deleted_at is populated!")

        # ------------------------------------------------------------------
        # STEP 6: SYNC HEALTH STATUS
        # ------------------------------------------------------------------
        print("\n======================================================================")
        print("STEP 6: CHECK GET /brokermint/sync-health")
        print("======================================================================")
        health = await get_sync_health(_admin_id=ADMIN_ID)
        print(json.dumps(health, indent=2, default=str))

        # ------------------------------------------------------------------
        # CLEANUP
        # ------------------------------------------------------------------
        print("\n======================================================================")
        print("CLEANUP: DELETING TEST ASSETS & CONFIRMING 404s")
        print("======================================================================")
        print(f"Deleting BM Transaction 1 ({TXN_1_ID})...")
        r1 = await client.delete(f"{BASE_URL}/v1/transactions/{TXN_1_ID}", params={"api_key": api_key})
        print(f"  DELETE /v1/transactions/{TXN_1_ID} -> {r1.status_code}")

        print(f"Deleting BM Contact 1 ({CONTACT_1_ID})...")
        rc1 = await client.delete(f"{BASE_URL}/v1/contacts/{CONTACT_1_ID}", params={"api_key": api_key})
        print(f"  DELETE /v1/contacts/{CONTACT_1_ID} -> {rc1.status_code}")

        print(f"Deleting BM Contact 2 ({CONTACT_2_ID})...")
        rc2 = await client.delete(f"{BASE_URL}/v1/contacts/{CONTACT_2_ID}", params={"api_key": api_key})
        print(f"  DELETE /v1/contacts/{CONTACT_2_ID} -> {rc2.status_code}")

        print("\nConfirming 404s for both transactions in BrokerMint...")
        c1 = await client.get(f"{BASE_URL}/v1/transactions/{TXN_1_ID}", params={"api_key": api_key})
        print(f"  GET /v1/transactions/{TXN_1_ID} -> {c1.status_code} (Is 404: {c1.status_code == 404})")

        c2 = await client.get(f"{BASE_URL}/v1/transactions/{TXN_2_ID}", params={"api_key": api_key})
        print(f"  GET /v1/transactions/{TXN_2_ID} -> {c2.status_code} (Is 404: {c2.status_code == 404})")

        print("\nCleaning up test rows in Supabase bm_transactions...")
        supabase.table("bm_transactions").delete().eq("bm_id", str(TXN_1_ID)).execute()
        supabase.table("bm_transactions").delete().eq("bm_id", str(TXN_2_ID)).execute()
        print("✓ Cleanup complete!")

if __name__ == "__main__":
    asyncio.run(main())
