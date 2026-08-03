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

KNOWN_REPORT_IDS = {
    "sponsorship_report": 367959,
    "revenue_share_report": 368527,
}


def dump(name: str, path: str, params: dict | None = None):
    resp = requests.get(f"{BASE_URI}{path}", params={"api_key": API_KEY, **(params or {})}, timeout=60)
    print(f"\n=== {name} ({path}) -> status {resp.status_code} ===")
    if resp.status_code != 200:
        print(f"  {resp.text[:500]}")
        return None

    try:
        data = resp.json()
    except ValueError:
        print("  Response wasn't JSON, saving raw text instead.")
        out_path = OUT_DIR / f"{name}.txt"
        out_path.write_text(resp.text)
        print(f"  Saved to {out_path}")
        return None

    out_path = OUT_DIR / f"{name}.json"
    out_path.write_text(json.dumps(data, indent=2))
    print(f"  Saved to {out_path}")

    # Print a small preview so we can eyeball structure without opening the file
    preview = data if isinstance(data, list) else data.get("data", data)
    if isinstance(preview, list):
        print(f"  {len(preview)} rows. First row:")
        print(f"  {json.dumps(preview[0], indent=2)[:1000]}" if preview else "  (empty)")
    else:
        print(f"  {json.dumps(preview, indent=2)[:1000]}")

    return data


def main():
    dump("commission_plans", "/v1/commission_plans")
    dump("reports_listing", "/v2/reports")

    for name, report_id in KNOWN_REPORT_IDS.items():
        dump(name, f"/v2/reports/{report_id}")


if __name__ == "__main__":
    main()
