import os
import sys
from pathlib import Path
from datetime import datetime, timezone

# Ensure we can import config
sys.path.append(str(Path(__file__).resolve().parents[1]))

from config import get_settings
from supabase import create_client

def main():
    print("=== Creating Photographer User ===")
    s = get_settings()
    url, service_key = s.require_supabase()
    supabase = create_client(url, service_key)
    
    email = "photo@localprorealty.com"
    password = "localPro123!"
    full_name = "Charlie Photographer"
    phone = "2145550199"
    
    # 1. Fetch active admin ID to use as approved_by
    admin_res = supabase.table("users").select("id").eq("role", "admin").eq("status", "active").limit(1).execute()
    if not admin_res.data:
        print("ERROR: No active admin found in public.users to approve the user.")
        return
    admin_id = admin_res.data[0]["id"]
    print(f"Found active admin ID: {admin_id}")
    
    # 2. Check if user already exists in auth
    user_id = None
    try:
        created = supabase.auth.admin.create_user({
            "email": email,
            "password": password,
            "email_confirm": True,
            "user_metadata": {
                "full_name": full_name,
                "phone": phone,
                "requested_role": "photographer"
            }
        })
        if created and created.user:
            user_id = created.user.id
            print(f"Created new Auth user with ID: {user_id}")
    except Exception as e:
        err_msg = str(e).lower()
        if "already exists" in err_msg or "already registered" in err_msg or "conflict" in err_msg:
            # Look up from auth list or users table
            print("User already exists in Auth, looking up ID...")
            exist_res = supabase.table("users").select("id").eq("email", email).execute()
            if exist_res.data:
                user_id = exist_res.data[0]["id"]
                print(f"Found existing user ID in database: {user_id}")
        else:
            print(f"ERROR creating auth user: {e}")
            return
            
    if not user_id:
        print("ERROR: Could not retrieve or create user ID.")
        return
        
    # 3. Create or update row in public.users
    user_payload = {
        "id": user_id,
        "full_name": full_name,
        "email": email,
        "role": "photographer",
        "status": "active",
        "phone": phone,
        "approved_by": admin_id,
        "approved_at": datetime.now(timezone.utc).isoformat(),
        "photographer_tier": "standard"
    }
    
    users_res = supabase.table("users").upsert(user_payload).execute()
    if users_res.data:
        print("Successfully created/updated user profile in public.users table.")
    else:
        print("ERROR: Failed to update user profile in public.users.")
        return
        
    # 4. Create or update row in public.photographers
    photog_payload = {
        "id": user_id,
        "tier": "standard",
        "blocked_dates": [],
        "bio": "Professional real estate photographer based in Dallas/Fort Worth."
    }
    
    photog_res = supabase.table("photographers").upsert(photog_payload).execute()
    if photog_res.data:
        print("Successfully created/updated photographer profile in public.photographers table.")
        print(f"\nSUCCESS! Photographer user created:")
        print(f"  Email: {email}")
        print(f"  Password: {password}")
        print(f"  Role: photographer")
    else:
        print("ERROR: Failed to update public.photographers table.")

if __name__ == "__main__":
    main()
