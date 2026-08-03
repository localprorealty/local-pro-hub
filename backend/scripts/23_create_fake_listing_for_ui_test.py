import os
from config import get_settings
from supabase import create_client

s = get_settings()
supabase = create_client(*s.require_supabase())

def main():
    print("=== Creating Fake Listing Draft for UI Testing ===")
    
    agent_id = "d2603037-0f9f-46bd-905e-4b9b9de3d35a" # Andrew Wetzel
    
    listing_payload = {
        "agent_id": agent_id,
        "listing_type": "lease",
        "stage": "draft",
        "address_full": "123 Testing - Developer",
        "form_data": {
            "listing_type": "lease",
            "seller_name": "123 Testing - Developer",
            "seller_email": "andrew+seller@theandrews.group",
            "seller_phone": "2145550199",
            "street_number": "123",
            "street_name": "Testing Ave",
            "city": "Dallas",
            "state": "TX",
            "zip_code": "75248",
            "list_price": 3500.0,
            "list_date": "2026-07-22",
            "expire_date": "2026-12-31",
            "property_type": "Single family",
            "lockbox": "Yes",
            "yard_sign": "Yes"
        }
    }
    
    res = supabase.table("listings").insert(listing_payload).execute()
    if res.data:
        listing = res.data[0]
        print(f"SUCCESS!")
        print(f"Created Listing ID: {listing['id']}")
        print(f"Address: {listing['address_full']}")
        print(f"Stage: {listing['stage']}")
        print("\nYou can now open your UI to test this draft!")
    else:
        print("ERROR: Failed to create listing draft in Supabase.")

if __name__ == "__main__":
    main()
