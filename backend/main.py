from typing import Any

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from config import get_settings
from routers.admin import router as admin_router
from routers.bookings import router as bookings_router
from routers.listings import router as listings_router
from routers.marketing_video import router as marketing_video_router
from routers.rets import router as rets_router
from routers.voice import router as voice_router
from routers.brokermint import router as brokermint_router
from routers.revenue_share import router as revenue_share_router
from routers.extension import router as extension_router

settings = get_settings()

app = FastAPI(
    title="LocalPRO Hub API",
    description="Internal API for Local Pro Realty — Dallas, TX",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(admin_router)
app.include_router(bookings_router)
app.include_router(listings_router)
app.include_router(marketing_video_router)
app.include_router(rets_router)
app.include_router(voice_router)
app.include_router(brokermint_router)
app.include_router(revenue_share_router)
app.include_router(extension_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "localpro-hub-api"}


class SignupNotifyRecord(BaseModel):
    id: str
    email: str
    full_name: str
    phone: str
    role: str = "agent"
    mls_id: str = ""
    brokermint_id: str = ""
    photographer_tier: str = "standard"


class SignupNotifyBody(BaseModel):
    record: SignupNotifyRecord


@app.post("/internal/notify-signup-pending")
async def notify_signup_pending(body: SignupNotifyBody) -> dict[str, Any]:
    """
    Forward signup notification to n8n from the server (no browser CORS).
    Set N8N_SIGNUP_WEBHOOK_URL in backend/.env.
    """
    webhook_url = settings.n8n_signup_webhook_url.strip()
    if not webhook_url:
        return {"ok": False, "skipped": True, "reason": "N8N_SIGNUP_WEBHOOK_URL not set"}

    payload = {
        "type": "INSERT",
        "table": "users",
        "schema": "public",
        "record": {
            **body.record.model_dump(),
            "status": "pending",
        },
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                webhook_url,
                json=payload,
                headers={
                    "Content-Type": "application/json",
                    "ngrok-skip-browser-warning": "true",
                },
            )
            response.raise_for_status()
    except httpx.HTTPError as exc:
        # Signup must succeed even if n8n is down — return 200 with error details.
        detail = str(exc)
        if isinstance(exc, httpx.HTTPStatusError) and exc.response is not None:
            detail = exc.response.text or detail
        return {
            "ok": False,
            "error": detail,
            "hint": (
                "Open the Webhook node in n8n → Production tab → copy that URL into "
                "N8N_SIGNUP_WEBHOOK_URL. Workflow must be Active. "
                "Restart n8n with WEBHOOK_URL set to your ngrok URL, then toggle workflow off/on."
            ),
        }

    return {"ok": True}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=True,
    )
