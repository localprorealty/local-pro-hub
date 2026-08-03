# backend/scripts/29_fix_angie_dual_role.py
import os
import sys
import json
import requests
from pathlib import Path

# Ensure config can be imported
sys.path.append(str(Path(__file__).resolve().parents[1]))

from config import get_settings

BASE_URI = os.environ.get("BROKERMINT_BASE_URI", "https://my.brokermint.com/api")
s = get_settings()
API_KEY = s.brokermint_api_key

TEST_AGENT_BM_ID = 183733  # Andrew Wetzel - using him, not Kevin, per established convention
SCHEMA_PATH = Path("/Users/adarshsonu/.gemini/antigravity-ide/brain/cb713577-2f6e-4648-a52b-ac5940c21da3/scratch/bm_dumps/openapi_schema_full.json")


def post(path, payload):
    resp = requests.post(f"{BASE_URI}{path}", params={"api_key": API_KEY}, json=payload, timeout=30)
    print(f"  POST {path}")
    print(f"  payload: {json.dumps(payload)}")
    print(f"  status: {resp.status_code}")
    print(f"  response: {resp.text[:800]}\n")
    return resp


def get_participants(txn_id):
    resp = requests.get(f"{BASE_URI}/v1/transactions/{txn_id}/participants",
                         params={"api_key": API_KEY}, timeout=30)
    data = resp.json() if resp.status_code == 200 else []
    andrew_entries = [p for p in data if str(p.get("id")) == str(TEST_AGENT_BM_ID) or "wetzel" in str(p.get("name", "")).lower() or str(p.get("user_id")) == str(TEST_AGENT_BM_ID)]
    print(f"  GET participants -> {len(andrew_entries)} entr{'y' if len(andrew_entries)==1 else 'ies'} for Andrew:")
    for e in andrew_entries:
        print(f"    {e}")
    print()
    return andrew_entries


def check_schema():
    print("=== STEP 1: Check saved schema for the real request body shape ===\n")
    if not SCHEMA_PATH.exists():
        print("  No saved schema found - skipping to live test.\n")
        return
    schema = json.loads(SCHEMA_PATH.read_text())
    path_key = "/v1/transactions/{transaction_id}/participants/users"
    endpoint = schema.get("paths", {}).get(path_key, {}).get("post")
    if not endpoint:
        print(f"  Endpoint {path_key} not found in saved schema - skipping to live test.\n")
        return
    print(f"  Found it. Full request body schema:")
    print(f"  {json.dumps(endpoint.get('requestBody', {}), indent=2)}\n")


def delete_transaction(txn_id):
    if not txn_id:
        return
    print(f"Cleaning up test transaction {txn_id}...")
    resp = requests.delete(f"{BASE_URI}/v1/transactions/{txn_id}", params={"api_key": API_KEY}, timeout=30)
    print(f"  DELETE status: {resp.status_code}")


def main():
    check_schema()

    txn_id = None
    txn2_id = None
    txn3_id = None

    try:
        print("=== STEP 2: Live test on one clearly-named test transaction ===\n")
        txn_resp = post("/v1/transactions", {
            "address": "123 Testing Ln", "city": "Dallas", "state": "TX", "zip": "75248",
            "transaction_name": "123 Testing - Developer (dual role fix)",
            "price": 350000, "transaction_type": "traditional sale",
            "status": "pending", "representing": "seller",
            "listing_side_representer": {"id": 15827, "type": "Account"}
        })
        if txn_resp.status_code >= 400:
            print("Transaction creation failed - stopping.")
            return
        txn_id = txn_resp.json().get("id")
        print(f"Created test transaction id: {txn_id}\n")

        print("--- A) Reproduce the known bug (two separate calls, singular 'role') ---")
        post(f"/v1/transactions/{txn_id}/participants/users",
             {"id": TEST_AGENT_BM_ID, "role": "office administrator"})
        post(f"/v1/transactions/{txn_id}/participants/users",
             {"id": TEST_AGENT_BM_ID, "role": "cda administrator"})
        get_participants(txn_id)

        print("--- B) Try 'roles' as an array in one call (on a fresh transaction) ---")
        txn2_resp = post("/v1/transactions", {
            "address": "123 Testing Ln", "city": "Dallas", "state": "TX", "zip": "75248",
            "transaction_name": "123 Testing - Developer (dual role fix B)",
            "price": 350000, "transaction_type": "traditional sale",
            "status": "pending", "representing": "seller",
            "listing_side_representer": {"id": 15827, "type": "Account"}
        })
        if txn2_resp.status_code < 400:
            txn2_id = txn2_resp.json().get("id")
            post(f"/v1/transactions/{txn2_id}/participants/users",
                 {"id": TEST_AGENT_BM_ID, "roles": ["office administrator", "cda administrator"]})
            get_participants(txn2_id)

        print("--- C) Try one combined comma-separated role string ---")
        txn3_resp = post("/v1/transactions", {
            "address": "123 Testing Ln", "city": "Dallas", "state": "TX", "zip": "75248",
            "transaction_name": "123 Testing - Developer (dual role fix C)",
            "price": 350000, "transaction_type": "traditional sale",
            "status": "pending", "representing": "seller",
            "listing_side_representer": {"id": 15827, "type": "Account"}
        })
        if txn3_resp.status_code < 400:
            txn3_id = txn3_resp.json().get("id")
            post(f"/v1/transactions/{txn3_id}/participants/users",
                 {"id": TEST_AGENT_BM_ID, "role": "office administrator, cda administrator"})
            get_participants(txn3_id)

    finally:
        print("\n=== STARTING TEARDOWN & CLEANUP ===")
        delete_transaction(txn_id)
        delete_transaction(txn2_id)
        delete_transaction(txn3_id)
        print("Teardown complete.")


if __name__ == "__main__":
    main()
