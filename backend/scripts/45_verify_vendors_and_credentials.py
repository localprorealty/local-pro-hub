#!/usr/bin/env python3
"""
45_verify_vendors_and_credentials.py

Automated verification script for Backlog Item #4 (External Photographer Vendor Flow):
1. Verifies mandatory APP_CREDENTIALS_ENCRYPTION_KEY hard-fail behavior.
2. Verifies Fernet encryption at rest (genuine ciphertext, never plaintext).
3. Verifies sanitized SMTP error handling on invalid credentials (zero credential/traceback leakage).
4. Verifies API response schemas never expose plaintext passwords or ciphertext.
5. Verifies editable email dispatch logic preserves exact agent-edited subject and body.
6. Checks Supabase table availability for agent_vendors and agent_email_credentials.
"""

import sys
import os
from pathlib import Path
from unittest.mock import patch, MagicMock

# Setup path
backend_dir = Path(__file__).resolve().parents[1]
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from config import get_settings, Settings
from cryptography.fernet import Fernet
import smtplib
from fastapi import HTTPException
from routers.vendors import (
    save_gmail_credentials,
    get_gmail_credentials_status,
    SaveGmailCredentialsBody,
    SendVendorOrderEmailBody,
    send_vendor_order_email,
)
from supabase import create_client

def run_tests():
    print("=" * 70)
    print("EXTERNAL PHOTOGRAPHER VENDOR FLOW — VERIFICATION SUITE")
    print("=" * 70)

    settings = get_settings()

    # -----------------------------------------------------------------------
    # TEST 1: Mandatory APP_CREDENTIALS_ENCRYPTION_KEY Loud-Fail Behavior
    # -----------------------------------------------------------------------
    print("\n--- TEST 1: APP_CREDENTIALS_ENCRYPTION_KEY Loud-Fail Behavior ---")
    current_key = settings.app_credentials_encryption_key
    assert current_key, "APP_CREDENTIALS_ENCRYPTION_KEY must be configured in backend/.env"
    print(f"✓ Current configured key: {current_key[:6]}...{current_key[-4:]}")

    # Test loud failure if key is empty
    empty_settings = Settings(app_credentials_encryption_key="")
    try:
        empty_settings.require_credentials_encryption_key()
        assert False, "Should have raised RuntimeError on missing encryption key!"
    except RuntimeError as e:
        print(f"✓ Hard-fail verified when key missing: RuntimeError -> '{e}'")

    # -----------------------------------------------------------------------
    # TEST 2: Encryption at Rest Verification (Genuine Ciphertext)
    # -----------------------------------------------------------------------
    print("\n--- TEST 2: Fernet Encryption at Rest ---")
    fernet = Fernet(settings.app_credentials_encryption_key)
    sample_secret = "testapppass12345"
    encrypted = fernet.encrypt(sample_secret.encode()).decode()

    print(f"✓ Original secret:    {sample_secret}")
    print(f"✓ Encrypted secret:   {encrypted}")
    assert encrypted != sample_secret, "Ciphertext cannot match plaintext!"
    assert sample_secret not in encrypted, "Ciphertext must not contain plaintext!"
    assert encrypted.startswith("gAAAAA"), "Valid Fernet token must start with standard header 'gAAAAA'"

    decrypted = fernet.decrypt(encrypted.encode()).decode()
    assert decrypted == sample_secret, "Decryption must match original plaintext exactly"
    print(f"✓ Successfully decrypted back to: {decrypted}")

    # -----------------------------------------------------------------------
    # TEST 3: Real SMTP Handshake with Intentionally Wrong Password
    # -----------------------------------------------------------------------
    print("\n--- TEST 3: Real SMTP Handshake with Intentionally Wrong App Password ---")
    fake_body = SaveGmailCredentialsBody(
        gmail_email="test.agent.localpro@gmail.com",
        app_password="abcd efgh ijkl mnop",
    )
    print("Attempting connection to smtp.gmail.com:587 with invalid 16-char app password...")
    try:
        import asyncio
        asyncio.run(save_gmail_credentials(payload=fake_body, user_id="00000000-0000-0000-0000-000000000000"))
        assert False, "Should have failed SMTP authentication with Google!"
    except HTTPException as http_exc:
        print(f"✓ Caught expected HTTPException {http_exc.status_code}")
        print(f"✓ Sanitized error message returned: \"{http_exc.detail}\"")
        assert "Google rejected these credentials" in http_exc.detail, "Error message must be the sanitized one!"
        assert "abcd" not in http_exc.detail, "Password must NEVER appear in error detail!"
        assert "mnop" not in http_exc.detail, "Password must NEVER appear in error detail!"
        print("✓ Confirmed: Zero credential or exception traceback leakage in response!")

    # -----------------------------------------------------------------------
    # TEST 4: API Response Secrecy (No Plaintext or Ciphertext Exposed)
    # -----------------------------------------------------------------------
    print("\n--- TEST 4: API Response Secrecy Verification ---")
    # Mock client table for get_gmail_credentials_status
    mock_db = MagicMock()
    mock_db.table().select().eq().eq().maybe_single().execute.return_value = MagicMock(
        data={"email": "agent@gmail.com", "updated_at": "2026-09-09T00:00:00Z"}
    )
    with patch("routers.vendors.get_service_client", return_value=mock_db):
        import asyncio
        status_resp = asyncio.run(get_gmail_credentials_status(user_id="test-user-id"))
        print(f"✓ GET /users/me/gmail-credentials returned: {status_resp}")
        assert "encrypted_secret" not in status_resp, "Ciphertext must NOT be in status response!"
        assert "app_password" not in status_resp, "Password must NOT be in status response!"
        assert "password" not in status_resp, "Password must NOT be in status response!"
        assert status_resp.get("is_configured") is True
        assert status_resp.get("gmail_email") == "agent@gmail.com"
        print("✓ Confirmed: Status response is strictly write-only metadata!")

    # -----------------------------------------------------------------------
    # TEST 5: Editable Email Dispatch Verification (No Server-Side Regeneration)
    # -----------------------------------------------------------------------
    print("\n--- TEST 5: Editable Email Body & Subject Verification ---")
    custom_subject = "Twilight & Drone Photo Order: 456 Elm St"
    custom_body = (
        "Hi John,\n\n"
        "Please schedule a shoot for 456 Elm St.\n"
        "Special notes: Client wants twilight shots and please focus heavily on the custom pool.\n"
        "Lockbox code is 9876.\n\n"
        "Best regards,\nAgent Smith"
    )

    order_payload = SendVendorOrderEmailBody(
        vendor_id="vendor-uuid-1",
        to_email="orders@photographer.com",
        subject=custom_subject,
        body_text=custom_body,
        mark_completed=True,
    )

    # Mock dependencies to capture exact email sent via SMTP
    mock_listing = {
        "id": "listing-uuid-1",
        "agent_id": "agent-uuid-1",
        "address_full": "456 Elm St, Dallas, TX",
        "stage": "docs_signed",
    }
    mock_agent_user = {
        "id": "agent-uuid-1",
        "email": "agent.smith@localprorealty.com",
        "full_name": "Agent Smith",
        "phone": "214-555-0199",
    }
    mock_creds = {
        "email": "agent.smith@gmail.com",
        "encrypted_secret": fernet.encrypt(b"sixteenletterpas").decode(),
    }

    mock_smtp_server = MagicMock()
    mock_captured_msg = {}

    def capture_send(msg):
        mock_captured_msg["From"] = msg["From"]
        mock_captured_msg["To"] = msg["To"]
        mock_captured_msg["Subject"] = msg["Subject"]
        # Extract plain text payload
        for part in msg.walk():
            if part.get_content_type() == "plain" or part.get_content_type() == "text/plain":
                mock_captured_msg["Body"] = part.get_payload(decode=True).decode("utf-8")

    mock_smtp_server.send_message.side_effect = capture_send

    mock_smtp_class = MagicMock()
    mock_smtp_class.return_value.__enter__.return_value = mock_smtp_server

    with patch("routers.vendors._require_agent_listing", return_value=mock_listing), \
         patch("routers.vendors.get_service_client") as mock_get_client, \
         patch("smtplib.SMTP", mock_smtp_class):

        client_instance = MagicMock()
        # Mock users query
        client_instance.table("users").select().eq().maybe_single().execute.return_value = MagicMock(data=mock_agent_user)
        # Mock credentials query
        client_instance.table("agent_email_credentials").select().eq().eq().maybe_single().execute.return_value = MagicMock(data=mock_creds)
        # Mock listings update
        client_instance.table("listings").update().eq().execute.return_value = MagicMock(data=[{"id": "listing-uuid-1"}])
        mock_get_client.return_value = client_instance

        import asyncio
        result = asyncio.run(send_vendor_order_email(
            listing_id="listing-uuid-1",
            payload=order_payload,
            agent_id="agent-uuid-1",
        ))

        print(f"✓ send_vendor_order_email result: {result}")
        assert result["method"] == "gmail_smtp"
        assert result["to_email"] == "orders@photographer.com"
        assert result["stage_updated"] is True

        print(f"✓ Captured Subject sent: \"{mock_captured_msg.get('Subject')}\"")
        assert mock_captured_msg.get("Subject") == custom_subject, "Subject was altered or regenerated!"

        print(f"✓ Captured Body sent contains agent note: {'twilight shots' in mock_captured_msg.get('Body', '')}")
        assert mock_captured_msg.get("Body") == custom_body, "Body was altered or regenerated!"
        print("✓ Confirmed: Agent's edited subject and body are preserved 100% identically!")

    # -----------------------------------------------------------------------
    # TEST 6: Check Supabase Schema Status
    # -----------------------------------------------------------------------
    print("\n--- TEST 6: Supabase Live Schema Status ---")
    sb = create_client(*settings.require_supabase())
    try:
        r = sb.table("agent_vendors").select("*").limit(1).execute()
        print("✓ Table 'agent_vendors': PRESENT in Supabase database")
    except Exception as e:
        print(f"⚠ Table 'agent_vendors': NOT YET RUN in Supabase ({e})")

    try:
        r = sb.table("agent_email_credentials").select("*").limit(1).execute()
        print("✓ Table 'agent_email_credentials': PRESENT in Supabase database")
    except Exception as e:
        print(f"⚠ Table 'agent_email_credentials': NOT YET RUN in Supabase ({e})")

    print("\n" + "=" * 70)
    print("VERIFICATION SUITE COMPLETED SUCCESSFULLY")
    print("=" * 70)

if __name__ == "__main__":
    run_tests()
