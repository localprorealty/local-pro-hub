import os
import json
import requests
from pathlib import Path
from config import get_settings

s = get_settings()
BASE_URI = os.environ.get("BROKERMINT_BASE_URI", "https://my.brokermint.com/api")
API_KEY = s.brokermint_api_key

TEST_AGENT_BM_ID = 183733  # Andrew Wetzel
TEST_TRANSACTION_NAME = "123 Testing - Developer"

OUT_DIR = Path(__file__).parent / "bm_dumps"
OUT_DIR.mkdir(exist_ok=True)


def post(path: str, payload: dict) -> requests.Response:
    resp = requests.post(
        f"{BASE_URI}{path}",
        params={"api_key": API_KEY},
        json=payload,
        timeout=30,
    )
    print(f"  POST {path}")
    print(f"  payload: {json.dumps(payload)}")
    print(f"  status: {resp.status_code}")
    print(f"  response: {resp.text[:1500]}")
    return resp


def get(path: str) -> requests.Response:
    resp = requests.get(f"{BASE_URI}{path}", params={"api_key": API_KEY}, timeout=30)
    print(f"  GET {path}")
    print(f"  status: {resp.status_code}")
    print(f"  response: {resp.text[:2000]}")
    return resp


def main():
    print("=== STEP 1: Create the test transaction ===")
    # Using Local Pro Realty LLC's BrokerMint Account ID (15827)
    create_payload = {
        "address": "123 Testing Ln",
        "city": "Dallas",
        "state": "TX",
        "zip": "75248",
        "price": 1234.0,
        "status": "pending",
        "transaction_name": TEST_TRANSACTION_NAME,
        "transaction_type": "traditional sale",
        "representing": "seller",
        "listing_side_representer": {"id": 15827, "type": "Account"},
        "buying_side_representer": None,
    }
    resp = post("/v1/transactions", create_payload)
    if resp.status_code >= 400:
        print("\n  Transaction creation failed with this payload shape.")
        return

    txn = resp.json()
    txn_id = txn.get("id")
    print(f"\n  Created transaction id: {txn_id}\n")

    print("=== STEP 2: Attach Andrew Wetzel as a participant/contact ===")
    # Using the correct endpoint and payload format for user participants
    participant_payload = {
        "id": TEST_AGENT_BM_ID,
        "role": "Agent",
        "owner": True
    }
    post(f"/v1/transactions/{txn_id}/participants/users", participant_payload)

    print("\n=== STEP 3: Re-fetch the transaction, look for auto-attached checklist ===")
    get(f"/v1/transactions/{txn_id}")

    print("\n=== STEP 4: List available checklist templates (read-only) ===")
    # Corrected endpoint based on schema: /v1/transactions/checklist_templates
    get("/v1/transactions/checklist_templates")

    print("\n=== STEP 5: Check the transaction's checklists and documents ===")
    get(f"/v1/transactions/{txn_id}/checklists")
    get(f"/v1/transactions/{txn_id}/documents")

    print("\n\nDone.")
    print(f"\nManually check in the BrokerMint UI too: search for")
    print(f"'{TEST_TRANSACTION_NAME}' under Andrew Wetzel to see it visually.")


if __name__ == "__main__":
    main()
