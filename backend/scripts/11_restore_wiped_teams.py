import os
import json
import requests
from pathlib import Path

BASE_URI = os.environ.get("BROKERMINT_BASE_URI", "https://my.brokermint.com/api")
API_KEY = os.environ.get("BROKERMINT_API_KEY")
BASELINE_PATH = Path(__file__).parent / "bm_dumps" / "all_users_raw.json"

AFFECTED_IDS = [
    177976, 177977, 177980, 177990, 178577, 179141, 179144, 179146,
    183545, 183592, 183733, 183736, 191202, 198136, 198691, 200570,
    211269, 211275, 211287, 213666, 215831, 222971, 269097, 269343
]

def main():
    if not API_KEY:
        print("ERROR: BROKERMINT_API_KEY environment variable is not set!")
        return

    if not BASELINE_PATH.exists():
        print(f"ERROR: Baseline file not found at {BASELINE_PATH}")
        return

    baseline = {u["id"]: u for u in json.loads(BASELINE_PATH.read_text())}
    print(f"Starting team restoration for {len(AFFECTED_IDS)} agents...\n")
    
    for uid in AFFECTED_IDS:
        before = baseline.get(uid)
        if not before:
            print(f"User ID {uid} not found in baseline!")
            continue
        
        team_name = before.get("team")
        if not team_name:
            print(f"User ID {uid} had no team in baseline!")
            continue
            
        print(f"Restoring {before.get('first_name')} {before.get('last_name')} (id {uid}) -> team: {team_name!r}")
        resp = requests.put(
            f"{BASE_URI}/v1/users/{uid}",
            params={"api_key": API_KEY},
            json={"team": team_name}
        )
        if resp.status_code == 200:
            print("  Success!")
        else:
            print(f"  Failed: {resp.status_code} - {resp.text}")

if __name__ == "__main__":
    main()
