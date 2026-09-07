import asyncio
import hashlib
import hmac
import json
import os
import sys
import time
from pathlib import Path

# Add backend directory to path
sys.path.append(str(Path(__file__).resolve().parents[1]))

import httpx
from config import get_settings
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

TEST_SECRET = "bm_test_webhook_secret_abc123"
TEST_CRON_SECRET = "5b983bfafb83022c5daa0bb02ccf61bc6f8dbcb3d1078f5a"

# Set environment variables for test
os.environ["BROKERMINT_WEBHOOK_SECRET"] = TEST_SECRET
os.environ["CRON_SECRET"] = TEST_CRON_SECRET

def sign_payload(payload_bytes: bytes, secret: str = TEST_SECRET) -> str:
    return hmac.new(secret.encode("utf-8"), payload_bytes, hashlib.sha256).hexdigest()

def test_cron_endpoint_auth():
    print("\n--- 1. CRON ENDPOINT AUTHENTICATION TEST ---")
    
    # Test 1a: Invalid X-Cron-Secret
    resp_invalid = client.post("/brokermint/sync", headers={"X-Cron-Secret": "wrong-secret"})
    print(f"POST /brokermint/sync [Invalid Secret] -> Status: {resp_invalid.status_code}")
    print(f"Response: {resp_invalid.json()}")
    assert resp_invalid.status_code == 401, f"Expected 401, got {resp_invalid.status_code}"
    print("✓ Invalid X-Cron-Secret rejected with 401 Unauthorized")

    # Test 1b: Missing X-Cron-Secret and missing Bearer token
    resp_missing = client.post("/brokermint/sync")
    print(f"POST /brokermint/sync [Missing Auth] -> Status: {resp_missing.status_code}")
    print(f"Response: {resp_missing.json()}")
    assert resp_missing.status_code == 401, f"Expected 401, got {resp_missing.status_code}"
    print("✓ Missing auth rejected with 401 Unauthorized")

    # Test 1c: Valid X-Cron-Secret (mock add_task to prevent running 5.5-minute sync)
    from unittest.mock import patch
    with patch("fastapi.BackgroundTasks.add_task") as mock_add_task:
        resp_valid = client.post("/brokermint/sync", headers={"X-Cron-Secret": TEST_CRON_SECRET})
        print(f"POST /brokermint/sync [Valid Secret] -> Status: {resp_valid.status_code}")
        print(f"Response: {resp_valid.json()}")
        assert resp_valid.status_code == 200, f"Expected 200, got {resp_valid.status_code}"
        assert resp_valid.json().get("triggered_by") == "cron"
        assert mock_add_task.called, "Expected background_tasks.add_task to be called"
        print("✓ Valid X-Cron-Secret successfully authenticated as triggered_by='cron' and background task enqueued")


def test_webhook_signature_verification():
    print("\n--- 2. WEBHOOK SIGNATURE VERIFICATION TEST ---")
    payload = {
        "event_id": "test-signature-check-1",
        "event": "transaction.updated",
        "data": {"id": "test_txn_99999"}
    }
    payload_bytes = json.dumps(payload).encode("utf-8")
    valid_sig = sign_payload(payload_bytes, TEST_SECRET)
    tampered_sig = "a" * 64

    # Test 2a: Missing signature header
    resp_missing = client.post("/webhooks/brokermint", content=payload_bytes, headers={"Content-Type": "application/json"})
    print(f"POST /webhooks/brokermint [Missing Signature] -> Status: {resp_missing.status_code}")
    print(f"Response: {resp_missing.json()}")
    assert resp_missing.status_code == 401, f"Expected 401, got {resp_missing.status_code}"
    print("✓ Missing signature header rejected with 401 Unauthorized")

    # Test 2b: Tampered / incorrect signature header
    resp_tampered = client.post(
        "/webhooks/brokermint",
        content=payload_bytes,
        headers={
            "Content-Type": "application/json",
            "X-Brokermint-Webhook-Signature": tampered_sig
        }
    )
    print(f"POST /webhooks/brokermint [Tampered Signature] -> Status: {resp_tampered.status_code}")
    print(f"Response: {resp_tampered.json()}")
    assert resp_tampered.status_code == 401, f"Expected 401, got {resp_tampered.status_code}"
    print("✓ Tampered signature header rejected with 401 Unauthorized")

    # Test 2c: Wrong secret
    wrong_secret_sig = sign_payload(payload_bytes, "different_secret_123")
    resp_wrong_secret = client.post(
        "/webhooks/brokermint",
        content=payload_bytes,
        headers={
            "Content-Type": "application/json",
            "X-Brokermint-Webhook-Signature": wrong_secret_sig
        }
    )
    print(f"POST /webhooks/brokermint [Wrong Secret] -> Status: {resp_wrong_secret.status_code}")
    print(f"Response: {resp_wrong_secret.json()}")
    assert resp_wrong_secret.status_code == 401, f"Expected 401, got {resp_wrong_secret.status_code}"
    print("✓ Wrong secret signature rejected with 401 Unauthorized")


def test_webhook_500_failure_simulation():
    print("\n--- 3. WEBHOOK 5XX FAILURE SIMULATION TEST (TRIGGERS BROKERMINT RETRY) ---")
    # Send an event with an invalid non-existent transaction that raises an error or simulated failure
    payload = {
        "event_id": f"sim-fail-{int(time.time())}",
        "event": "transaction.deleted",
        # no id in data to force ValueError in synchronous handler
        "data": {}
    }
    payload_bytes = json.dumps(payload).encode("utf-8")
    sig = sign_payload(payload_bytes)

    t0 = time.perf_counter()
    resp = client.post(
        "/webhooks/brokermint",
        content=payload_bytes,
        headers={
            "Content-Type": "application/json",
            "X-Brokermint-Webhook-Signature": sig
        }
    )
    elapsed_ms = (time.perf_counter() - t0) * 1000
    print(f"POST /webhooks/brokermint [Simulated Failure] -> Status: {resp.status_code} in {elapsed_ms:.1f}ms")
    print(f"Response: {resp.json()}")
    assert resp.status_code == 500, f"Expected 500, got {resp.status_code}"
    print(f"✓ Synchronous failure returned HTTP 500 in {elapsed_ms:.1f}ms (BrokerMint retry will trigger)")


def test_schema_status():
    print("\n--- 4. SUPABASE SCHEMA STATUS CHECK ---")
    from deps.auth import get_service_client
    supabase = get_service_client()

    print("Checking bm_webhook_events_log table...")
    res = supabase.table("bm_webhook_events_log").select("id").limit(1).execute()
    print("  ✓ bm_webhook_events_log table EXISTS")

    print("Checking bm_sync_log.triggered_by column...")
    res = supabase.table("bm_sync_log").select("triggered_by").limit(1).execute()
    print("  ✓ bm_sync_log.triggered_by column EXISTS")

    print("Checking bm_transactions.deleted_at column...")
    res = supabase.table("bm_transactions").select("deleted_at").limit(1).execute()
    print("  ✓ bm_transactions.deleted_at column EXISTS")


def test_webhook_idempotency_and_soft_delete():
    print("\n--- 5. LIVE IDEMPOTENCY & TRANSACTION.DELETED SOFT-DELETE TEST ---")
    from deps.auth import get_service_client
    supabase = get_service_client()

    # Step A: Insert a temporary test transaction in bm_transactions
    test_bm_id = f"test_hook_{int(time.time())}"
    supabase.table("bm_transactions").insert({
        "bm_id": test_bm_id,
        "address": "999 Webhook Test Way",
        "city": "Dallas",
        "state": "TX",
        "zip": "75201",
        "status": "active",
        "price": 450000.0,
    }).execute()
    print(f"Created temporary test transaction bm_id: {test_bm_id}")

    test_event_id = f"evt_test_{int(time.time())}"
    del_payload = {
        "event_id": test_event_id,
        "event": "transaction.deleted",
        "data": {"id": test_bm_id}
    }
    payload_bytes = json.dumps(del_payload).encode("utf-8")
    sig = sign_payload(payload_bytes)

    # Step B: Send transaction.deleted event (First Time)
    t0 = time.perf_counter()
    resp1 = client.post(
        "/webhooks/brokermint",
        content=payload_bytes,
        headers={
            "Content-Type": "application/json",
            "X-Brokermint-Webhook-Signature": sig
        }
    )
    elapsed_ms = (time.perf_counter() - t0) * 1000
    print(f"POST /webhooks/brokermint [1st send] -> Status: {resp1.status_code} in {elapsed_ms:.1f}ms")
    print(f"Response: {resp1.json()}")
    assert resp1.status_code == 200, f"Expected 200, got {resp1.status_code}"
    assert resp1.json().get("status") == "processed"
    print(f"✓ 1st delivery processed synchronously in {elapsed_ms:.1f}ms")

    # Verify transaction was soft-deleted in bm_transactions
    row_check = supabase.table("bm_transactions").select("id, bm_id, status, deleted_at").eq("bm_id", test_bm_id).execute()
    txn_row = row_check.data[0]
    print(f"Post-event transaction state: status={txn_row.get('status')}, deleted_at={txn_row.get('deleted_at')}")
    assert txn_row.get("status") == "cancelled", "Expected status to be 'cancelled'"
    assert txn_row.get("deleted_at") is not None, "Expected deleted_at to be populated"
    print("✓ Transaction soft-delete confirmed (deleted_at populated, status='cancelled')")

    # Verify event logged in bm_webhook_events_log
    log_check = supabase.table("bm_webhook_events_log").select("event_id, status, processed_at").eq("event_id", test_event_id).execute()
    assert log_check.data and log_check.data[0].get("status") == "processed"
    print("✓ Webhook event logged in bm_webhook_events_log with status='processed'")

    # Step C: Send EXACT same event again (Idempotency Test)
    t1 = time.perf_counter()
    resp2 = client.post(
        "/webhooks/brokermint",
        content=payload_bytes,
        headers={
            "Content-Type": "application/json",
            "X-Brokermint-Webhook-Signature": sig
        }
    )
    elapsed_idempotent_ms = (time.perf_counter() - t1) * 1000
    print(f"POST /webhooks/brokermint [2nd send - Idempotency] -> Status: {resp2.status_code} in {elapsed_idempotent_ms:.1f}ms")
    print(f"Response: {resp2.json()}")
    assert resp2.status_code == 200, f"Expected 200, got {resp2.status_code}"
    assert resp2.json().get("status") == "already_processed"
    print(f"✓ Idempotency confirmed: returned 'already_processed' in {elapsed_idempotent_ms:.1f}ms with 0 reprocessing")

    # Step D: Cleanup test transaction and test event
    print("\n--- 6. CLEANUP TEST DATA ---")
    supabase.table("bm_transactions").delete().eq("bm_id", test_bm_id).execute()
    supabase.table("bm_webhook_events_log").delete().eq("event_id", test_event_id).execute()
    
    # Confirm deletion
    txn_after = supabase.table("bm_transactions").select("id").eq("bm_id", test_bm_id).execute()
    evt_after = supabase.table("bm_webhook_events_log").select("id").eq("event_id", test_event_id).execute()
    assert len(txn_after.data or []) == 0, "Test transaction cleanup failed"
    assert len(evt_after.data or []) == 0, "Test event log cleanup failed"
    print(f"✓ Cleaned up test transaction ({test_bm_id}) and event log ({test_event_id}) successfully")


if __name__ == "__main__":
    print("==================================================")
    print("STARTING TEST SUITE: WEBHOOKS & SYNC HEALTH")
    print("==================================================")
    test_cron_endpoint_auth()
    test_webhook_signature_verification()
    test_webhook_500_failure_simulation()
    test_schema_status()
    test_webhook_idempotency_and_soft_delete()
    print("\n==================================================")
    print("ALL VERIFICATION TESTS COMPLETED AND PASSED!")
    print("==================================================")
