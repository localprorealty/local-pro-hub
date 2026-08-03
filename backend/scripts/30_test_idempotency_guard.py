# backend/scripts/30_test_idempotency_guard.py
import os
import sys
import asyncio
from pathlib import Path
from config import get_settings
from supabase import create_client

sys.path.append(str(Path(__file__).resolve().parents[1]))

s = get_settings()
supabase = create_client(*s.require_supabase())

async def test_idempotency():
    print("=== Testing Idempotency Guard ===")
    agent_id = "d2603037-0f9f-46bd-905e-4b9b9de3d35a" # Andrew Wetzel
    
    # 1. Create a listing with brokermint_transaction_id already populated
    listing_payload = {
        "agent_id": agent_id,
        "listing_type": "lease",
        "stage": "draft",
        "address_full": "999 Idempotent St, Dallas, TX 75248",
        "brokermint_transaction_id": "9999999", # Pre-existing ID
        "form_data": {
            "seller_name": "Idempotent Seller",
            "seller_email": "idem@example.com",
            "seller_phone": "2145551234",
            "street_number": "999",
            "street_name": "Idempotent St",
            "city": "Dallas",
            "state": "TX",
            "zip_code": "75248"
        }
    }
    
    new_listing = supabase.table("listings").insert(listing_payload).execute()
    listing_id = new_listing.data[0]["id"]
    print(f"Created listing ID: {listing_id} with pre-existing BrokerMint transaction ID: 9999999")
    
    try:
        from routers.listings import transition_listing, TransitionRequest
        
        print("Calling transition_listing for 'docs_pending'...")
        req = TransitionRequest(stage="docs_pending")
        result = await transition_listing(listing_id=listing_id, req=req, agent_id=agent_id)
        print("Transition result:", result)
        
        # Verify the listing status and transaction ID in Supabase
        updated = supabase.table("listings").select("stage", "brokermint_transaction_id").eq("id", listing_id).single().execute()
        print("Updated listing state in DB:")
        print(f"  Stage: {updated.data.get('stage')}")
        print(f"  BrokerMint Transaction ID: {updated.data.get('brokermint_transaction_id')}")
        
    finally:
        print("Deleting temporary listing from Supabase...")
        supabase.table("listings").delete().eq("id", listing_id).execute()
        print("Cleanup done.")

if __name__ == "__main__":
    asyncio.run(test_idempotency())
