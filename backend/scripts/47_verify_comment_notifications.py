"""
Verification script for Backlog item #13: Visitor comment notifications for agents.
Tests the endpoints:
- GET /api/listings/comments/unread
- POST /api/listings/{listing_id}/comments/mark-read
"""

import sys
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from main import app
from deps.auth import require_agent

client = TestClient(app)

def test_comment_notifications():
    print("--- Running Comment Notifications Verification Tests ---")

    test_agent_id = "agent-1234"
    mock_listings = [
        {"id": "listing-aaa", "address_full": "100 Main St, Dallas, TX", "agent_id": test_agent_id},
        {"id": "listing-bbb", "address_full": "200 Oak Ave, Plano, TX", "agent_id": test_agent_id},
    ]

    mock_comments = [
        {
            "id": "c1",
            "listing_id": "listing-aaa",
            "commenter_name": "Alice Buyer",
            "comment_text": "Is the roof recently replaced?",
            "created_at": "2026-09-10T01:00:00Z",
            "read_at": None,
        },
        {
            "id": "c2",
            "listing_id": "listing-bbb",
            "commenter_name": "Bob Agent",
            "comment_text": "Great layout, scheduling a private tour.",
            "created_at": "2026-09-10T01:30:00Z",
            "read_at": None,
        },
    ]

    # Mock get_service_client
    mock_sb = MagicMock()

    # User lookup
    mock_users_select = MagicMock()
    mock_users_select.eq.return_value.maybe_single.return_value.execute.return_value.data = {"role": "agent"}

    # Listings lookup
    mock_listings_select = MagicMock()
    mock_listings_select.eq.return_value.execute.return_value.data = mock_listings

    # Comments lookup
    mock_comments_select = MagicMock()
    mock_comments_select.in_.return_value.is_.return_value.order.return_value.limit.return_value.execute.return_value.data = mock_comments

    # Table routing
    def table_router(name):
        t = MagicMock()
        if name == "users":
            t.select.return_value = mock_users_select
        elif name == "listings":
            t.select.return_value = mock_listings_select
            # For _require_agent_listing
            t.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value.data = {
                "id": "listing-aaa",
                "agent_id": test_agent_id,
            }
        elif name == "listing_comments":
            t.select.return_value = mock_comments_select
            t.update.return_value.eq.return_value.is_.return_value.execute.return_value.data = []
        return t

    mock_sb.table.side_effect = table_router

    app.dependency_overrides[require_agent] = lambda: test_agent_id

    try:
        with patch("routers.public_share.get_service_client", return_value=mock_sb):
            # Test 1: GET /listings/comments/unread
            resp = client.get("/listings/comments/unread")
            assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
            data = resp.json()
            assert data["count"] == 2, f"Expected count 2, got {data['count']}"
            assert len(data["unread"]) == 2, f"Expected 2 items, got {len(data['unread'])}"
            assert data["unread"][0]["address_full"] == "100 Main St, Dallas, TX"
            assert data["unread"][0]["commenter_name"] == "Alice Buyer"
            print("✓ GET /listings/comments/unread passed (correct count & mapped address)")

            # Test 2: POST /listings/{listing_id}/comments/mark-read
            resp2 = client.post("/listings/listing-aaa/comments/mark-read")
            assert resp2.status_code == 200, f"Expected 200, got {resp2.status_code}: {resp2.text}"
            assert resp2.json() == {"status": "success", "listing_id": "listing-aaa"}
            print("✓ POST /listings/{listing_id}/comments/mark-read passed")

            # Test 3: Empty listings case
            mock_listings_select.eq.return_value.execute.return_value.data = []
            resp3 = client.get("/listings/comments/unread")
            assert resp3.status_code == 200
            assert resp3.json() == {"count": 0, "unread": []}
            print("✓ Empty listings handled gracefully (count: 0)")

        print("\nALL VERIFICATION TESTS PASSED SUCCESSFULLY.")
    finally:
        app.dependency_overrides.clear()

if __name__ == "__main__":
    test_comment_notifications()
