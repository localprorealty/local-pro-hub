import os
import json
import csv
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE_URI = os.environ.get("BROKERMINT_BASE_URI", "https://my.brokermint.com/api")
API_KEY = os.environ["BROKERMINT_API_KEY"]

OUT_DIR = Path(__file__).parent / "bm_dumps"
OUT_DIR.mkdir(exist_ok=True)


def fetch_all_users() -> list:
    """Fetch all users from BrokerMint."""
    # We fetch with full_info=1 to make sure we get custom fields like Sponsor, Split etc.
    resp = requests.get(
        f"{BASE_URI}/v1/users",
        params={"api_key": API_KEY, "full_info": 1},
        timeout=60,
    )
    resp.raise_for_status()
    data = resp.json()

    users = data if isinstance(data, list) else data.get("users", data)
    print(f"Fetched {len(users)} users.")
    if len(users) >= 100:
        print("  NOTE: got 100+ users back - if the real headcount is "
              "higher than this, BrokerMint may be paginating silently. ")
    return users


def main():
    users = fetch_all_users()

    raw_path = OUT_DIR / "all_users_raw.json"
    raw_path.write_text(json.dumps(users, indent=2))
    print(f"Saved full raw dump to {raw_path}")

    # Fields we specifically want visibility into.
    field_candidates = {
        "id": ["id"],
        "first_name": ["first_name"],
        "last_name": ["last_name"],
        "email": ["email"],
        "is_active": ["active"],
        "sponsor": ["Sponsor"],
        "goal_amount": ["Goal amount"],
        "cap_start_date": ["Cap Start Date"],
        "commission_split": ["Commission Split"],
        "monthly_fee": ["Monthly Fee"],
        "onboarding_fee": ["Onboarding Fee"],
        "anniversary_date": ["anniversary_date", "anniversary"],
        "other_notes": ["Other Notes"],
        "reports_to": ["reports to", "reports_to"],
    }

    csv_path = OUT_DIR / "all_users_summary.csv"
    with open(csv_path, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(list(field_candidates.keys()))
        for u in users:
            row = []
            for _, keys in field_candidates.items():
                val = ""
                for k in keys:
                    if k in u:
                        val = u[k]
                        break
                row.append(val)
            writer.writerow(row)

    print(f"Saved summary CSV to {csv_path}")


if __name__ == "__main__":
    main()
