import os
import json
import requests
from config import get_settings

s = get_settings()
BASE_URI = os.environ.get("BROKERMINT_BASE_URI", "https://my.brokermint.com/api")
API_KEY = s.brokermint_api_key


def post(path, payload):
    resp = requests.post(f"{BASE_URI}{path}", params={"api_key": API_KEY}, json=payload, timeout=30)
    print(f"  POST {path} -> {resp.status_code}")
    return resp


def get(path):
    resp = requests.get(f"{BASE_URI}{path}", params={"api_key": API_KEY}, timeout=30)
    print(f"  GET {path} -> {resp.status_code}")
    return resp


def delete(path):
    resp = requests.delete(f"{BASE_URI}{path}", params={"api_key": API_KEY}, timeout=30)
    print(f"  DELETE {path} -> {resp.status_code}")
    return resp


def main():
    print("=== STEP 1: Create transaction with transaction_type = 'rent/lease' ===")
    payload = {
        "address": "123 Rent Test Ln",
        "city": "Dallas",
        "state": "TX",
        "zip": "75248",
        "transaction_name": "123 Rent Test - Lease Type Test",
        "price": 2500,
        "transaction_type": "rent/lease",
        "status": "pending",
        "representing": "seller",
        "listing_side_representer": {"id": 15827, "type": "Account"},
        "buying_side_representer": None
    }
    
    resp = post("/v1/transactions", payload)
    if resp.status_code >= 400:
        print(f"Failed to create transaction: {resp.text}")
        return
        
    data = resp.json()
    txn_id = data.get("id")
    print(f"Created Transaction ID: {txn_id}")
    print(f"Created response transaction_type: {data.get('transaction_type')!r}")
    
    print("\n=== STEP 2: GET transaction back and verify transaction_type ===")
    get_resp = get(f"/v1/transactions/{txn_id}")
    if get_resp.status_code == 200:
        get_data = get_resp.json()
        print(f"Stored transaction_type in BrokerMint: {get_data.get('transaction_type')!r}")
    else:
        print(f"Failed to fetch transaction: {get_resp.text}")
        
    print("\n=== STEP 3: Cleanup (delete test transaction) ===")
    delete(f"/v1/transactions/{txn_id}")


if __name__ == "__main__":
    main()
