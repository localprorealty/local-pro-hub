# backend/scripts/32_test_marketing_transition_webhook.py
import sys
import asyncio
from pathlib import Path
from unittest.mock import patch, AsyncMock
from config import get_settings
from supabase import create_client

sys.path.append(str(Path(__file__).resolve().parents[1]))

s = get_settings()
supabase = create_client(*s.require_supabase())

async def test_marketing_webhook():
    print("=== Testing Marketing Transition Webhook ===")
    agent_id = "d2603037-0f9f-46bd-905e-4b9b9de3d35a" # Andrew Wetzel
    
    # 1. Create a listing with stage 'shoot_booked'
    listing_payload = {
        "agent_id": agent_id,
        "listing_type": "listing",
        "stage": "shoot_booked",
        "address_full": "888 Marketing Ln, Dallas, TX 75248",
        "form_data": {
            "seller_name": "Marketing Seller",
            "seller_email": "mkt@example.com",
            "seller_phone": "2145559999",
            "street_number": "888",
            "street_name": "Marketing Ln",
            "city": "Dallas",
            "state": "TX",
            "zip_code": "75248",
            "list_price": "450000"
        }
    }
    
    new_listing = supabase.table("listings").insert(listing_payload).execute()
    listing_id = new_listing.data[0]["id"]
    print(f"Created temporary listing ID: {listing_id}")
    
    try:
        from routers.listings import transition_listing, TransitionRequest
        
        # We mock httpx.AsyncClient.post to capture the call and prevent actual network request to localhost:5678
        import httpx
        mock_post = AsyncMock()
        mock_post.return_value = httpx.Response(200, json={"ok": True})
        
        with patch.object(httpx.AsyncClient, "post", mock_post):
            # Also ensure settings has a webhook url set
            with patch("routers.listings.get_settings") as mock_settings:
                mock_inst = MagicMock() if "MagicMock" in globals() else patch("routers.listings.get_settings").start()
                # Let's import MagicMock
                from unittest.mock import MagicMock
                mock_inst = MagicMock()
                mock_inst.n8n_marketing_webhook_url = "http://localhost:5678/webhook/localpro-marketing-pending"
                mock_inst.frontend_url = "http://localhost:5173"
                mock_inst.cors_origin_list = ["http://localhost:5173"]
                mock_settings.return_value = mock_inst
                
                print("Transitioning listing to 'marketing'...")
                req = TransitionRequest(stage="marketing")
                result = await transition_listing(listing_id=listing_id, req=req, agent_id=agent_id)
                print("Transition result:", result)
                
                # Check if httpx post was called
                print("Was post called?", mock_post.called)
                if mock_post.called:
                    call_args = mock_post.call_args
                    print("Post URL:", call_args[0][0])
                    print("Post JSON payload:")
                    import json
                    print(json.dumps(call_args[1].get("json"), indent=2))
                    
                    # Verify fields in the payload
                    payload = call_args[1].get("json")
                    assert payload.get("event") == "marketing_pending"
                    assert payload.get("property_address") == "888 Marketing Ln, Dallas, TX 75248"
                    assert payload.get("list_price") == "450000"
                    assert payload.get("agent_name") == "Andrew Wetzel"
                    assert "listing_url" in payload
                    print("\nSUCCESS! Webhook fired with the correct event and payload structure.")
                else:
                    print("\nFAILURE! Webhook was NOT fired.")
                    sys.exit(1)
        
    finally:
        print("Deleting temporary listing from Supabase...")
        supabase.table("listings").delete().eq("id", listing_id).execute()
        print("Cleanup done.")

if __name__ == "__main__":
    asyncio.run(test_marketing_webhook())
