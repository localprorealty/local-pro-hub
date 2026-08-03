import os
import json
import requests
from pathlib import Path
from config import get_settings

s = get_settings()
BASE_URI = os.environ.get("BROKERMINT_BASE_URI", "https://my.brokermint.com/api")
API_KEY = s.brokermint_api_key

TEST_AGENT_BM_ID = 183733  # Andrew Wetzel


def post(path, payload):
    resp = requests.post(f"{BASE_URI}{path}", params={"api_key": API_KEY}, json=payload, timeout=30)
    print(f"  POST {path} -> {resp.status_code}")
    print(f"  {resp.text[:1200]}\n")
    return resp


def get(path):
    resp = requests.get(f"{BASE_URI}{path}", params={"api_key": API_KEY}, timeout=30)
    print(f"  GET {path} -> {resp.status_code}")
    print(f"  {resp.text[:1500]}\n")
    return resp


def base_fields(name):
    # Added listing_side_representer to prevent 400 validation error
    return {
        "address": "123 Testing Ln", "city": "Dallas", "state": "TX", "zip": "75248",
        "transaction_name": name, "price": 350000,
        "transaction_type": "traditional sale", "status": "pending", "representing": "seller",
        "listing_side_representer": {"id": 15827, "type": "Account"},
        "buying_side_representer": None,
    }


def main():
    print("=== TRANSACTION A: flat shorthand for dropdown fields (reproducing the bug) ===")
    payload_a = base_fields("123 Testing - Developer A (flat)")
    payload_a.update({
        "property_type": "Single family",
        "lockbox": "Yes",
        "yard_sign": "Yes",
    })
    resp_a = post("/v1/transactions", payload_a)
    txn_a_id = resp_a.json().get("id") if resp_a.status_code < 400 else None
    if txn_a_id:
        post(f"/v1/transactions/{txn_a_id}/participants/users", {"id": TEST_AGENT_BM_ID, "role": "Agent", "owner": True})
        get(f"/v1/transactions/{txn_a_id}")

    print("\n=== TRANSACTION B: full structured shape for dropdown fields ===")
    payload_b = base_fields("123 Testing - Developer B (structured)")
    payload_b["custom_attributes"] = [
        {
            "type": "dropdown", "label": "Property type", "name": "property_type",
            "value": "Single family",
            "options": ["Not specified", "Apartment", "Commercial", "Condo", "Duplex",
                        "Farm", "Land", "Manufactured", "Mobile", "Multi unit",
                        "Rentals", "Single family", "Townhouse", "Other"],
        },
        {
            "type": "dropdown", "label": "Lockbox", "name": "lockbox",
            "value": "Yes", "options": ["Yes", "No"],
        },
        {
            "type": "dropdown", "label": "Yard sign", "name": "yard_sign",
            "value": "Yes", "options": ["Yes", "No"],
        },
    ]
    resp_b = post("/v1/transactions", payload_b)
    txn_b_id = resp_b.json().get("id") if resp_b.status_code < 400 else None
    if txn_b_id:
        post(f"/v1/transactions/{txn_b_id}/participants/users", {"id": TEST_AGENT_BM_ID, "role": "Agent", "owner": True})
        get(f"/v1/transactions/{txn_b_id}")

    print(f"\n\n>>> Transaction A id: {txn_a_id} (flat shorthand)")
    print(f">>> Transaction B id: {txn_b_id} (structured)")
    print(">>> Go to each in the UI, click Documents > Add Checklists on both.")
    print(">>> Report back: does A crash/show empty, does B work correctly?")
    print(">>> That answers whether the write shape is really the cause.")


if __name__ == "__main__":
    main()
