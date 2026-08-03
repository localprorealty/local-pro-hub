# backend/scripts/33_test_add_marketing_asset.py
import sys
import asyncio
from pathlib import Path
from unittest.mock import patch, AsyncMock
from config import get_settings
from supabase import create_client

sys.path.append(str(Path(__file__).resolve().parents[1]))

s = get_settings()
supabase = create_client(*s.require_supabase())

async def test_add_asset():
    print("=== Testing Add Marketing Asset Endpoint ===")
    agent_id = "d2603037-0f9f-46bd-905e-4b9b9de3d35a" # Andrew Wetzel
    
    # 1. Create a listing in 'marketing' stage
    listing_payload = {
        "agent_id": agent_id,
        "listing_type": "listing",
        "stage": "marketing",
        "address_full": "777 Canva St, Dallas, TX 75248",
        "form_data": {
            "seller_name": "Canva Seller",
            "seller_email": "canva@example.com",
            "seller_phone": "2145551111",
            "street_number": "777",
            "street_name": "Canva St",
            "city": "Dallas",
            "state": "TX",
            "zip_code": "75248",
            "list_price": "500000"
        }
    }
    
    new_listing = supabase.table("listings").insert(listing_payload).execute()
    listing_id = new_listing.data[0]["id"]
    print(f"Created temporary listing ID: {listing_id}")
    
    try:
        from routers.listings import add_marketing_asset, AddMarketingAssetRequest
        
        # Mock HTTpx POST call to capture payload
        import httpx
        mock_post = AsyncMock()
        mock_post.return_value = httpx.Response(200, json={"ok": True})
        
        with patch.object(httpx.AsyncClient, "post", mock_post):
            with patch("routers.listings.get_settings") as mock_settings:
                from unittest.mock import MagicMock
                mock_inst = MagicMock()
                mock_inst.n8n_marketing_webhook_url = "http://localhost:5678/webhook/localpro-marketing-pending"
                mock_inst.frontend_url = "http://localhost:5173"
                mock_inst.cors_origin_list = ["http://localhost:5173"]
                mock_settings.return_value = mock_inst
                
                print("Calling add_marketing_asset for 'social-pack'...")
                req = AddMarketingAssetRequest(
                    asset_id="social-pack",
                    asset_name="Social Media Pack",
                    price_cents=0,
                    paid=False
                )
                
                result = await add_marketing_asset(listing_id=listing_id, req=req, agent_id=agent_id)
                print("Endpoint result:", result)
                
                # Check database was updated
                updated = supabase.table("listings").select("form_data").eq("id", listing_id).single().execute()
                stored_statuses = updated.data.get("form_data", {}).get("marketing_statuses", {})
                print("Stored marketing_statuses in DB:", stored_statuses)
                assert stored_statuses.get("social-pack") == "in_progress"
                
                # Check webhook call
                print("Was webhook called?", mock_post.called)
                if mock_post.called:
                    call_args = mock_post.call_args
                    payload = call_args[1].get("json")
                    print("Webhook payload:")
                    import json
                    print(json.dumps(payload, indent=2))
                    
                    assert payload.get("event") == "marketing_asset_added"
                    assert payload.get("asset", {}).get("id") == "social-pack"
                    assert payload.get("asset", {}).get("price_cents") == 0
                    assert payload.get("asset", {}).get("paid") is False
                    print("\nSUCCESS! Webhook fired with correct event, price_cents, and paid flag.")
                else:
                    print("\nFAILURE! Webhook was not called.")
                    sys.exit(1)
        
    finally:
        print("Deleting temporary listing from Supabase...")
        supabase.table("listings").delete().eq("id", listing_id).execute()
        print("Cleanup done.")

if __name__ == "__main__":
    asyncio.run(test_add_asset())
