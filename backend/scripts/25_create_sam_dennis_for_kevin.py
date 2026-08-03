import os
from config import get_settings
from supabase import create_client

s = get_settings()
supabase = create_client(*s.require_supabase())

def main():
    print("=== Creating Real-World Test Listing Draft for Kevin Andrews ===")
    
    agent_id = "a0fc8ed3-c69c-41ac-abea-ee15c7c966e6" # Kevin Andrews
    
    listing_payload = {
        "agent_id": agent_id,
        "listing_type": "listing",
        "stage": "draft",
        "address_full": "1229 Sam Dennis Dr, Lewisville, TX 75077",
        "form_data": {
            "listing_type": "listing",
            "seller_name": "Kevin Andrews Test Seller",
            "seller_email": "kevin+test@localprorealty.com",
            "seller_phone": "2145550199",
            "street_number": "1229",
            "street_name": "Sam Dennis",
            "city": "Lewisville",
            "state": "TX",
            "zip_code": "75077",
            "list_price": 385000.0,
            "list_date": "2026-07-22",
            "expire_date": "2026-12-31",
            "property_type": "Single family",
            "lockbox": "Yes",
            "yard_sign": "Yes",
            "beds": 3,
            "baths": 2,
            "sq_ft": 1942,
            "year_built": 1995
        }
    }
    
    res = supabase.table("listings").insert(listing_payload).execute()
    if res.data:
        listing = res.data[0]
        print(f"SUCCESS!")
        print(f"Created Listing ID: {listing['id']}")
        print(f"Address: {listing['address_full']}")
        print(f"Stage: {listing['stage']}")
    else:
        print("ERROR: Failed to create listing draft in Supabase.")

if __name__ == "__main__":
    main()
