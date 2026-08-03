import os
import requests
from dotenv import load_dotenv

load_dotenv()

BASE_URI = os.environ.get("BROKERMINT_BASE_URI", "https://my.brokermint.com/api")
API_KEY = os.environ["BROKERMINT_API_KEY"]

TEST_FIELD_NAME = "Adjusted money"

# A handful of other agents we haven't touched at all - if the field shows
# up on these (even as null/None), it's account-wide.
OTHER_AGENT_IDS = {
    "Andrew Wetzel": 183733,
    "Jason Baker": 177993,
    "Tricia Andrews": 177899,
    "Deana Custer": 177985,
}


def get_user(user_id: int) -> dict:
    resp = requests.get(
        f"{BASE_URI}/v1/users/{user_id}",
        params={"api_key": API_KEY, "full_info": 1},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def main():
    print(f"Checking whether '{TEST_FIELD_NAME}' appears on agents we never wrote to...\n")

    account_wide = True
    for name, user_id in OTHER_AGENT_IDS.items():
        record = get_user(user_id)
        present = TEST_FIELD_NAME in record
        value = record.get(TEST_FIELD_NAME, "<key not present at all>")
        print(f"  {name} (id {user_id}): field present={present}  value={value!r}")
        if not present:
            account_wide = False

    print()
    if account_wide:
        print("CONFIRMED: the field is account-wide. It exists (as null/empty) "
              "on every agent's record already, just Kevin's is populated. "
              "No need to create it manually per agent - one write anywhere "
              "registered it for everyone.")
    else:
        print("NOT account-wide as tested - at least one other agent doesn't "
              "have this key at all. Might genuinely be scoped to Kevin only, "
              "or it may take a short propagation delay. Try re-running in a "
              "minute, and if it's still missing, we may need the Settings > "
              "Fields > User fields UI approach after all.")


if __name__ == "__main__":
    main()
