from supabase import create_client
from config import get_settings

def run_test():
    settings = get_settings()
    url, key = settings.require_supabase()

    print("=== 1. Simulating BEFORE: Global Client Pollution with Expired Token ===")
    polluted_client = create_client(url, key)
    
    # Simulate a previously set valid session token that has since expired.
    # We construct a well-formed JWT header and payload with a past 'exp' timestamp.
    # Header: {"alg":"HS256","typ":"JWT"} -> eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
    # Payload: {"exp":1577836800} (Jan 1, 2020) -> eyJleHAiOjE1Nzc4MzY4MDB9
    # Signature: invalid dummy signature -> abc
    expired_jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE1Nzc4MzY4MDB9.abc"
    
    polluted_client.postgrest.auth(expired_jwt)

    # Now we try to perform a DB select using the polluted client.
    # It will fail with JWT expired (PGRST303) because it uses the polluted headers.
    try:
        polluted_client.table("users").select("id").limit(1).execute()
    except Exception as e:
        print("Database select failed as expected:")
        print(f"  Error: {e!r}")

    print("\n=== 2. Simulating AFTER: Isolated Clean Client ===")
    clean_db_client = create_client(url, key)

    # Because clean_db_client's headers were never polluted, this query succeeds.
    try:
        res = clean_db_client.table("users").select("id").limit(1).execute()
        print("Database select succeeded:")
        print(f"  Result: {res.data}")
    except Exception as e:
        print(f"Unexpected DB failure: {e}")

if __name__ == "__main__":
    run_test()
