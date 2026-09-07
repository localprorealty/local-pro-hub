import asyncio
import json
import os
import sys
from pathlib import Path

# Add backend directory to path
sys.path.append(str(Path(__file__).resolve().parents[1]))

import httpx
from config import get_settings
from services.supabase import get_supabase_admin

BASE_URL = "https://my.brokermint.com/api"
WEBHOOK_ID = 5000

async def main():
    settings = get_settings()
    api_key = settings.brokermint_api_key
    if not api_key:
        print("ERROR: brokermint_api_key not found in settings")
        return

    async with httpx.AsyncClient(timeout=30) as client:
        print(f"=== ACTIVATING WEBHOOK SUBSCRIPTION {WEBHOOK_ID} ===")
        activate_resp = await client.post(
            f"{BASE_URL}/v1/webhooks/{WEBHOOK_ID}/activate",
            params={"api_key": api_key},
        )
        print(f"Activate Status: {activate_resp.status_code}")
        print(f"Activate Body: {activate_resp.text}")

        print(f"\n=== SENDING TEST PING TO WEBHOOK {WEBHOOK_ID} ===")
        test_resp = await client.post(
            f"{BASE_URL}/v1/webhooks/{WEBHOOK_ID}/test",
            params={"api_key": api_key},
        )
        print(f"Test Ping Status: {test_resp.status_code}")
        print(f"Test Ping Body: {test_resp.text}")

        print("\n=== CHECKING SUBSCRIPTION STATUS VIA GET /v1/webhooks ===")
        get_resp = await client.get(
            f"{BASE_URL}/v1/webhooks",
            params={"api_key": api_key},
        )
        print(f"GET Status: {get_resp.status_code}")
        print(f"GET Body: {get_resp.text}")

    print("\n=== CHECKING SUPABASE bm_webhook_events_log ===")
    supabase = get_supabase_admin()
    events = supabase.table("bm_webhook_events_log").select("*").order("received_at", desc=True).limit(5).execute()
    print(f"Found {len(events.data)} events in bm_webhook_events_log:")
    for ev in events.data:
        print(json.dumps(ev, indent=2, default=str))

if __name__ == "__main__":
    asyncio.run(main())
