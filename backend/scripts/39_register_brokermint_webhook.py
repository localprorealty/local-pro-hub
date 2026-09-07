import asyncio
import json
import os
import sys
from pathlib import Path

# Add backend directory to path
sys.path.append(str(Path(__file__).resolve().parents[1]))

import httpx
from config import get_settings

BASE_URL = "https://my.brokermint.com/api"

async def main():
    settings = get_settings()
    api_key = settings.brokermint_api_key
    if not api_key:
        print("ERROR: brokermint_api_key not found in settings")
        return

    callback_url = "https://local-pro-hub-production.up.railway.app/webhooks/brokermint"
    event_types = [
        {"event": "transaction.created", "api_version": "2"},
        {"event": "transaction.updated", "api_version": "2"},
        {"event": "transaction.deleted", "api_version": "2"},
        {"event": "transaction.participant.added", "api_version": "2"},
        {"event": "transaction.participant.updated", "api_version": "2"},
        {"event": "transaction.participant.removed", "api_version": "2"},
    ]

    async with httpx.AsyncClient(timeout=30) as client:
        print("=== STEP 4: REGISTERING NEW BROKERMINT WEBHOOK ===")
        payload = {
            "callback_url": callback_url,
            "event_types": event_types,
        }
        print(f"Request: POST {BASE_URL}/v1/webhooks")
        print(f"Payload: {json.dumps(payload, indent=2)}")
        
        create_resp = await client.post(
            f"{BASE_URL}/v1/webhooks",
            params={"api_key": api_key},
            json=payload,
        )
        print(f"Status Code: {create_resp.status_code}")
        print(f"Response Body: {create_resp.text}")

        if create_resp.status_code not in [200, 201]:
            print("Failed to register webhook.")
            return

        webhook_data = create_resp.json()
        webhook_id = webhook_data.get("id")
        secret_token = webhook_data.get("secret_token")

        print("\n=======================================================")
        print(f"★ NEW WEBHOOK ID: {webhook_id}")
        print(f"★ SECRET TOKEN (SAVE TO RAILWAY BROKERMINT_WEBHOOK_SECRET):")
        print(f"{secret_token}")
        print("=======================================================\n")

        # Activate subscription
        print(f"Activating subscription {webhook_id} via PUT /v1/webhooks/{webhook_id}...")
        activate_resp = await client.put(
            f"{BASE_URL}/v1/webhooks/{webhook_id}",
            params={"api_key": api_key},
            json={"active": True},
        )
        print(f"Activation Status: {activate_resp.status_code}")
        print(f"Activation Body: {activate_resp.text}")

        # Send test ping
        print(f"\nSending test ping via POST /v1/webhooks/{webhook_id}/test...")
        test_resp = await client.post(
            f"{BASE_URL}/v1/webhooks/{webhook_id}/test",
            params={"api_key": api_key},
        )
        print(f"Test Ping Status: {test_resp.status_code}")
        print(f"Test Ping Body: {test_resp.text}")

        # Follow-up verification GET /v1/webhooks
        print("\n=== STEP 4 VERIFICATION: GET /v1/webhooks ===")
        get_resp = await client.get(
            f"{BASE_URL}/v1/webhooks",
            params={"api_key": api_key},
        )
        print(f"GET Status: {get_resp.status_code}")
        print(f"GET Body: {get_resp.text}")

if __name__ == "__main__":
    asyncio.run(main())
