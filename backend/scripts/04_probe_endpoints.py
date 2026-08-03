import os
import requests
from dotenv import load_dotenv

load_dotenv()

BASE_URI = os.environ.get("BROKERMINT_BASE_URI", "https://my.brokermint.com/api")
API_KEY = os.environ["BROKERMINT_API_KEY"]

# Candidate endpoints - guesses based on common BrokerMint terminology.
CANDIDATE_PATHS = [
    "/v1/users",                 # known-good, control case
    "/v1/transactions",          # known-good, control case
    "/v1/commission_plans",
    "/v1/commission_items",
    "/v1/adjustments",
    "/v1/teams",
    "/v1/custom_fields",
    "/v1/company",
    "/v1/companies",
    "/v1/reports",
    "/v2/reports",
    "/v1/disbursements",
    "/v1/payments",
]


def probe(path: str):
    url = f"{BASE_URI}{path}"
    try:
        resp = requests.get(url, params={"api_key": API_KEY}, timeout=15)
        return resp.status_code, len(resp.content)
    except requests.RequestException as e:
        return f"ERROR: {e}", 0


def main():
    print(f"Probing candidate endpoints under {BASE_URI} (GET only)...\n")
    for path in CANDIDATE_PATHS:
        status, size = probe(path)
        marker = "  <-- worth a closer look" if status == 200 else ""
        print(f"  {path:30s} -> status={status}  bytes={size}{marker}")


if __name__ == "__main__":
    main()
