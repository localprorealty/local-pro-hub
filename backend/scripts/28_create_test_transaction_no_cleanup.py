import os
import asyncio
from config import get_settings
from supabase import create_client

s = get_settings()
supabase = create_client(*s.require_supabase())

async def test_flow():
    print("=== Creating Test Transaction for Visual Verification ===")
    
    agent_id = "d2603037-0f9f-46bd-905e-4b9b9de3d35a" # Andrew Wetzel
    
    # Check mapping
    mapping = supabase.table("listing_type_checklist_mapping").select("*").eq("listing_type", "lease").maybe_single().execute()
    if not mapping.data:
        print("ERROR: No mapping found. Please run migrations.")
        return
    template_id = mapping.data["checklist_template_id"]
    
    # Create listing in Supabase
    listing_payload = {
        "agent_id": agent_id,
        "listing_type": "lease",
        "stage": "draft",
        "address_full": "789 Visual Label St, Dallas, TX 75248",
        "form_data": {
            "seller_name": "Visual Label Seller",
            "seller_email": "visual-label@example.com",
            "seller_phone": "2145559999",
            "street_number": "789",
            "street_name": "Visual Label St",
            "city": "Dallas",
            "state": "TX",
            "zip_code": "75248",
            "list_price": 2800.0,
            "list_date": "2026-07-22",
            "expire_date": "2026-12-31"
        }
    }
    
    new_listing = supabase.table("listings").insert(listing_payload).execute()
    listing_id = new_listing.data[0]["id"]
    print(f"Created Listing ID: {listing_id}")
    
    try:
        import sys
        sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        from routers.listings import transition_listing, TransitionRequest
        
        print("Transitioning listing to docs_pending...")
        req = TransitionRequest(stage="docs_pending")
        result = await transition_listing(listing_id=listing_id, req=req, agent_id=agent_id)
        
        print("\nSUCCESS!")
        print("Result:", result)
        print(f"Listing transitioned successfully. Transaction ID: {result.get('brokermint_transaction_id')}")
        print("Please check the BrokerMint UI to verify that the custom attribute labels (Lead source, Client 1 Name, Client 1 Email, Client 1 Phone, MLS Number, County) display correctly.")
        
    except Exception as e:
        print("ERROR:", e)
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_flow())
