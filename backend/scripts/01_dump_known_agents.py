import os
import json
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE_URI = os.environ.get("BROKERMINT_BASE_URI", "https://my.brokermint.com/api")
API_KEY = os.environ["BROKERMINT_API_KEY"]

OUT_DIR = Path(__file__).parent / "bm_dumps"
OUT_DIR.mkdir(exist_ok=True)

# Known test agents from memory.md - add/remove IDs here as needed
KNOWN_AGENT_IDS = {
    "Andrew Wetzel": 183733,
    "Jason Baker": 177993,
    "Kevin Andrews": 177980,
    "Tricia Andrews": 177899,
}


def fetch_user(user_id: int) -> dict:
    """Fetch a single user by ID. Adjust the endpoint/params if this 404s -
    BrokerMint's docs are inconsistent about whether /v1/users supports
    per-id lookup vs requiring a filter on the full list."""
    resp = requests.get(
        f"{BASE_URI}/v1/users",
        params={"api_key": API_KEY, "full_info": 1, "id": user_id},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def main():
    headers = {"Accept": "application/json"}
    for name, bm_id in KNOWN_AGENT_IDS.items():
        print(f"\n=== Fetching {name} (BrokerMint ID {bm_id}) ===")
        # Note: BrokerMint's v1 user endpoint for single user lookup is /v1/users/{id}
        try:
            resp = requests.get(
                f"{BASE_URI}/v1/users/{bm_id}",
                params={"api_key": API_KEY},
                headers=headers,
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()
        except Exception as e:
            print(f"  Single user GET failed: {e}. Trying list filter...")
            try:
                data = fetch_user(bm_id)
            except Exception as e2:
                print(f"  List filter FAILED: {e2}")
                continue

        out_path = OUT_DIR / f"user_{bm_id}.json"
        out_path.write_text(json.dumps(data, indent=2))
        print(f"  Saved full payload to {out_path}")

        # If the response is a list, grab the first matching record for the summary
        record = data[0] if isinstance(data, list) and data else data
        if isinstance(record, dict):
            print(f"  Top-level keys: {sorted(record.keys())}")
            # Print anything that looks sponsor/commission/split/cap related
            for k, v in record.items():
                if any(word in k.lower() for word in
                       ["sponsor", "split", "cap", "commission", "fee", "goal"]):
                    print(f"    {k!r}: {v!r}")


if __name__ == "__main__":
    main()
