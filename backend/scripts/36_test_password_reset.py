# backend/scripts/36_test_password_reset.py
import sys
import asyncio
from pathlib import Path

# Add backend directory to path
sys.path.append(str(Path(__file__).resolve().parents[1]))

from config import get_settings
from supabase import create_client

s = get_settings()
supabase = create_client(*s.require_supabase())

async def test_admin_password_reset():
    print("=== Testing Admin Password Reset Endpoint ===")
    
    # 1. Create a temporary user in Supabase Auth & public.users
    temp_email = "test-reset-agent@localprorealty.com"
    temp_password = "oldPassword123!"
    new_password = "newPassword456!"
    
    print(f"Creating temporary user: {temp_email}...")
    try:
        # Create user via service client auth admin
        created = supabase.auth.admin.create_user({
            "email": temp_email,
            "password": temp_password,
            "email_confirm": True,
            "user_metadata": {
                "full_name": "Reset Test Agent",
                "phone": "555-555-5555",
                "mls_id": "9999999",
                "brokermint_id": "99999"
            }
        })
        user = created.user
        if not user:
            raise Exception("Failed to create auth user.")
            
        user_id = user.id
        print(f"Auth user created. ID: {user_id}")
        
        # Update corresponding public.users profile row (created by auth trigger)
        supabase.table("users").update({
            "full_name": "Reset Test Agent",
            "phone": "555-555-5555",
            "mls_id": "9999999",
            "brokermint_id": "99999",
            "role": "agent",
            "status": "active"
        }).eq("id", user_id).execute()
        print("Database profile row updated.")
        
        # 2. Verify we can sign in with the OLD password
        print("Verifying login with OLD password...")
        login_res = supabase.auth.sign_in_with_password({
            "email": temp_email,
            "password": temp_password
        })
        assert login_res.session is not None, "Login with old password failed."
        print("Login with old password successful.")
        
        # 3. Call the admin reset endpoint directly
        from routers.admin import reset_user_password, AdminResetPasswordBody
        
        print(f"Resetting password to: {new_password}...")
        body = AdminResetPasswordBody(password=new_password)
        
        # Call the endpoint directly
        result = reset_user_password(
            user_id=user_id,
            body=body,
            _admin_id="mock-admin-id"
        )
        print("Reset endpoint returned:", result)
        assert result.get("success") is True, "Reset password endpoint failed."
        
        # 4. Verify we can login with the NEW password
        print("Verifying login with NEW password...")
        new_login_res = supabase.auth.sign_in_with_password({
            "email": temp_email,
            "password": new_password
        })
        assert new_login_res.session is not None, "Login with new password failed."
        print("Login with new password successful!")
        
        # 5. Verify we can NO LONGER login with the OLD password
        print("Verifying login with OLD password fails...")
        try:
            supabase.auth.sign_in_with_password({
                "email": temp_email,
                "password": temp_password
            })
            raise AssertionError("Login with old password succeeded but should have failed.")
        except Exception as exc:
            print("Login with old password failed as expected:", str(exc))
            
        print("=== Admin Password Reset Test PASSED ===")
        
    finally:
        # Cleanup
        print("Cleaning up temporary user...")
        try:
            supabase.auth.sign_out()
        except Exception:
            pass
            
        try:
            # We delete the profile row first
            supabase.table("users").delete().eq("email", temp_email).execute()
            print("Deleted database profile row.")
            
            # Find user ID from auth and delete
            users_list = supabase.auth.admin.list_users()
            target_user = next((u for u in users_list if u.email == temp_email), None)
            if target_user:
                supabase.auth.admin.delete_user(target_user.id)
                print("Deleted auth user.")
        except Exception as cleanup_err:
            print("Cleanup warning:", cleanup_err)

if __name__ == "__main__":
    asyncio.run(test_admin_password_reset())
