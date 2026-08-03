# backend/scripts/34_test_extension_endpoints.py
import sys
import asyncio
from pathlib import Path
from config import get_settings
from supabase import create_client
import httpx

sys.path.append(str(Path(__file__).resolve().parents[1]))

s = get_settings()
supabase = create_client(*s.require_supabase())

# Backend URL for testing
API_BASE = "http://localhost:8000"

async def test_extension_endpoints():
    print("=== Testing Extension Proxy Login & Listing Retrieval ===")
    
    # Agents
    andrew_id = "d2603037-0f9f-46bd-905e-4b9b9de3d35a" # Andrew Wetzel
    andrew_email = "andrew@theandrews.group"
    
    # We will need to perform a test login via our backend POST /extension/auth/login.
    # Note: Andrew's test account password is 'password'.
    async with httpx.AsyncClient(timeout=15.0) as client:
        # 1. Test Login
        print("\n1. Testing Login via Proxy...")
        login_res = await client.post(
            f"{API_BASE}/extension/auth/login",
            json={"email": andrew_email, "password": "localPro123!"}
        )
        print("Login status:", login_res.status_code)
        assert login_res.status_code == 200, "Failed to login via proxy"
        
        login_data = login_res.json()
        token = login_data["access_token"]
        user_info = login_data["user"]
        print("Logged in user:", user_info)
        assert user_info["role"] == "agent"
        assert token is not None
        
        # 2. Create a temporary listing belonging to Andrew
        print("\n2. Creating temporary listing belonging to Andrew...")
        listing_payload = {
            "agent_id": andrew_id,
            "listing_type": "listing",
            "stage": "docs_pending",
            "address_full": "444 Extension Way, Dallas, TX 75248",
            "description_generated": "Beautiful mock property for extension testing.",
            "form_data": {
                "seller_name": "John Extension",
                "seller_email": "john@ext.com",
                "street_number": "444",
                "street_name": "Extension Way",
                "city": "Dallas",
                "state": "TX",
                "zip_code": "75248"
            }
        }
        db_insert = supabase.table("listings").insert(listing_payload).execute()
        andrew_listing_id = db_insert.data[0]["id"]
        print(f"Created listing ID for Andrew: {andrew_listing_id}")

        # 3. Create a temporary listing belonging to someone else
        print("\n3. Creating temporary listing belonging to another agent...")
        other_agent_id = "eeddd5de-f733-4362-b5b6-ee57701cb9fa" # Micah Senter
        listing_payload_other = {
            "agent_id": other_agent_id,
            "listing_type": "buyer",
            "stage": "docs_pending",
            "address_full": "999 Other St, Dallas, TX 75201",
            "description_generated": "Not Andrew's listing.",
            "form_data": {
                "street_number": "999",
                "street_name": "Other St"
            }
        }
        db_insert_other = supabase.table("listings").insert(listing_payload_other).execute()
        other_listing_id = db_insert_other.data[0]["id"]
        print(f"Created listing ID for other agent: {other_listing_id}")

        try:
            # 4. Fetch Andrew's listing using Andrew's token
            print("\n4. Fetching Andrew's listing with his token...")
            headers = {"Authorization": f"Bearer {token}"}
            get_res = await client.get(
                f"{API_BASE}/extension/listing/{andrew_listing_id}",
                headers=headers
            )
            print("Get status:", get_res.status_code)
            assert get_res.status_code == 200
            
            flat_fields = get_res.json()
            print("Flat fields received (keys):", list(flat_fields.keys()))
            assert flat_fields["address_full"] == "444 Extension Way, Dallas, TX 75248"
            assert flat_fields["description"] == "Beautiful mock property for extension testing."
            assert flat_fields["seller_name"] == "John Extension"
            assert flat_fields["seller_email"] == "john@ext.com"
            print("SUCCESS: Listing fields correctly flattened and retrieved!")
            
            # 5. Fetch Other agent's listing using Andrew's token
            print("\n5. Fetching other agent's listing with Andrew's token (should fail with 403)...")
            get_other_res = await client.get(
                f"{API_BASE}/extension/listing/{other_listing_id}",
                headers=headers
            )
            print("Get other status:", get_other_res.status_code)
            print("Get other detail:", get_other_res.json())
            assert get_other_res.status_code == 403, "Access was not denied!"
            print("SUCCESS: Access correctly denied with 403!")

        finally:
            print("\nCleaning up temporary test listings...")
            supabase.table("listings").delete().eq("id", andrew_listing_id).execute()
            supabase.table("listings").delete().eq("id", other_listing_id).execute()
            print("Cleanup completed.")

if __name__ == "__main__":
    asyncio.run(test_extension_endpoints())
