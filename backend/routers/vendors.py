import os
import smtplib
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any

from cryptography.fernet import Fernet
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from config import get_settings
from deps.auth import get_service_client, require_active_user, require_agent

router = APIRouter(tags=["vendors"])


# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------

class CreateVendorBody(BaseModel):
    name: str
    website_url: str | None = None
    email: str | None = None
    phone: str | None = None
    notes: str | None = None
    is_default: bool = True


class UpdateVendorBody(BaseModel):
    name: str | None = None
    website_url: str | None = None
    email: str | None = None
    phone: str | None = None
    notes: str | None = None
    is_default: bool | None = None


class SaveGmailCredentialsBody(BaseModel):
    gmail_email: str
    app_password: str


class SendVendorOrderEmailBody(BaseModel):
    vendor_id: str | None = None
    to_email: str
    subject: str
    body_text: str
    mark_completed: bool = True


# ---------------------------------------------------------------------------
# Helper: Verify Agent Listing Ownership
# ---------------------------------------------------------------------------

def _require_agent_listing(client: Any, listing_id: str, agent_id: str) -> dict[str, Any]:
    res = (
        client.table("listings")
        .select("id, agent_id, address_full, address_line1, address_city, stage, list_price, form_data")
        .eq("id", listing_id)
        .maybe_single()
        .execute()
    )
    listing = res.data if res else None
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    if listing.get("agent_id") != agent_id:
        raise HTTPException(status_code=403, detail="Not authorized to manage this listing")
    return listing


# ---------------------------------------------------------------------------
# Vendor Management Endpoints
# ---------------------------------------------------------------------------

@router.get("/vendors")
async def get_agent_vendors(agent_id: str = Depends(require_agent)) -> dict[str, Any]:
    client = get_service_client()
    try:
        res = (
            client.table("agent_vendors")
            .select("*")
            .eq("agent_id", agent_id)
            .order("is_default", desc=True)
            .order("name", desc=False)
            .execute()
        )
        return {"vendors": res.data or []}
    except Exception as e:
        err_msg = str(e)
        if "PGRST205" in err_msg or "schema cache" in err_msg:
            return {"vendors": []}
        raise HTTPException(status_code=500, detail=f"Failed to fetch vendors: {e}")


@router.post("/vendors")
async def create_agent_vendor(
    body: CreateVendorBody,
    agent_id: str = Depends(require_agent),
) -> dict[str, Any]:
    client = get_service_client()
    now_iso = datetime.now(timezone.utc).isoformat()

    # If new vendor is default, unset default on other vendors for this agent
    if body.is_default:
        try:
            client.table("agent_vendors").update({"is_default": False}).eq("agent_id", agent_id).execute()
        except Exception:
            pass

    record = {
        "agent_id": agent_id,
        "vendor_type": "photographer",
        "name": body.name.strip(),
        "website_url": body.website_url.strip() if body.website_url else None,
        "email": body.email.strip().lower() if body.email else None,
        "phone": body.phone.strip() if body.phone else None,
        "notes": body.notes.strip() if body.notes else None,
        "is_default": bool(body.is_default),
        "created_at": now_iso,
        "updated_at": now_iso,
    }

    try:
        res = client.table("agent_vendors").insert(record).execute()
        created = res.data[0] if res.data else record
        return {"success": True, "vendor": created}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save vendor: {e}")


@router.patch("/vendors/{vendor_id}")
async def update_agent_vendor(
    vendor_id: str,
    body: UpdateVendorBody,
    agent_id: str = Depends(require_agent),
) -> dict[str, Any]:
    client = get_service_client()

    updates: dict[str, Any] = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if body.name is not None:
        updates["name"] = body.name.strip()
    if body.website_url is not None:
        updates["website_url"] = body.website_url.strip() if body.website_url else None
    if body.email is not None:
        updates["email"] = body.email.strip().lower() if body.email else None
    if body.phone is not None:
        updates["phone"] = body.phone.strip() if body.phone else None
    if body.notes is not None:
        updates["notes"] = body.notes.strip() if body.notes else None
    if body.is_default is not None:
        updates["is_default"] = bool(body.is_default)
        if body.is_default:
            try:
                client.table("agent_vendors").update({"is_default": False}).eq("agent_id", agent_id).execute()
            except Exception:
                pass

    try:
        res = (
            client.table("agent_vendors")
            .update(updates)
            .eq("id", vendor_id)
            .eq("agent_id", agent_id)
            .execute()
        )
        if not res.data:
            raise HTTPException(status_code=404, detail="Vendor not found")
        return {"success": True, "vendor": res.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update vendor: {e}")


@router.delete("/vendors/{vendor_id}")
async def delete_agent_vendor(
    vendor_id: str,
    agent_id: str = Depends(require_agent),
) -> dict[str, Any]:
    client = get_service_client()
    try:
        client.table("agent_vendors").delete().eq("id", vendor_id).eq("agent_id", agent_id).execute()
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete vendor: {e}")


# ---------------------------------------------------------------------------
# Gmail Credentials Endpoints
# ---------------------------------------------------------------------------

@router.get("/users/me/gmail-credentials")
async def get_gmail_credentials_status(
    user_id: str = Depends(require_active_user),
) -> dict[str, Any]:
    client = get_service_client()
    try:
        res = (
            client.table("agent_email_credentials")
            .select("email, updated_at")
            .eq("user_id", user_id)
            .eq("provider", "gmail")
            .maybe_single()
            .execute()
        )
        if res and res.data:
            return {
                "is_configured": True,
                "gmail_email": res.data.get("email"),
                "updated_at": res.data.get("updated_at"),
            }
        return {"is_configured": False, "gmail_email": None}
    except Exception as e:
        err_msg = str(e)
        if "PGRST205" in err_msg or "schema cache" in err_msg:
            return {"is_configured": False, "gmail_email": None}
        raise HTTPException(status_code=500, detail=f"Failed to check credentials status: {e}")


@router.post("/users/me/gmail-credentials")
async def save_gmail_credentials(
    payload: SaveGmailCredentialsBody,
    user_id: str = Depends(require_active_user),
) -> dict[str, Any]:
    clean_email = payload.gmail_email.strip().lower()
    # Strip whitespace/spaces often copied with Google App Passwords
    clean_password = payload.app_password.replace(" ", "").strip()

    if len(clean_password) != 16:
        raise HTTPException(
            status_code=400,
            detail="Invalid Google App Password. Google App Passwords must be exactly 16 letters.",
        )

    # 1. Isolated SMTP handshake test to verify credentials with Google
    try:
        with smtplib.SMTP("smtp.gmail.com", 587, timeout=10) as server:
            server.starttls()
            server.login(clean_email, clean_password)
    except smtplib.SMTPAuthenticationError:
        # Strictly sanitize: do NOT log or print raw exc
        raise HTTPException(
            status_code=400,
            detail="Google rejected these credentials. Please ensure 2-Step Verification is active on your Google Account and you generated a 16-letter App Password (not your normal Gmail password).",
        )
    except (smtplib.SMTPException, OSError, TimeoutError):
        raise HTTPException(
            status_code=502,
            detail="Unable to reach Google SMTP servers (connection timed out). Please verify your network and try again.",
        )
    except Exception:
        # Catch-all without exc exposure
        raise HTTPException(
            status_code=400,
            detail="Failed to authenticate with Google. Please check your App Password.",
        )

    # 2. Strict check: Fernet key must be configured (fails loudly if missing)
    encryption_key = get_settings().require_credentials_encryption_key()
    fernet = Fernet(encryption_key)
    encrypted_secret = fernet.encrypt(clean_password.encode()).decode()

    now_iso = datetime.now(timezone.utc).isoformat()
    record = {
        "user_id": user_id,
        "provider": "gmail",
        "email": clean_email,
        "encrypted_secret": encrypted_secret,
        "updated_at": now_iso,
    }

    client = get_service_client()
    try:
        client.table("agent_email_credentials").upsert(record, on_conflict="user_id").execute()
        return {
            "success": True,
            "is_configured": True,
            "gmail_email": clean_email,
            "updated_at": now_iso,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to persist credentials: {e}")


@router.delete("/users/me/gmail-credentials")
async def delete_gmail_credentials(
    user_id: str = Depends(require_active_user),
) -> dict[str, Any]:
    client = get_service_client()
    try:
        client.table("agent_email_credentials").delete().eq("user_id", user_id).eq("provider", "gmail").execute()
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to remove credentials: {e}")


# ---------------------------------------------------------------------------
# Order Email Dispatch
# ---------------------------------------------------------------------------

@router.post("/listings/{listing_id}/vendor-order-email")
async def send_vendor_order_email(
    listing_id: str,
    payload: SendVendorOrderEmailBody,
    agent_id: str = Depends(require_agent),
) -> dict[str, Any]:
    client = get_service_client()
    listing = _require_agent_listing(client, listing_id, agent_id)

    # Fetch agent details for email metadata
    agent_res = (
        client.table("users")
        .select("id, email, full_name, phone")
        .eq("id", agent_id)
        .maybe_single()
        .execute()
    )
    agent_profile = agent_res.data if agent_res else {}
    agent_email = agent_profile.get("email") or ""
    agent_name = agent_profile.get("full_name") or "LocalPRO Agent"

    # Check if agent has active Gmail credentials
    cred_res = (
        client.table("agent_email_credentials")
        .select("email, encrypted_secret")
        .eq("user_id", agent_id)
        .eq("provider", "gmail")
        .maybe_single()
        .execute()
    )
    creds = cred_res.data if cred_res else None

    method_used = "gmail_smtp" if creds and creds.get("encrypted_secret") else "resend"

    if method_used == "gmail_smtp":
        # Decrypt secret and send via Gmail SMTP
        encryption_key = get_settings().require_credentials_encryption_key()
        fernet = Fernet(encryption_key)
        gmail_addr = creds["email"]
        try:
            decrypted_pass = fernet.decrypt(creds["encrypted_secret"].encode()).decode()
        except Exception:
            raise HTTPException(status_code=500, detail="Failed to decrypt email credentials.")

        msg = MIMEMultipart()
        msg["From"] = f"{agent_name} <{gmail_addr}>"
        msg["To"] = payload.to_email
        msg["Subject"] = payload.subject.strip()
        msg["Reply-To"] = gmail_addr
        msg.attach(MIMEText(payload.body_text, "plain", "utf-8"))

        try:
            with smtplib.SMTP("smtp.gmail.com", 587, timeout=15) as server:
                server.starttls()
                server.login(gmail_addr, decrypted_pass)
                server.send_message(msg)
        except smtplib.SMTPAuthenticationError:
            raise HTTPException(
                status_code=400,
                detail="Gmail authentication failed. Please check or reconnect your Google App Password in Profile Settings.",
            )
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Failed to send email via Gmail SMTP: {e}")

    else:
        # Fallback: Send via Resend
        settings = get_settings()
        if not settings.resend_api_key:
            raise HTTPException(
                status_code=400,
                detail="Resend email service is not configured and no Gmail App Password was provided. Please configure an App Password in Profile Settings.",
            )

        import resend
        resend.api_key = settings.resend_api_key

        from_email = settings.resend_from_email or "LocalPRO Hub <notifications@localprorealty.com>"
        try:
            resend.Emails.send({
                "from": from_email,
                "to": [payload.to_email],
                "reply_to": agent_email,
                "cc": [agent_email] if agent_email else [],
                "subject": payload.subject.strip(),
                "text": payload.body_text,
            })
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Failed to send email via Resend: {e}")

    # Advance stage to shoot_booked if requested
    stage_updated = False
    if payload.mark_completed:
        now_iso = datetime.now(timezone.utc).isoformat()
        update_fields: dict[str, Any] = {
            "stage": "shoot_booked",
            "vendor_order_placed_at": now_iso,
        }
        if payload.vendor_id:
            update_fields["vendor_id"] = payload.vendor_id

        try:
            client.table("listings").update(update_fields).eq("id", listing_id).execute()
            stage_updated = True
        except Exception as e:
            # Gracefully handle if columns are pending migration 026
            err_msg = str(e)
            if "42703" in err_msg or "vendor_" in err_msg:
                client.table("listings").update({"stage": "shoot_booked"}).eq("id", listing_id).execute()
                stage_updated = True
            else:
                print(f"Warning: could not update listing stage: {e}")

    return {
        "success": True,
        "method": method_used,
        "to_email": payload.to_email,
        "stage_updated": stage_updated,
    }


class CompleteVendorOrderBody(BaseModel):
    vendor_id: str | None = None


@router.post("/listings/{listing_id}/vendor-order-complete")
async def complete_vendor_order(
    listing_id: str,
    payload: CompleteVendorOrderBody,
    agent_id: str = Depends(require_agent),
) -> dict[str, Any]:
    client = get_service_client()
    _require_agent_listing(client, listing_id, agent_id)

    now_iso = datetime.now(timezone.utc).isoformat()
    updates: dict[str, Any] = {
        "stage": "shoot_booked",
        "vendor_order_placed_at": now_iso,
    }
    if payload.vendor_id:
        updates["vendor_id"] = payload.vendor_id

    try:
        client.table("listings").update(updates).eq("id", listing_id).execute()
    except Exception as e:
        err_msg = str(e)
        if "42703" in err_msg or "vendor_" in err_msg:
            client.table("listings").update({"stage": "shoot_booked"}).eq("id", listing_id).execute()
        else:
            raise HTTPException(status_code=500, detail=f"Failed to update listing: {e}")

    return {"success": True, "stage": "shoot_booked"}

