import os
import json
import requests
from pathlib import Path

BASE_URI = os.environ.get("BROKERMINT_BASE_URI", "https://my.brokermint.com/api")
# Grab API key from environment
API_KEY = os.environ.get("BROKERMINT_API_KEY")

BASELINE_PATH = Path(__file__).parent / "bm_dumps" / "all_users_raw.json"

# Fields we've deliberately written to on purpose - don't flag changes here
DELIBERATE_FIELDS = {"Adjusted money", "Other Notes"}

# Fields that naturally change on their own in BrokerMint regardless of us
# (real business activity, not something we'd expect to be stable)
EXPECTED_TO_CHANGE = {"updated_at", "last_sign_in", "last_activity_date", "avatar_added", "avatar_url"}


def fetch_user(user_id: int) -> dict:
    resp = requests.get(
        f"{BASE_URI}/v1/users/{user_id}",
        params={"api_key": API_KEY, "full_info": 1},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def main():
    if not API_KEY:
        print("ERROR: BROKERMINT_API_KEY environment variable is not set!")
        return

    if not BASELINE_PATH.exists():
        print(f"ERROR: Baseline file not found at {BASELINE_PATH}")
        return

    baseline = {u["id"]: u for u in json.loads(BASELINE_PATH.read_text())}
    print(f"Loaded baseline for {len(baseline)} agents (pre-write snapshot)\n")

    flagged_agents = []

    for i, (user_id, before) in enumerate(baseline.items(), start=1):
        try:
            after = fetch_user(user_id)
        except requests.HTTPError as e:
            print(f"  [{i}/{len(baseline)}] id={user_id}: FAILED to fetch - {e}")
            continue

        problems = []
        for field, before_val in before.items():
            if field in DELIBERATE_FIELDS or field in EXPECTED_TO_CHANGE:
                continue
            # Only care about fields that HAD a real value before
            if before_val in (None, "", 0):
                continue
            after_val = after.get(field)
            if after_val in (None, "") and before_val not in (None, ""):
                problems.append(f"{field!r}: {before_val!r} -> {after_val!r}")

        if problems:
            name = f"{before.get('first_name','')} {before.get('last_name','')}".strip()
            flagged_agents.append((user_id, name, problems))
            print(f"  [{i}/{len(baseline)}] FLAGGED: {name} (id {user_id})")
            for p in problems:
                print(f"      {p}")
        else:
            print(f"  [{i}/{len(baseline)}] id={user_id}: clean")

    print(f"\n\n=== SUMMARY: {len(flagged_agents)} of {len(baseline)} agents have unexpectedly cleared fields ===")
    if flagged_agents:
        print("Full list of affected agent IDs:", [a[0] for a in flagged_agents])
        print("\nThis needs to be resolved (likely by re-fetching missing values from the")
        print("baseline and writing them back, or switching our write approach) before any")
        print("further PUT calls to BrokerMint, including the planned field rename/resync.")
    else:
        print("No unintended field wipes detected. Kevin's team removal may be an isolated")
        print("case or coincidental manual action - worth checking BrokerMint's activity log")
        print("for Kevin specifically to see who/what triggered it, but safe to proceed.")


if __name__ == "__main__":
    main()
