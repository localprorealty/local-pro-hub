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
LISTING_CHECKLIST_TEMPLATE_ID = 3301356  # "Listing", found in the last run

# Placeholder buyer/seller data - swap these for whatever you'd rather use,
# these are just clearly-fake test values.
SELLER = {"name": "Test Seller", "email": "seller-test@localprorealty.com", "phone": "5555550001"}
BUYER = {"name": "Test Buyer", "email": "buyer-test@localprorealty.com", "phone": "5555550002"}

OUT_DIR = Path(__file__).parent.parent / "bm_dumps"
OUT_DIR.mkdir(exist_ok=True)


def post(path: str, payload: dict) -> requests.Response:
    resp = requests.post(f"{BASE_URI}{path}", params={"api_key": API_KEY}, json=payload, timeout=30)
    print(f"  POST {path}")
    print(f"  payload: {json.dumps(payload)}")
    print(f"  status: {resp.status_code}")
    print(f"  response: {resp.text[:2000]}\n")
    return resp


def get(path: str) -> requests.Response:
    resp = requests.get(f"{BASE_URI}{path}", params={"api_key": API_KEY}, timeout=30)
    print(f"  GET {path}")
    print(f"  status: {resp.status_code}")
    print(f"  response: {resp.text[:2000]}\n")
    return resp


def main():
    print("=== STEP 1: Create transaction with real client custom fields ===")
    # Adjusted with required side representers to prevent 400 validation error
    create_payload = {
        "address": "123 Testing Ln",
        "city": "Dallas",
        "state": "TX",
        "zip": "75248",
        "transaction_name": TEST_TRANSACTION_NAME,
        "price": 350000,
        "transaction_type": "traditional sale",
        "status": "pending",
        "representing": "seller",
        "listing_side_representer": {"id": 15827, "type": "Account"},
        "buying_side_representer": None,
        # Machine-key custom fields discovered in the last run - adjust if
        # a Client 2 equivalent turns out to have a different key, check
        # the response from this call to confirm.
        "f458183117": SELLER["name"],       # Client 1 Name
        "f770006910": SELLER["email"],      # Client 1 Email
        "f426667625": SELLER["phone"],      # Client 1 Phone
    }
    resp = post("/v1/transactions", create_payload)
    if resp.status_code >= 400:
        print("Transaction creation failed - stopping here, check the payload above.")
        return
    txn = resp.json()
    txn_id = txn.get("id")
    print(f"CREATED TRANSACTION ID: {txn_id}\n")

    print("=== STEP 2: Check who BrokerMint already added as participants ===")
    get(f"/v1/transactions/{txn_id}/participants")
    print("^ Look above: did Tricia / Angie Smith (x2 roles) / Local Pro Realty")
    print("  already appear here, without us adding them? That answers the")
    print("  'are default participants automatic' question.\n")

    print("=== STEP 3: Add Andrew Wetzel as the agent/seller-side participant ===")
    # Using correct ID and schema format for users
    post(f"/v1/transactions/{txn_id}/participants/users", {
        "id": TEST_AGENT_BM_ID,
        "role": "Agent",
        "owner": True
    })

    print("=== STEP 4: Apply the Listing checklist ===")
    # Using correct key: checklist_template_id
    post(f"/v1/transactions/{txn_id}/checklists", {"checklist_template_id": LISTING_CHECKLIST_TEMPLATE_ID})

    print("\n=== STEP 5: Final participant list, for reference ===")
    get(f"/v1/transactions/{txn_id}/participants")

    print(f"\n\n>>> GO CHECK THIS IN THE UI: search '{TEST_TRANSACTION_NAME}' under")
    print(f">>> Andrew Wetzel, transaction id {txn_id}. Open a checklist task,")
    print(f">>> click 'Use forms', attach IABS or Listing Agreement, and look")
    print(f">>> at whether the fields are pre-filled or blank. That's the real test.")


if __name__ == "__main__":
    main()
