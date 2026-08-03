import os
import json
import time
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE_URI = os.environ.get("BROKERMINT_BASE_URI", "https://my.brokermint.com/api")
API_KEY = os.environ["BROKERMINT_API_KEY"]

DUMP_PATH = Path(__file__).parent / "bm_dumps" / "all_users_raw.json"
FIELD_NAME = "Adjusted money"
DEFAULT_VALUE = "0"
DELAY_SECONDS = 0.3  # base delay between requests


def put_field(user_id: int, value: str) -> bool:
    url = f"{BASE_URI}/v1/users/{user_id}"
    while True:
        resp = requests.put(
            url,
            params={"api_key": API_KEY},
            json={FIELD_NAME: value},
            timeout=30,
        )
        if resp.status_code == 200:
            return True
        elif resp.status_code == 429:
            # Handle rate limiting
            reset_ts = resp.headers.get("X-Brokermint-Hour-Reset")
            if reset_ts:
                try:
                    # 13-digit Unix timestamp
                    wait_time = max(1.0, (int(reset_ts) / 1000.0) - time.time() + 2)
                    print(f"\n  [Rate Limited] Hour limit reached. Waiting {wait_time:.1f} seconds for reset...")
                    time.sleep(wait_time)
                    continue
                except ValueError:
                    pass
            
            # Fallback sleep
            print("\n  [Rate Limited] Too many requests. Waiting 15 seconds...")
            time.sleep(15)
            continue
        else:
            print(f"\n  FAILED: {resp.status_code} - {resp.text[:200]}")
            return False


def main():
    if not DUMP_PATH.exists():
        print(f"Error: {DUMP_PATH} does not exist. Run script 02 first.")
        return

    users = json.loads(DUMP_PATH.read_text())
    print(f"Loaded {len(users)} agents from {DUMP_PATH}")
    print(f"Setting '{FIELD_NAME}' = {DEFAULT_VALUE!r} for every one of them...\n")

    failed = []
    for i, u in enumerate(users, start=1):
        user_id = u["id"]
        name = f"{u.get('first_name', '')} {u.get('last_name', '')}".strip()
        ok = put_field(user_id, DEFAULT_VALUE)
        status = "ok" if ok else "FAILED"
        print(f"  [{i}/{len(users)}] {name} (id {user_id}): {status}")
        if not ok:
            failed.append(user_id)
        time.sleep(DELAY_SECONDS)

    print(f"\nDone. {len(users) - len(failed)} succeeded, {len(failed)} failed.")
    if failed:
        print(f"Failed IDs (re-run just these if needed): {failed}")


if __name__ == "__main__":
    main()
