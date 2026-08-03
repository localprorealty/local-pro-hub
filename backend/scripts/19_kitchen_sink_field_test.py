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
OUT_DIR.mkdir(exist_ok=True)


def post(path, payload):
    resp = requests.post(f"{BASE_URI}{path}", params={"api_key": API_KEY}, json=payload, timeout=30)
    print(f"  POST {path} -> {resp.status_code}")
    print(f"  {resp.text[:1500]}\n")
    return resp


def get(path):
    resp = requests.get(f"{BASE_URI}{path}", params={"api_key": API_KEY}, timeout=30)
    print(f"  GET {path} -> {resp.status_code}")
    return resp


def main():
    print("=== STEP 1: Create real Contacts for buyer/seller first ===")
    seller_resp = post("/v1/contacts", {"first_name": "Test", "last_name": "Seller",
                                          "email": "seller-test@localprorealty.com", "phone": "5555550001"})
    buyer_resp = post("/v1/contacts", {"first_name": "Test", "last_name": "Buyer",
                                         "email": "buyer-test@localprorealty.com", "phone": "5555550002"})
    seller_contact_id = seller_resp.json().get("id") if seller_resp.status_code < 400 else None
    buyer_contact_id = buyer_resp.json().get("id") if buyer_resp.status_code < 400 else None

    print("=== STEP 2: Create the transaction with EVERY candidate field filled ===")
    
    # 13-digit Unix timestamps for date fields
    listing_date_ts = 1782864000000       # 2026-07-01
    expiration_date_ts = 1798675200000    # 2026-12-31
    acceptance_date_ts = 1784073600000    # 2026-07-15
    closing_date_ts = 1788048000000       # 2026-08-30
    buyer_agreement_ts = 1782864000000    # 2026-07-01
    buyer_expiration_ts = 1798675200000   # 2026-12-31

    create_payload = {
        "address": "123 Testing Ln", 
        "city": "Dallas", 
        "state": "TX", 
        "zip": "75248",
        "transaction_name": TEST_TRANSACTION_NAME,
        "price": 350000,
        "transaction_type": "traditional sale",
        "status": "pending",
        "representing": "both",
        "listing_date": listing_date_ts,
        "expiration_date": expiration_date_ts,
        "acceptance_date": acceptance_date_ts,
        "closing_date": closing_date_ts,
        "buyer_agreement_date": buyer_agreement_ts,
        "buyer_expiration_date": buyer_expiration_ts,
        # Listing represented by Local Pro Realty (Account ID 15827), buying represented by the contact
        "listing_side_representer": {"id": 15827, "type": "Account"},
        "buying_side_representer": {"id": buyer_contact_id, "type": "Contact"} if buyer_contact_id else None,
        # Structuring custom fields as custom_attributes list as required by BrokerMint's API
        "custom_attributes": [
            {"name": "lead_source", "value": "Other"},
            {"name": "f458183117", "value": "Test Seller"},
            {"name": "f770006910", "value": "seller-test@localprorealty.com"},
            {"name": "f426667625", "value": "5555550001"},
            {"name": "f723452543", "value": "Test Buyer"},
            {"name": "f871885828", "value": "5555550002"},
            {"name": "f610534092", "value": "buyer-test@localprorealty.com"},
            {"name": "mls_number", "value": "TEST123456"},
            {"name": "county", "value": "Dallas"},
            {"name": "property_type", "value": "Single family"},
            {"name": "area", "value": "Test Area"},
            {"name": "public_remarks", "value": "Test remarks"},
            {"name": "building_sqft", "value": "2000"},
            {"name": "lot_sqft", "value": "5000"},
            {"name": "zoning", "value": "Residential"},
            {"name": "bedrooms", "value": "3"},
            {"name": "full_baths", "value": "2"},
            {"name": "half_baths", "value": "1"},
            {"name": "showing_instructions", "value": "Test instructions"},
            {"name": "show_appt", "value": "Test"},
            {"name": "description", "value": "Test description"},
            {"name": "legal_description", "value": "Test legal"},
            {"name": "apn", "value": "TEST-APN"},
            {"name": "sqft", "value": "2000"},
            {"name": "tenant", "value": "Test tenant"},
            {"name": "lockbox", "value": "Yes"},
            {"name": "yard_sign", "value": "Yes"},
            {"name": "escrow_number", "value": "TEST-ESCROW"},
            {"name": "monies_received_from", "value": "Test"},
            {"name": "amount_received", "value": "1000"},
            {"name": "date_received", "value": "2026-07-01"},
            {"name": "date_deposited", "value": "2026-07-02"},
            {"name": "date_released", "value": "2026-07-03"},
            {"name": "amount_released", "value": "1000"},
        ]
    }
    resp = post("/v1/transactions", create_payload)
    if resp.status_code >= 400:
        print("Creation failed - check which field caused it, remove/fix and re-run.")
        return
    txn_id = resp.json().get("id")
    print(f"CREATED TRANSACTION ID: {txn_id}\n")

    print("=== STEP 3: Attach Andrew Wetzel as agent ===")
    post(f"/v1/transactions/{txn_id}/participants/users", {"id": TEST_AGENT_BM_ID, "role": "Agent", "owner": True})

    print("\n=== STEP 4: Re-fetch the FULL raw transaction - this is the real answer ===")
    final = get(f"/v1/transactions/{txn_id}")
    data = final.json()
    out_path = OUT_DIR / f"kitchen_sink_transaction_{txn_id}.json"
    out_path.write_text(json.dumps(data, indent=2))
    print(f"\nFull response saved to {out_path}")
    print("\nPaste the ENTIRE raw content of that file back - every key, every")
    print("custom_attributes entry - so we can see exactly which of the fields")
    print("we tried to set actually landed vs got silently dropped or rejected.")
    print(f"\n>>> Then go check the UI: transaction id {txn_id}, confirm 'Buyer")
    print(f">>> agreement date' / 'Buyer expiration date' now show real dates")
    print(f">>> (proving they're representing-dependent), and check whether the")
    print(f">>> buyer/seller resolve correctly for e-sign now that representer")
    print(f">>> fields point directly at real Contacts too.")


if __name__ == "__main__":
    main()
