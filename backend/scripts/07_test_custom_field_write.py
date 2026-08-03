import os
import json
import requests
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv()

BASE_URI = os.environ.get("BROKERMINT_BASE_URI", "https://my.brokermint.com/api")
API_KEY = os.environ["BROKERMINT_API_KEY"]

TEST_USER_ID = 177980  # Kevin Andrews - safe test agent, cap=0, "Other" split
TEST_FIELD_NAME = "Other Notes"  # must match exactly what you created in BrokerMint


def get_user(user_id: int) -> dict:
    resp = requests.get(
        f"{BASE_URI}/v1/users/{user_id}",
        params={"api_key": API_KEY},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def try_write(method: str, user_id: int, payload: dict):
    url = f"{BASE_URI}/v1/users/{user_id}"
    resp = requests.request(
        method,
        url,
        params={"api_key": API_KEY},
        json=payload,
        timeout=30,
    )
    print(f"  {method} {url}")
    print(f"  body sent: {json.dumps(payload)}")
    print(f"  status: {resp.status_code}")
    print(f"  response: {resp.text[:500]}")
    return resp


def main():
    print("=== STEP 1: current value before write ===")
    before = get_user(TEST_USER_ID)
    print(f"  Current '{TEST_FIELD_NAME}': {before.get(TEST_FIELD_NAME)!r}")

    test_value = f"TEST WRITE {datetime.now(timezone.utc).isoformat()}"
    payload = {TEST_FIELD_NAME: test_value}

    print(f"\n=== STEP 2: attempting PUT with test value {test_value!r} ===")
    resp = try_write("PUT", TEST_USER_ID, payload)

    if resp.status_code >= 400:
        print("\n  PUT failed, trying PATCH instead...")
        resp = try_write("PATCH", TEST_USER_ID, payload)

    print("\n=== STEP 3: re-fetching to confirm whether it actually stuck ===")
    after = get_user(TEST_USER_ID)
    actual = after.get(TEST_FIELD_NAME)
    print(f"  '{TEST_FIELD_NAME}' now reads: {actual!r}")

    if actual == test_value:
        print("\n  SUCCESS: the write persisted. We can write custom fields via API.")
    else:
        print("\n  DID NOT MATCH: either the write failed, or it needs a "
              "different endpoint/shape/verb than what this script tried. "
              "Paste the full output back to me either way - the exact "
              "error message tells us what to try next.")


if __name__ == "__main__":
    main()
