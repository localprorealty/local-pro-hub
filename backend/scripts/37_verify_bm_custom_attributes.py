import asyncio
import json
from unittest.mock import AsyncMock, patch, MagicMock
from pathlib import Path
import sys

sys.path.append(str(Path(__file__).resolve().parents[1]))

from routers.listings import transition_listing, TransitionRequest

async def test_custom_attributes_payload():
    # Sample listing data representing a listing transitioning to docs_pending
    sample_listing = {
        "id": "test-listing-id-123",
        "agent_id": "test-agent-id",
        "address_full": "1234 Mockingbird Ln, Dallas, TX 75248",
        "list_price": 450000.0,
        "mls_number": "STALE-RETS-MLS-12345",  # Stale RETS MLS number present on listing
        "brokermint_transaction_id": None,
        "listing_type": "traditional sale",
        "stage": "draft",
        "form_data": {
            "seller_name": "Jane Doe",
            "seller_email": "jane.doe@example.com",
            "seller_phone": "214-555-0199",
            "street_number": "1234",
            "street_name": "Mockingbird Ln",
            "city": "Dallas",
            "state": "TX",
            "zip_code": "75248",
            "list_price": 450000.0,
            "list_date": "2026-09-01",
            "expire_date": "2027-03-01",
            "county": "Dallas",
            "property_type": "Single Family Residence",
            "lockbox": "Yes",
            "yard_sign": "Yes",
            "listing_type": "traditional sale"
        }
    }

    mock_client = MagicMock()
    mock_client.table().select().eq().maybe_single().execute.return_value = MagicMock(
        data={"checklist_template_id": 9999}
    )
    mock_client.table().select().eq().single().execute.return_value = MagicMock(
        data={"brokermint_id": "183733"}
    )
    mock_client.table().update().eq().execute.return_value = MagicMock(data=[])

    captured_payload = None

    async def mock_create_txn(payload):
        nonlocal captured_payload
        captured_payload = payload
        return {"id": 88888}

    async def mock_create_contact(payload):
        return {"id": 77777}

    async def mock_noop(*args, **kwargs):
        return {}

    with patch("routers.listings.get_service_client", return_value=mock_client), \
         patch("routers.listings._require_agent_listing", return_value=sample_listing), \
         patch("routers.listings._trigger_docs_pending_notification", new_callable=AsyncMock), \
         patch("services.brokermint_service.create_bm_contact", side_effect=mock_create_contact), \
         patch("services.brokermint_service.create_bm_transaction", side_effect=mock_create_txn), \
         patch("services.brokermint_service.add_bm_user_participant", side_effect=mock_noop), \
         patch("services.brokermint_service.add_bm_contact_participant", side_effect=mock_noop), \
         patch("services.brokermint_service.apply_bm_checklist_template", side_effect=mock_noop):

        req = TransitionRequest(stage="docs_pending")
        await transition_listing(listing_id="test-listing-id-123", req=req, agent_id="test-agent-id")

    assert captured_payload is not None, "Payload was not captured"
    custom_attributes = captured_payload["custom_attributes"]

    # Verify MLS Number is NOT present
    for attr in custom_attributes:
        assert attr.get("name") != "mls_number", "mls_number still found in custom_attributes!"
        assert "mls" not in attr.get("label", "").lower(), f"MLS attribute found: {attr}"

    print("SUCCESS: MLS Number is completely absent from custom_attributes.")
    print("\nFull custom_attributes structure:")
    print(json.dumps(custom_attributes, indent=2))

if __name__ == "__main__":
    asyncio.run(test_custom_attributes_payload())
