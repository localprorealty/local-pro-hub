import os
import json
import requests
from pathlib import Path
from config import get_settings

s = get_settings()
BASE_URI = os.environ.get("BROKERMINT_BASE_URI", "https://my.brokermint.com/api")
API_KEY = s.brokermint_api_key

OUT_DIR = Path(__file__).parent / "bm_dumps"
OUT_DIR.mkdir(exist_ok=True)

# Keywords to search for in path names and descriptions
KEYWORDS = [
    "transaction", "participant", "contact", "checklist", "task",
    "form", "document", "library", "template", "sign", "esign", "signature",
    "package", "merge",
]


def fetch_openapi_schema() -> dict:
    """Same endpoint used weeks ago to find the commission write endpoints."""
    resp = requests.get(f"{BASE_URI.replace('/api', '')}/api_docs/content", timeout=30)
    resp.raise_for_status()
    return resp.json()


def main():
    schema = fetch_openapi_schema()

    out_path = OUT_DIR / "openapi_schema_full.json"
    out_path.write_text(json.dumps(schema, indent=2))
    print(f"Saved full schema to {out_path}\n")

    paths = schema.get("paths", {})
    print(f"Total endpoints in schema: {len(paths)}\n")

    matches = {}
    for path, methods in paths.items():
        path_lower = path.lower()
        for kw in KEYWORDS:
            if kw in path_lower:
                matches.setdefault(kw, []).append(path)
                break

    print("=== Endpoints matching each keyword ===")
    for kw, paths_found in matches.items():
        print(f"\n--- {kw} ---")
        for p in sorted(set(paths_found)):
            methods_here = list(paths.get(p, {}).keys())
            print(f"  {p}  [{', '.join(m.upper() for m in methods_here)}]")

    # Print full detail (params, request body shape) for anything POST/PUT
    # related to transactions, checklists, or documents specifically -
    # these are the ones that matter most for this plan.
    print("\n\n=== Full detail for write (POST/PUT) endpoints on the key resources ===")
    priority_kws = ["transaction", "checklist", "document", "form", "task", "sign"]
    for path, methods in paths.items():
        if not any(kw in path.lower() for kw in priority_kws):
            continue
        for method, detail in methods.items():
            if method.lower() not in ("post", "put", "patch"):
                continue
            print(f"\n{method.upper()} {path}")
            print(f"  Summary: {detail.get('summary', '(no summary)')}")
            request_body = detail.get("requestBody", {})
            if request_body:
                print(f"  Request body schema: {json.dumps(request_body, indent=2)[:1500]}")


if __name__ == "__main__":
    main()
