import json
from pathlib import Path
from collections import defaultdict

DUMP_PATH = Path(__file__).parent / "bm_dumps" / "all_users_raw.json"


def main():
    if not DUMP_PATH.exists():
        print(f"Error: {DUMP_PATH} does not exist. Run script 02 first.")
        return

    users = json.loads(DUMP_PATH.read_text())
    print(f"Loaded {len(users)} users from {DUMP_PATH}\n")

    # --- 1. Every distinct field name seen anywhere, flagged if sponsor-ish ---
    all_keys = set()
    for u in users:
        all_keys.update(u.keys())

    print("=== All distinct field names seen across every user record ===")
    for k in sorted(all_keys):
        print(f"  {k}")

    sponsor_ish = [k for k in all_keys if "sponsor" in k.lower()]
    print(f"\n=== Fields with 'sponsor' in the name: {sponsor_ish} ===")
    if len(sponsor_ish) <= 1:
        print("  -> Looks like Sponsor (name text) may really be the only "
              "sponsor-related field. No hidden ID field found.")

    # --- 2. Distinct shapes of the Commission Split field ---
    print("\n=== Distinct 'Commission Split' values seen ===")
    split_values = defaultdict(int)
    for u in users:
        val = u.get("Commission Split", "<missing>")
        split_values[val] += 1
    for val, count in sorted(split_values.items(), key=lambda x: -x[1]):
        print(f"  {count:4d}x  {val!r}")

    # --- 3. Sponsor name -> can we resolve it to exactly one user? ---
    print("\n=== Sponsor name-matching risk check ===")
    name_index = defaultdict(list)
    for u in users:
        full_name = f"{u.get('first_name', '')} {u.get('last_name', '')}".strip()
        name_index[full_name.lower()].append(u.get("id"))

    unmatched, ambiguous, clean = 0, 0, 0
    for u in users:
        sponsor_name = (u.get("Sponsor") or "").strip()
        if not sponsor_name:
            continue
        matches = name_index.get(sponsor_name.lower(), [])
        if len(matches) == 0:
            unmatched += 1
            print(f"  UNMATCHED sponsor name: {sponsor_name!r} "
                  f"(named by user id {u.get('id')})")
        elif len(matches) > 1:
            ambiguous += 1
            print(f"  AMBIGUOUS sponsor name: {sponsor_name!r} matches "
                  f"{len(matches)} users: {matches}")
        else:
            clean += 1

    print(f"\nSummary: {clean} clean matches, {ambiguous} ambiguous, "
          f"{unmatched} unmatched out of {len(users)} users.")


if __name__ == "__main__":
    main()
