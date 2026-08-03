import os
import json
import requests
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv()

BASE_URI = os.environ.get("BROKERMINT_BASE_URI", "https://my.brokermint.com/api")
API_KEY = os.environ["BROKERMINT_API_KEY"]

TEST_USER_ID = 177980  # Kevin Andrews - safe test agent
TEST_FIELD_NAME = "Adjusted money"  # must match exactly what's saved in BrokerMint


def get_user(user_id: int) -> dict:
    """Path-based lookup - the query-param version (?id=) silently
    ignores the filter and returns the whole user list instead."""
    resp = requests.get(
        f"{BASE_URI}/v1/users/{user_id}",
        params={"api_key": API_KEY, "full_info": 1},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def put_user(user_id: int, payload: dict):
    resp = requests.put(
        f"{BASE_URI}/v1/users/{user_id}",
        params={"api_key": API_KEY},
        json=payload,
        timeout=30,
    )
    print(f"  PUT status: {resp.status_code}")
    print(f"  response: {resp.text[:500]}")
    return resp


def main():
    print("=== STEP 1: confirm the field exists and check current value ===")
    before = get_user(TEST_USER_ID)
    if TEST_FIELD_NAME not in before:
        print(f"  '{TEST_FIELD_NAME}' is NOT present on this user record at all.")
        print(f"  All available field names: {sorted(before.keys())}")
        print("  -> The field may not be saved in BrokerMint yet, or the "
              "name doesn't match exactly (check for typos/extra spaces).")
        return
    print(f"  Current '{TEST_FIELD_NAME}': {before.get(TEST_FIELD_NAME)!r}")

    test_value = f"TEST WRITE {datetime.now(timezone.utc).isoformat()}"
    print(f"\n=== STEP 2: writing test value {test_value!r} ===")
    put_user(TEST_USER_ID, {TEST_FIELD_NAME: test_value})

    print("\n=== STEP 3: re-fetching (path-based) to confirm it stuck ===")
    after = get_user(TEST_USER_ID)
    actual = after.get(TEST_FIELD_NAME)
    print(f"  '{TEST_FIELD_NAME}' now reads: {actual!r}")

    if actual == test_value:
        print("\n  SUCCESS - confirmed we can write our own custom field via API.")
    else:
        print("\n  Didn't match - paste this full output back and we'll dig in.")


if __name__ == "__main__":
    main()
