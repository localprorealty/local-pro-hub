import hashlib
import hmac
import json
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Header, Request

from config import get_settings
from deps.auth import get_service_client
from services.brokermint_sync import delete_single_transaction, sync_single_transaction

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])


@router.post("/brokermint")
async def brokermint_webhook(
    request: Request,
    x_brokermint_webhook_signature: str | None = Header(default=None, alias="X-Brokermint-Webhook-Signature"),
    x_brokermint_signature: str | None = Header(default=None, alias="X-Brokermint-Signature"),
    x_signature: str | None = Header(default=None, alias="X-Signature"),
) -> dict[str, Any]:
    """
    Receives and synchronously processes real-time BrokerMint webhooks.
    
    Security:
      - Validates HMAC-SHA256 signature against BROKERMINT_WEBHOOK_SECRET.
    
    Idempotency:
      - Checks bm_webhook_events_log table. If event_id was already processed, returns 200 immediately.
    
    Processing:
      - Synchronous execution within the request lifecycle.
      - If sync succeeds: returns 200 OK.
      - If sync fails: returns 500 Internal Server Error so BrokerMint's automatic retry
        schedule (5, 10, 15, 30, 60, 120 mins) will retry delivery.
    """
    # 1. Read raw body bytes for signature verification
    raw_body = await request.body()
    if not raw_body:
        raise HTTPException(status_code=400, detail="Empty request body")

    # 2. Signature verification
    secret = os.environ.get("BROKERMINT_WEBHOOK_SECRET") or get_settings().brokermint_webhook_secret
    if not secret:
        logger.error("BROKERMINT_WEBHOOK_SECRET is not configured on server")
        raise HTTPException(status_code=500, detail="BROKERMINT_WEBHOOK_SECRET not configured")

    signature = (
        x_brokermint_webhook_signature
        or x_brokermint_signature
        or x_signature
    )
    if not signature:
        logger.warning("Missing BrokerMint webhook signature header")
        raise HTTPException(status_code=401, detail="Missing webhook signature")

    computed_sig = hmac.new(
        secret.encode("utf-8"),
        raw_body,
        hashlib.sha256
    ).hexdigest()

    # Compare constant-time
    if not hmac.compare_digest(computed_sig, signature):
        logger.warning("Invalid BrokerMint webhook signature")
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    # 3. Parse JSON payload
    try:
        payload = json.loads(raw_body.decode("utf-8"))
    except Exception as e:
        logger.error("Invalid JSON in BrokerMint webhook payload: %s", e)
        raise HTTPException(status_code=400, detail=f"Invalid JSON payload: {str(e)}")

    event_id = str(payload.get("event_id") or payload.get("id") or f"evt_{uuid.uuid4().hex}")
    event_type = str(payload.get("event") or payload.get("event_type") or "unknown")
    
    # BrokerMint API v2 webhooks place the resource under 'object', fallback to 'data', then top-level payload
    data = (
        payload.get("object")
        if isinstance(payload.get("object"), dict)
        else (payload.get("data") if isinstance(payload.get("data"), dict) else payload)
    )

    # Extract BrokerMint transaction ID
    bm_txn_id = None
    if isinstance(data, dict):
        if "participant" in event_type:
            # In participant webhooks, bm_transaction_id points to the parent transaction
            bm_txn_id = data.get("bm_transaction_id") or data.get("transaction_id") or (data.get("transaction") or {}).get("id")
        else:
            bm_txn_id = data.get("id") or data.get("transaction_id")

    supabase = get_service_client()

    # 4. Idempotency check against bm_webhook_events_log
    try:
        existing = (
            supabase.table("bm_webhook_events_log")
            .select("id, status")
            .eq("event_id", event_id)
            .execute()
        )
        if existing.data and existing.data[0].get("status") == "processed":
            logger.info("Webhook event %s already processed. Returning 200 OK immediately.", event_id)
            return {"status": "already_processed", "event_id": event_id}
    except Exception as check_err:
        logger.warning("Could not check bm_webhook_events_log idempotency: %s", check_err)

    # 5. Record initial event in log
    now_iso = datetime.now(timezone.utc).isoformat()
    try:
        supabase.table("bm_webhook_events_log").upsert({
            "event_id": event_id,
            "event_type": event_type,
            "transaction_id": str(bm_txn_id) if bm_txn_id else None,
            "payload": payload,
            "status": "processing",
            "received_at": now_iso,
        }, on_conflict="event_id").execute()
    except Exception as log_err:
        logger.warning("Could not insert into bm_webhook_events_log: %s", log_err)

    # 6. Synchronous event execution
    try:
        if event_type == "transaction.deleted":
            if not bm_txn_id:
                status_val = "skipped"
                err_msg = "Could not resolve transaction ID from payload shape for transaction.deleted"
                result = {"status": "skipped", "reason": "no_transaction_id"}
                logger.warning("Webhook event %s (%s): %s", event_id, event_type, err_msg)
            else:
                result = await delete_single_transaction(supabase, str(bm_txn_id))
                status_val = "processed"
                err_msg = None
                logger.info("Soft-deleted BrokerMint transaction %s via webhook", bm_txn_id)
        elif bm_txn_id:
            result = await sync_single_transaction(supabase, str(bm_txn_id))
            status_val = "processed"
            err_msg = None
            logger.info("Synced BrokerMint transaction %s via webhook (%s): %s", bm_txn_id, event_type, result)
        else:
            # Check if this is a ping/test event that by design does not require a transaction ID
            is_ping = (
                event_type in ["ping", "test"]
                or (isinstance(data, dict) and data.get("value") == "ping")
            )
            if is_ping:
                status_val = "processed"
                err_msg = None
                result = {"status": "processed", "reason": "ping_acknowledged"}
                logger.info("Webhook ping event %s acknowledged successfully", event_id)
            else:
                status_val = "skipped"
                err_msg = f"Could not resolve transaction ID from payload shape for event type '{event_type}'"
                result = {"status": "skipped", "reason": "no_transaction_id"}
                logger.warning("Webhook event %s (%s) skipped: %s", event_id, event_type, err_msg)

        # 7. Update log status to 'processed' or 'skipped'
        try:
            supabase.table("bm_webhook_events_log").update({
                "status": status_val,
                "error_message": err_msg,
                "processed_at": datetime.now(timezone.utc).isoformat(),
            }).eq("event_id", event_id).execute()
        except Exception as update_err:
            logger.warning("Could not update bm_webhook_events_log status: %s", update_err)

        return {
            "status": status_val,
            "event_id": event_id,
            "event_type": event_type,
            "transaction_id": str(bm_txn_id) if bm_txn_id else None,
            "result": result,
            "error_message": err_msg,
        }

    except Exception as exc:
        logger.error("Error processing BrokerMint webhook %s (%s): %s", event_id, event_type, exc)
        # Update log status to 'failed'
        try:
            supabase.table("bm_webhook_events_log").update({
                "status": "failed",
                "error_message": str(exc),
                "processed_at": datetime.now(timezone.utc).isoformat(),
            }).eq("event_id", event_id).execute()
        except Exception:
            pass

        # Return 500 so BrokerMint retries automatically
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process BrokerMint webhook: {str(exc)}"
        ) from exc
