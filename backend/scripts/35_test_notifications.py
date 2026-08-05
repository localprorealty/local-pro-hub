# backend/scripts/35_test_notifications.py
import sys
import asyncio
from pathlib import Path
from unittest.mock import patch, AsyncMock, MagicMock
sys.path.append(str(Path(__file__).resolve().parents[1]))

from config import get_settings
from supabase import create_client

s = get_settings()
supabase = create_client(*s.require_supabase())

async def test_docs_pending_and_go_live_notifications():
    print("=== Testing Docs Pending and Go Live Notifications ===")
    agent_id = "d2603037-0f9f-46bd-905e-4b9b9de3d35a" # Andrew Wetzel
    
    # 1. Create a listing with stage 'draft'
    listing_payload = {
        "agent_id": agent_id,
        "listing_type": "listing",
        "stage": "draft",
        "address_full": "999 Notify Ln, Dallas, TX 75248",
        "form_data": {
            "seller_name": "Notify Seller",
            "seller_email": "seller@example.com",
            "seller_phone": "2145558888",
            "street_number": "999",
            "street_name": "Notify Ln",
            "city": "Dallas",
            "state": "TX",
            "zip_code": "75248",
            "list_price": "550000",
            "listing_type": "listing",
            "property_description": "Beautiful 3-bed 2-bath house in Dallas."
        }
    }
    
    new_listing = supabase.table("listings").insert(listing_payload).execute()
    listing_id = new_listing.data[0]["id"]
    print(f"Created temporary listing ID: {listing_id}")
    
    try:
        from routers.listings import transition_listing, mark_listing_live, TransitionRequest, GoLiveBody
        import httpx
        import json
        
        # We mock httpx.AsyncClient.post to capture webhooks
        mock_post = AsyncMock()
        mock_post.return_value = httpx.Response(200, json={"ok": True})
        
        # Mock BrokerMint Service Calls
        mock_create_contact = AsyncMock(return_value={"id": 12345})
        mock_create_txn = AsyncMock(return_value={"id": 99999})
        mock_add_user = AsyncMock()
        mock_add_contact = AsyncMock()
        mock_apply_checklist = AsyncMock()
        
        with patch("services.brokermint_service.create_bm_contact", mock_create_contact), \
             patch("services.brokermint_service.create_bm_transaction", mock_create_txn), \
             patch("services.brokermint_service.add_bm_user_participant", mock_add_user), \
             patch("services.brokermint_service.add_bm_contact_participant", mock_add_contact), \
             patch("services.brokermint_service.apply_bm_checklist_template", mock_apply_checklist), \
             patch.object(httpx.AsyncClient, "post", mock_post):
             
            # Mock configuration settings
            with patch("routers.listings.get_settings") as mock_settings:
                mock_inst = MagicMock()
                mock_inst.n8n_docs_pending_webhook_url = "http://localhost:5678/webhook/localpro-listing-docs-pending"
                mock_inst.n8n_go_live_webhook_url = "http://localhost:5678/webhook/localpro-listing-live"
                mock_inst.frontend_url = "http://localhost:5173"
                mock_inst.cors_origin_list = ["http://localhost:5173"]
                mock_inst.lofty_webhook_url = "http://lofty-mock"
                mock_settings.return_value = mock_inst
                
                # --- TEST 1: Docs Pending Transition ---
                print("\n--- Test 1: Transitioning listing to 'docs_pending' (BrokerMint creation) ---")
                req = TransitionRequest(stage="docs_pending")
                result = await transition_listing(listing_id=listing_id, req=req, agent_id=agent_id)
                print("Transition result:", result)
                
                # Verify docs_pending webhook call
                assert mock_post.call_count == 1, f"Expected 1 webhook call, got {mock_post.call_count}"
                call_args = mock_post.call_args_list[0]
                url = call_args[0][0]
                payload = call_args[1].get("json")
                
                print(f"Webhook URL: {url}")
                print(f"Payload: {json.dumps(payload, indent=2)}")
                
                assert url == "http://localhost:5678/webhook/localpro-listing-docs-pending"
                assert payload.get("event") == "docs_pending"
                assert payload.get("listing_id") == listing_id
                assert payload.get("brokermint_transaction_id") == "99999"
                assert payload.get("recipients") == ["andrew@theandrews.group"]
                assert payload.get("property_address") == "999 Notify Ln, Dallas, TX 75248"
                print("Docs pending notification trigger SUCCESS!")
                
                # Reset mock_post
                mock_post.reset_mock()
                
                # --- TEST 2: Go Live Notification ---
                print("\n--- Test 2: Transitioning listing to 'live' ---")
                # To go live, we first need stage to be 'mls_submitted'
                supabase.table("listings").update({"stage": "mls_submitted"}).eq("id", listing_id).execute()
                
                # Retrieve listing to refresh mock info
                live_body = GoLiveBody(go_live_date="2026-08-05")
                result_live = await mark_listing_live(listing_id=listing_id, body=live_body, agent_id=agent_id)
                print("Go Live result:", result_live)
                
                # Verify go_live webhook call
                assert mock_post.call_count == 1, f"Expected 1 webhook call, got {mock_post.call_count}"
                call_args_live = mock_post.call_args_list[0]
                url_live = call_args_live[0][0]
                payload_live = call_args_live[1].get("json")
                
                print(f"Webhook URL: {url_live}")
                print(f"Payload: {json.dumps(payload_live, indent=2)}")
                
                assert url_live == "http://localhost:5678/webhook/localpro-listing-live"
                assert payload_live.get("event") == "listing_live"
                assert payload_live.get("listing_id") == listing_id
                assert payload_live.get("brokermint_transaction_id") == "99999"
                assert payload_live.get("agent_email") == "andrew@theandrews.group"
                print("Go Live notification trigger SUCCESS!")
                
    finally:
        print("\nDeleting temporary listing from Supabase...")
        supabase.table("listings").delete().eq("id", listing_id).execute()
        print("Cleanup done.")

if __name__ == "__main__":
    asyncio.run(test_docs_pending_and_go_live_notifications())
