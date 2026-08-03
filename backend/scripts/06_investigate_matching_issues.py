import json
from pathlib import Path
from collections import defaultdict

DUMP_PATH = Path(__file__).parent / "bm_dumps" / "all_users_raw.json"

UNMATCHED_SPONSOR_NAMES = [
    "Xavier Jaimes", "Florida Palmore", "Shelley Nunely",
    "Jamie Wilson", "Micheale Agee", "Hunter Webb",
]

AMBIGUOUS_NAME = "Anthony Hayter"


def main():
    if not DUMP_PATH.exists():
        print(f"Error: {DUMP_PATH} does not exist. Run script 02 first.")
        return

    users = json.loads(DUMP_PATH.read_text())

    print(f"=== Full records for both '{AMBIGUOUS_NAME}' matches ===")
    for u in users:
        full_name = f"{u.get('first_name', '')} {u.get('last_name', '')}".strip()
        if full_name.lower() == AMBIGUOUS_NAME.lower():
            print(json.dumps(u, indent=2))
            print("---")

    print(f"\n=== Agents naming an unmatched sponsor ===")
    for sponsor_name in UNMATCHED_SPONSOR_NAMES:
        namers = [u for u in users if (u.get("Sponsor") or "").strip().lower() == sponsor_name.lower()]
        print(f"\n--- Sponsor name '{sponsor_name}' - named by {len(namers)} agent(s) ---")
        for u in namers:
            print(f"  id={u.get('id')}  name={u.get('first_name')} {u.get('last_name')}  "
                  f"active={u.get('active')}  team={u.get('team')}  office={u.get('Office')}  "
                  f"goal={u.get('Goal amount')}")


if __name__ == "__main__":
    main()
