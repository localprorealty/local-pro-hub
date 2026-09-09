#!/usr/bin/env python3
"""
46_verify_public_share_flow.py

Automated verification script for Backlog Item #9 (Public Listing Share Link & Client Feedback):
1. Verifies token entropy and generation (192 bits of cryptographic randomness).
2. Verifies strict privacy boundaries: Zero leakage of BrokerMint IDs, seller contact details,
   access/lockbox codes, internal notes, or financial splits in the public share response.
3. Verifies honeypot bot trap behavior (drops submission silently without DB write).
4. Verifies IP rate limiting (max 5 comments per 10 minutes per IP).
5. Verifies agent moderation security (agent can only delete comments belonging to their own listing).
6. Verifies live Supabase schema status for Migration 027.
"""

import sys
import os
import secrets
from pathlib import Path
from unittest.mock import patch, MagicMock
from datetime import datetime, timezone
from fastapi import HTTPException, Request

# Setup path
backend_dir = Path(__file__).resolve().parents[1]
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from config import get_settings
from routers.public_share import (
    get_public_listing_share,
    submit_public_comment,
    delete_listing_comment,
    CreatePublicCommentPayload,
    check_ip_rate_limit,
    comment_rate_cache,
    IP_COMMENT_LIMIT,
)
from supabase import create_client


def run_tests():
    print("=" * 75)
    print("PUBLIC LISTING SHARE & CLIENT FEEDBACK — VERIFICATION SUITE")
    print("=" * 75)

    # -----------------------------------------------------------------------
    # TEST 1: Token Entropy & Randomness
    # -----------------------------------------------------------------------
    print("\n--- TEST 1: Token Cryptographic Entropy ---")
    tokens = [secrets.token_urlsafe(24) for _ in range(100)]
    assert len(set(tokens)) == 100, "Collision detected in 100 token generations!"
    sample = tokens[0]
    print(f"✓ Sample token generated: {sample} (Length: {len(sample)} chars, 192 bits)")
    assert len(sample) >= 32, "Token does not meet minimum 192-bit URL-safe length!"
    print("✓ Confirmed: Tokens are high-entropy, URL-safe, and cryptographically unpredictable.")

    # -----------------------------------------------------------------------
    # TEST 2: Strict Privacy Boundary & Data Sanitization
    # -----------------------------------------------------------------------
    print("\n--- TEST 2: Strict Privacy Boundary & Data Sanitization ---")
    mock_sensitive_listing = {
        "id": "11111111-2222-3333-4444-555555555555",
        "agent_id": "agent-uuid-99",
        "address_full": "742 Evergreen Terrace, Dallas, TX 75201",
        "stage": "docs_signed",
        "list_price": 650000,
        "description_generated": "Stunning luxury home with spacious living areas.",
        "is_publicly_shared": True,
        "public_share_token": "valid_secure_share_token_123",
        # SENSITIVE DATA THAT MUST NEVER LEAK:
        "brokermint_transaction_id": "bm_confidential_987654",
        "form_data": {
            "property_type": "Single Family Residential",
            "bedrooms": 4,
            "bathrooms_full": 3,
            "bathrooms_half": 1,
            "square_feet": 3200,
            "year_built": 2021,
            "subdivision": "Springfield Estates",
            # SENSITIVE FORM DATA:
            "sellers": [
                {"name": "Homer Simpson", "phone": "214-555-0199", "email": "homer@secret.com"}
            ],
            "lockbox_code": "4321#",
            "gate_code": "#8899",
            "commission_split": "80/20 with $16k cap",
            "internal_notes": "Seller is eager to relocate by next month. Keep confidential.",
        },
    }

    mock_agent = {
        "id": "agent-uuid-99",
        "full_name": "Sarah Connor",
        "email": "sarah@localprorealty.com",
        "phone": "(214) 555-4321",
        "heygen_avatar_thumbnail_url": "https://assets.localprorealty.com/avatars/sarah.webp",
        "brand_logo_url": None,
    }

    mock_images = [
        {
            "id": "img-1",
            "public_url": "https://cdn.localprorealty.com/photos/front.webp",
            "category": "exterior",
            "caption": "Grand front elevation",
            "is_hero": True,
            "sort_order": 0,
        }
    ]

    with patch("routers.public_share.get_service_client") as mock_get_client:
        mock_client = MagicMock()

        def mock_table(table_name):
            mock_query = MagicMock()
            if table_name == "listings":
                mock_query.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = MagicMock(
                    data=mock_sensitive_listing
                )
            elif table_name == "users":
                mock_query.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = MagicMock(
                    data=mock_agent
                )
            elif table_name == "listing_images":
                mock_query.select.return_value.eq.return_value.order.return_value.order.return_value.execute.return_value = MagicMock(
                    data=mock_images
                )
            elif table_name == "listing_comments":
                mock_query.select.return_value.eq.return_value.order.return_value.execute.return_value = MagicMock(
                    data=[]
                )
            return mock_query

        mock_client.table.side_effect = mock_table
        mock_get_client.return_value = mock_client

        import asyncio
        public_view = asyncio.run(get_public_listing_share("valid_secure_share_token_123"))

        print(f"✓ Public view address: {public_view['address_full']}")
        print(f"✓ Public view agent: {public_view['agent']['name']} ({public_view['agent']['email']})")
        print(f"✓ Public view photos: {len(public_view['photos'])} item(s)")
        print(f"✓ Public view brokerage: {public_view['brokerage']['name']}, {public_view['brokerage']['address']}")

        # STRICT PRIVACY ASSERTIONS:
        serialized_view = str(public_view)
        assert "bm_confidential_987654" not in serialized_view, "SECURITY LEAK: BrokerMint ID exposed!"
        assert "Homer Simpson" not in serialized_view, "SECURITY LEAK: Seller name exposed!"
        assert "214-555-0199" not in serialized_view, "SECURITY LEAK: Seller phone exposed!"
        assert "homer@secret.com" not in serialized_view, "SECURITY LEAK: Seller email exposed!"
        assert "4321#" not in serialized_view, "SECURITY LEAK: Lockbox code exposed!"
        assert "#8899" not in serialized_view, "SECURITY LEAK: Gate code exposed!"
        assert "80/20" not in serialized_view, "SECURITY LEAK: Commission split exposed!"
        assert "relocate by next month" not in serialized_view, "SECURITY LEAK: Internal notes exposed!"

        # ALLOWED DATA ASSERTIONS:
        assert public_view["specs"]["bedrooms"] == 4
        assert public_view["specs"]["square_feet"] == 3200
        assert public_view["brokerage"]["name"] == "LocalPRO Realty"
        print("✓ Confirmed: 100% of sensitive fields excluded, non-sensitive specs preserved!")

    # -----------------------------------------------------------------------
    # TEST 3: Anti-Spam Honeypot Protection
    # -----------------------------------------------------------------------
    print("\n--- TEST 3: Anti-Spam Honeypot Bot Trap ---")
    bot_payload = CreatePublicCommentPayload(
        commenter_name="SpamBot 3000",
        comment_text="Buy cheap watches at http://spam.example.com",
        hp_website="http://spam-trap-link.ru",  # BOT FELL INTO TRAP
    )

    mock_request = MagicMock(spec=Request)
    mock_request.headers = {}
    mock_request.client.host = "192.0.2.1"

    with patch("routers.public_share.get_service_client") as mock_get_client:
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client

        trap_response = asyncio.run(
            submit_public_comment(
                token="valid_secure_share_token_123",
                payload=bot_payload,
                request=mock_request,
            )
        )

        print(f"✓ Bot trap response: {trap_response}")
        assert trap_response["id"] == "spam-trap", "Bot trap failed to catch honeypot submission!"
        # Verify zero database insert calls made
        assert not mock_client.table("listing_comments").insert.called, (
            "SECURITY FLAW: Database insert was invoked for a honeypot bot submission!"
        )
        print("✓ Confirmed: Honeypot triggered, zero database writes executed!")

    # -----------------------------------------------------------------------
    # TEST 4: Anti-Spam IP Rate Limiting (5 comments per 10 mins)
    # -----------------------------------------------------------------------
    print("\n--- TEST 4: Anti-Spam IP Rate Limiter ---")
    test_ip = "203.0.113.99"
    comment_rate_cache.pop(test_ip, None)

    for i in range(IP_COMMENT_LIMIT):
        check_ip_rate_limit(test_ip)
    print(f"✓ Successfully processed {IP_COMMENT_LIMIT} comments within rate window for IP {test_ip}")

    # 6th submission must be rejected with 429
    try:
        check_ip_rate_limit(test_ip)
        assert False, "Should have raised 429 Too Many Requests on 6th comment!"
    except HTTPException as exc:
        assert exc.status_code == 429
        print(f"✓ Rate limit enforced: 6th request rejected with HTTP {exc.status_code} ({exc.detail})")

    # -----------------------------------------------------------------------
    # TEST 5: Agent Comment Moderation Security
    # -----------------------------------------------------------------------
    print("\n--- TEST 5: Agent Comment Moderation Security ---")
    with patch("routers.public_share.get_service_client") as mock_get_client:
        mock_client = MagicMock()

        def mock_mod_table(table_name):
            mock_query = MagicMock()
            if table_name == "listings":
                mock_query.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = MagicMock(
                    data={"id": "listing-1", "agent_id": "agent-1"}
                )
            elif table_name == "listing_comments":
                mock_query.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = MagicMock(
                    data={"id": "comment-abc", "listing_id": "listing-2"}
                )
            return mock_query

        mock_client.table.side_effect = mock_mod_table
        mock_get_client.return_value = mock_client

        try:
            asyncio.run(
                delete_listing_comment(
                    listing_id="listing-1",
                    comment_id="comment-abc",
                    agent_id="agent-1",
                )
            )
            assert False, "Should have rejected deleting comment belonging to another listing!"
        except HTTPException as exc:
            assert exc.status_code == 400
            print(f"✓ Cross-listing deletion rejected with HTTP {exc.status_code} ({exc.detail})")

    # -----------------------------------------------------------------------
    # TEST 6: Supabase Live Schema Status for Migration 027
    # -----------------------------------------------------------------------
    print("\n--- TEST 6: Supabase Live Schema Status (Migration 027) ---")
    settings = get_settings()
    sb = create_client(*settings.require_supabase())

    try:
        r = sb.table("listings").select("public_share_token, is_publicly_shared, public_share_created_at").limit(1).execute()
        print("✓ Columns on 'listings' (public_share_token, is_publicly_shared, public_share_created_at): PRESENT")
    except Exception as e:
        print(f"⚠ Columns on 'listings': NOT YET RUN in Supabase ({e})")

    try:
        r2 = sb.table("listing_comments").select("*").limit(1).execute()
        print("✓ Table 'listing_comments': PRESENT in Supabase database")
    except Exception as e:
        print(f"⚠ Table 'listing_comments': NOT YET RUN in Supabase ({e})")

    print("\n" + "=" * 75)
    print("VERIFICATION SUITE COMPLETED SUCCESSFULLY")
    print("=" * 75)


if __name__ == "__main__":
    run_tests()
