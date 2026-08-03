import os
import json
import requests
from pathlib import Path
from config import get_settings

s = get_settings()
BASE_URI = os.environ.get("BROKERMINT_BASE_URI", "https://my.brokermint.com/api")
API_KEY = s.brokermint_api_key

OUT_DIR = Path(__file__).parent.parent / "bm_dumps"
OUT_DIR.mkdir(exist_ok=True)
# Point to schema in scratch directory since that is where it was saved in Script 14
SCHEMA_PATH = Path("/Users/adarshsonu/.gemini/antigravity-ide/brain/cb713577-2f6e-4648-a52b-ac5940c21da3/scratch/bm_dumps/openapi_schema_full.json")

# Setting REAL_TXN_ID to a real transaction from our database query to fetch actual fields
REAL_TXN_ID = 2583061


def try_get(path: str):
    resp = requests.get(f"{BASE_URI}{path}", params={"api_key": API_KEY}, timeout=30)
    print(f"  GET {path} -> status {resp.status_code}")
    if resp.status_code == 200:
        print(f"  {resp.text[:2000]}\n")
    return resp


def main():
    print("=== APPROACH 1: Dedicated transaction custom-fields endpoint ===")
    candidates = [
        "/v2/accounts/settings/account_transaction_fields",
        "/v1/accounts/settings/account_transaction_fields",
        "/v1/transaction_fields",
        "/v2/transaction_fields",
    ]
    for path in candidates:
        try_get(path)

    print("\n=== APPROACH 2: Parse Transaction model from saved OpenAPI schema ===")
    # Fallback to local sibling if scratch not found
    local_schema = Path(__file__).parent.parent / "bm_dumps" / "openapi_schema_full.json"
    schema_to_use = SCHEMA_PATH if SCHEMA_PATH.exists() else local_schema
    
    if schema_to_use.exists():
        schema = json.loads(schema_to_use.read_text())
        components = schema.get("components", {}).get("schemas", {})
        txn_schema_keys = [k for k in components if "transaction" in k.lower()]
        print(f"  Schema definitions with 'transaction' in the name: {txn_schema_keys}")
        for k in txn_schema_keys:
            props = components[k].get("properties", {})
            print(f"\n  --- {k} ({len(props)} fields) ---")
            for field_name in sorted(props.keys()):
                print(f"    {field_name}")
    else:
        print(f"  No saved schema found at {SCHEMA_PATH} or {local_schema}.")

    print("\n=== APPROACH 3: Live field keys from a real transaction ===")
    if REAL_TXN_ID:
        resp = try_get(f"/v1/transactions/{REAL_TXN_ID}")
        if resp.status_code == 200:
            data = resp.json()
            print(f"  All field keys present on this real transaction:")
            for key in sorted(data.keys()):
                print(f"    {key}: {data[key]!r}")
    else:
        print("  REAL_TXN_ID not set.")


if __name__ == "__main__":
    main()
