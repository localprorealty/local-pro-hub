import os
import asyncio
import httpx
from config import get_settings
from supabase import create_client

s = get_settings()
supabase = create_client(*s.require_supabase())
BASE_URI = os.environ.get("BROKERMINT_BASE_URI", "https://my.brokermint.com/api")
API_KEY = s.brokermint_api_key


async def cleanup_bm_transaction(txn_id):
    print(f"Cleaning up BrokerMint Transaction {txn_id}...")
    url = f"{BASE_URI}/v1/transactions/{txn_id}"
    resp = httpx.delete(url, params={"api_key": API_KEY})
    print(f"  DELETE transaction -> {resp.status_code}")


async def cleanup_bm_contact(contact_id):
    print(f"Cleaning up BrokerMint Contact {contact_id}...")
    url = f"{BASE_URI}/v1/contacts/{contact_id}"
    resp = httpx.delete(url, params={"api_key": API_KEY})
    print(f"  DELETE contact -> {resp.status_code}")


async def test_flow():
    print("=== BrokerMint Push Flow Test ===")
    
    # 1. Use Andrew Wetzel's account for testing
    agent_id = "d2603037-0f9f-46bd-905e-4b9b9de3d35a"
    agent_bm_id = "183733"
    print(f"Using Agent: {agent_id} (BrokerMint ID: {agent_bm_id})")
    
    # 2. Check mapping table
    mapping = supabase.table("listing_type_checklist_mapping").select("*").eq("listing_type", "lease").maybe_single().execute()
    if not mapping.data:
        print("ERROR: No mapping found. Did you run the SQL migration?")
        return
    template_id = mapping.data["checklist_template_id"]
    print(f"Using Checklist Template: {template_id} for 'lease'")
    
    # 3. Create a temporary listing in Supabase
    listing_payload = {
        "agent_id": agent_id,
        "listing_type": "lease",
        "stage": "draft",
        "address_full": "456 Test Lease St, Dallas, TX 75248",
        "form_data": {
            "seller_name": "Test Seller-Tenant",
            "seller_email": "test-seller-tenant@example.com",
            "seller_phone": "2145558888",
            "street_number": "456",
            "street_name": "Test Lease St",
            "city": "Dallas",
            "state": "TX",
            "zip_code": "75248",
            "list_price": 2400.0,
            "list_date": "2026-07-01",
            "expire_date": "2026-12-31"
        }
    }
    
    new_listing = supabase.table("listings").insert(listing_payload).execute()
    if not new_listing.data:
        print("ERROR: Failed to create temporary listing in Supabase.")
        return
        
    listing_id = new_listing.data[0]["id"]
    print(f"Created temporary Listing ID in Supabase: {listing_id}")
    
    txn_id_to_cleanup = None
    contact_id_to_cleanup = None
    
    try:
        # Import transition_listing directly from our router
        # We need to add the backend folder to system path if needed
        import sys
        sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        from routers.listings import transition_listing, TransitionRequest
        
        # 4. Call transition_listing endpoint logic directly
        print("\nCalling transition_listing for stage 'docs_pending'...")
        req = TransitionRequest(stage="docs_pending")
        
        # We can bypass fastapi Dependency injection by executing it directly:
        # We mock get_service_client and require_agent
        result = await transition_listing(listing_id=listing_id, req=req, agent_id=agent_id)
        print("Transition result:", result)
        
        # 5. Fetch updated listing to verify brokermint_transaction_id
        updated_listing = supabase.table("listings").select("brokermint_transaction_id, stage").eq("id", listing_id).single().execute()
        bm_txn_id = updated_listing.data.get("brokermint_transaction_id")
        stage = updated_listing.data.get("stage")
        
        print(f"\nVerification Results:")
        print(f"  Listing stage in DB: {stage}")
        print(f"  BrokerMint Transaction ID in DB: {bm_txn_id}")
        
        if bm_txn_id:
            txn_id_to_cleanup = int(bm_txn_id)
            
            # Fetch transaction details from BrokerMint to verify status and transaction_type
            txn_url = f"{BASE_URI}/v1/transactions/{bm_txn_id}"
            txn_resp = httpx.get(txn_url, params={"api_key": API_KEY}).json()
            print(f"  BrokerMint Transaction Name: {txn_resp.get('transaction_name')!r}")
            print(f"  BrokerMint Transaction Type: {txn_resp.get('transaction_type')!r}")
            print(f"  BrokerMint Transaction Representing: {txn_resp.get('representing')!r}")
            
            # Find the contact participant to clean up by querying participants endpoint
            parts_url = f"{BASE_URI}/v1/transactions/{bm_txn_id}/participants"
            parts_resp = httpx.get(parts_url, params={"api_key": API_KEY}).json()
            for p in parts_resp:
                if p.get("type") == "contact" and p.get("role") in ("seller", "buyer"):
                    contact_id_to_cleanup = p.get("id")
                    print(f"  Created BrokerMint Contact ID: {contact_id_to_cleanup}")
        
    except Exception as e:
        print(f"ERROR during transition test: {e}")
        import traceback
        traceback.print_exc()
        
    finally:
        # Cleanup
        print("\n=== Cleaning Up Test Assets ===")
        if txn_id_to_cleanup:
            await cleanup_bm_transaction(txn_id_to_cleanup)
        if contact_id_to_cleanup:
            await cleanup_bm_contact(contact_id_to_cleanup)
            
        print("Deleting temporary listing from Supabase...")
        supabase.table("listings").delete().eq("id", listing_id).execute()
        print("Done!")


if __name__ == "__main__":
    asyncio.run(test_flow())
