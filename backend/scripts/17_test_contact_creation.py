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

OUT_DIR = Path(__file__).parent.parent / "bm_dumps"
SCHEMA_PATH = OUT_DIR / "openapi_schema_full.json"

SELLER = {"first_name": "Test", "last_name": "Seller", "email": "seller-test@localprorealty.com", "phone": "5555550001"}
BUYER = {"first_name": "Test", "last_name": "Buyer", "email": "buyer-test@localprorealty.com", "phone": "5555550002"}


def post(path: str, payload: dict) -> requests.Response:
    resp = requests.post(f"{BASE_URI}{path}", params={"api_key": API_KEY}, json=payload, timeout=30)
    print(f"  POST {path}")
    print(f"  payload: {json.dumps(payload)}")
    print(f"  status: {resp.status_code}")
    print(f"  response: {resp.text[:1500]}\n")
    return resp


def get(path: str) -> requests.Response:
    resp = requests.get(f"{BASE_URI}{path}", params={"api_key": API_KEY}, timeout=30)
    print(f"  GET {path}")
    print(f"  status: {resp.status_code}")
    print(f"  response: {resp.text[:1500]}\n")
    return resp


def find_contact_endpoints_in_schema():
    # If the schema exists in scratch directory, let's load it
    scratch_schema_path = Path("/Users/adarshsonu/.gemini/antigravity-ide/brain/cb713577-2f6e-4648-a52b-ac5940c21da3/scratch/bm_dumps/openapi_schema_full.json")
    if scratch_schema_path.exists():
        schema = json.loads(scratch_schema_path.read_text())
    elif SCHEMA_PATH.exists():
        schema = json.loads(SCHEMA_PATH.read_text())
    else:
        print("  No saved schema found - re-fetching from BrokerMint...")
        resp = requests.get(f"{BASE_URI.replace('/api', '')}/api_docs/content", timeout=30)
        resp.raise_for_status()
        schema = resp.json()
        SCHEMA_PATH.parent.mkdir(exist_ok=True)
        SCHEMA_PATH.write_text(json.dumps(schema, indent=2))

    matches = [p for p in schema.get("paths", {}) if "contact" in p.lower()]
    print(f"  Endpoints containing 'contact': {matches}")
    for p in matches:
        for method, detail in schema["paths"][p].items():
            print(f"    {method.upper()} {p}: {detail.get('summary', '')}")
    return matches


def main():
    print("=== STEP 1: Search schema for contact-related endpoints ===")
    find_contact_endpoints_in_schema()

    print("\n=== STEP 2: Create the test transaction ===")
    # Added side representers to satisfy validation rules
    txn_resp = post("/v1/transactions", {
        "address": "123 Testing Ln", "city": "Dallas", "state": "TX", "zip": "75248",
        "transaction_name": TEST_TRANSACTION_NAME, "price": 350000,
        "transaction_type": "traditional sale", "status": "pending", "representing": "seller",
        "listing_side_representer": {"id": 15827, "type": "Account"},
        "buying_side_representer": None,
    })
    if txn_resp.status_code >= 400:
        print("Transaction creation failed - stopping.")
        return
    txn_id = txn_resp.json().get("id")
    print(f"CREATED TRANSACTION ID: {txn_id}\n")

    print("=== STEP 3: Attempt to create Contacts ===")
    seller_resp = post("/v1/contacts", SELLER)
    buyer_resp = post("/v1/contacts", BUYER)

    seller_id = seller_resp.json().get("id") if seller_resp.status_code < 400 else None
    buyer_id = buyer_resp.json().get("id") if buyer_resp.status_code < 400 else None

    print("=== STEP 4: Attempt to attach Contacts to the transaction ===")
    # Using 'id' instead of 'contact_id' in payload
    if seller_id:
        post(f"/v1/transactions/{txn_id}/participants/contacts", {"id": seller_id, "role": "seller"})
    if buyer_id:
        post(f"/v1/transactions/{txn_id}/participants/contacts", {"id": buyer_id, "role": "buyer"})

    print("=== STEP 5: Also attach Andrew Wetzel as agent, same as before ===")
    # Using 'id' instead of 'user_id' in payload
    post(f"/v1/transactions/{txn_id}/participants/users", {"id": TEST_AGENT_BM_ID, "role": "Agent", "owner": True})

    print("\n=== STEP 6: Final participant list ===")
    get(f"/v1/transactions/{txn_id}/participants")

    print(f"\n>>> Now go check in the UI: transaction id {txn_id}, open a document,")
    print(f">>> click 'Send for eSign', and confirm the buyer/seller show up as")
    print(f">>> themselves (Test Buyer / Test Seller) rather than defaulting to")
    print(f">>> someone else. That's the real proof this worked.")


if __name__ == "__main__":
    main()
