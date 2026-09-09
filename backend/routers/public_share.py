import html
import secrets
from datetime import datetime, timezone
from typing import Any

from cachetools import TTLCache
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from deps.auth import get_service_client, require_agent

router = APIRouter(tags=["public_share"])

# ---------------------------------------------------------------------------
# Rate Limiting & Anti-Spam Setup
# ---------------------------------------------------------------------------
# Max 5 comments per 10 minutes (600 seconds) per client IP
IP_COMMENT_LIMIT = 5
IP_COMMENT_WINDOW_SECONDS = 600
comment_rate_cache: TTLCache[str, list[float]] = TTLCache(
    maxsize=10000,
    ttl=IP_COMMENT_WINDOW_SECONDS,
)


def get_client_ip(request: Request) -> str:
    """Extract client IP handling reverse proxy headers."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "127.0.0.1"


def check_ip_rate_limit(ip: str) -> None:
    """Enforce IP-based rate limiting on comment submissions."""
    now = datetime.now(timezone.utc).timestamp()
    timestamps = comment_rate_cache.get(ip, [])
    cutoff = now - IP_COMMENT_WINDOW_SECONDS
    valid_timestamps = [t for t in timestamps if t > cutoff]

    if len(valid_timestamps) >= IP_COMMENT_LIMIT:
        raise HTTPException(
            status_code=429,
            detail="Too many comments submitted. Please wait a few minutes before trying again.",
        )

    valid_timestamps.append(now)
    comment_rate_cache[ip] = valid_timestamps


# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------

class CreatePublicCommentPayload(BaseModel):
    commenter_name: str = Field(..., min_length=2, max_length=60)
    comment_text: str = Field(..., min_length=3, max_length=1000)
    hp_website: str | None = None  # Honeypot field


class UpdateShareLinkPayload(BaseModel):
    is_publicly_shared: bool
    regenerate_token: bool = False


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _require_agent_listing(client: Any, listing_id: str, agent_id: str) -> dict[str, Any]:
    """Verify that listing exists and caller owns it or is an admin."""
    res = (
        client.table("listings")
        .select("id, agent_id, address_full, stage, list_price, form_data, public_share_token, is_publicly_shared")
        .eq("id", listing_id)
        .maybe_single()
        .execute()
    )
    listing = res.data if res else None
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    if listing.get("agent_id") != agent_id:
        # Check if caller is an admin
        u_res = client.table("users").select("role").eq("id", agent_id).maybe_single().execute()
        user_row = u_res.data if u_res else None
        if not user_row or user_row.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Not authorized to manage this listing")
    return listing


def _build_pipeline_stages(current_stage: str) -> list[dict[str, Any]]:
    """Build a viewer-friendly pipeline progression."""
    stages_order = [
        {"key": "draft", "label": "Draft Prepared"},
        {"key": "docs_signed", "label": "Agreements Signed"},
        {"key": "shoot_booked", "label": "Photography Scheduled"},
        {"key": "marketing", "label": "Marketing & Media Prep"},
        {"key": "live", "label": "Active Live on Market"},
    ]

    # Map database stages to progression index
    stage_weights: dict[str, int] = {
        "draft": 0,
        "docs_pending": 0,
        "docs_signed": 1,
        "shoot_booked": 2,
        "marketing": 3,
        "mls_submitted": 3,
        "live": 4,
        "closed": 4,
    }

    current_idx = stage_weights.get(current_stage, 0)

    result = []
    for i, s in enumerate(stages_order):
        if i < current_idx:
            status = "completed"
        elif i == current_idx:
            status = "current"
        else:
            status = "upcoming"
        result.append({
            "key": s["key"],
            "label": s["label"],
            "status": status,
        })
    return result


# ---------------------------------------------------------------------------
# Public View & Comment Endpoints (No Auth Required)
# ---------------------------------------------------------------------------

@router.get("/public/share/{token}")
async def get_public_listing_share(token: str):
    """
    Public, read-only view of a listing for clients and prospective buyers.
    Requires no authentication.
    Returns sanitized listing details, photos, pipeline progress, and comments.
    Guarantees strict privacy: zero leaks of internal docs, sellers, lockbox codes, or financial notes.
    """
    if not token or len(token.strip()) < 8:
        raise HTTPException(status_code=404, detail="Shared listing not found or link is invalid.")

    client = get_service_client()

    # Look up shared listing
    res = (
        client.table("listings")
        .select("id, agent_id, address_full, stage, list_price, description_generated, form_data, is_publicly_shared, public_share_token")
        .eq("public_share_token", token.strip())
        .maybe_single()
        .execute()
    )
    listing = res.data if res else None

    # Instant revocation check: 404 if not found or sharing is turned off
    if not listing or not listing.get("is_publicly_shared"):
        raise HTTPException(
            status_code=404,
            detail="Shared listing not found or this share link is currently inactive.",
        )

    form_data = listing.get("form_data") or {}

    # Extract non-sensitive specifications
    specs = {
        "property_type": form_data.get("property_type") or form_data.get("propertyType") or "Single Family Residential",
        "bedrooms": form_data.get("bedrooms") or form_data.get("beds") or form_data.get("bedrooms_total"),
        "bathrooms_full": form_data.get("bathrooms_full") or form_data.get("baths_full") or form_data.get("bathrooms"),
        "bathrooms_half": form_data.get("bathrooms_half") or form_data.get("baths_half"),
        "square_feet": form_data.get("square_feet") or form_data.get("sqft") or form_data.get("living_area"),
        "year_built": form_data.get("year_built") or form_data.get("yearBuilt"),
        "subdivision": form_data.get("subdivision") or form_data.get("subdivision_name"),
    }

    # Description: prefer AI-generated description, then public remarks
    description = (
        listing.get("description_generated")
        or form_data.get("public_remarks")
        or form_data.get("description")
        or ""
    )

    # Fetch agent contact card
    agent_id = listing.get("agent_id")
    agent_data: dict[str, Any] = {
        "name": "LocalPRO Agent",
        "email": None,
        "phone": None,
        "avatar_url": None,
        "brand_logo_url": None,
    }
    if agent_id:
        user_res = (
            client.table("users")
            .select("id, full_name, email, phone, heygen_avatar_thumbnail_url, brand_logo_url")
            .eq("id", agent_id)
            .maybe_single()
            .execute()
        )
        u = user_res.data if user_res else None
        if u:
            agent_data = {
                "name": u.get("full_name") or "LocalPRO Agent",
                "email": u.get("email"),
                "phone": u.get("phone"),
                "avatar_url": u.get("heygen_avatar_thumbnail_url"),
                "brand_logo_url": u.get("brand_logo_url"),
            }

    # Fetch images from listing_images table
    photos: list[dict[str, Any]] = []
    try:
        img_res = (
            client.table("listing_images")
            .select("id, public_url, category, caption, is_hero, sort_order")
            .eq("listing_id", listing["id"])
            .order("sort_order", desc=False)
            .order("created_at", desc=False)
            .execute()
        )
        if img_res and img_res.data:
            photos = [
                {
                    "id": row["id"],
                    "url": row["public_url"],
                    "category": row.get("category") or "gallery",
                    "caption": row.get("caption") or "",
                    "is_hero": bool(row.get("is_hero")),
                    "sort_order": row.get("sort_order") or 0,
                }
                for row in img_res.data
            ]
    except Exception:
        photos = []

    # Fetch comments from listing_comments table
    comments: list[dict[str, Any]] = []
    try:
        comment_res = (
            client.table("listing_comments")
            .select("id, commenter_name, comment_text, created_at")
            .eq("listing_id", listing["id"])
            .order("created_at", desc=True)
            .execute()
        )
        if comment_res and comment_res.data:
            comments = [
                {
                    "id": c["id"],
                    "commenter_name": c["commenter_name"],
                    "comment_text": c["comment_text"],
                    "created_at": c["created_at"],
                }
                for c in comment_res.data
            ]
    except Exception:
        comments = []

    # Pipeline progress stages
    current_stage = listing.get("stage") or "draft"
    pipeline = _build_pipeline_stages(current_stage)

    # Fixed LocalPRO Realty Brokerage branding
    brokerage = {
        "name": "LocalPRO Realty",
        "tagline": "A Modern Brokerage",
        "address": "5801 Headquarters Dr Ste 775, Plano, TX 75024",
        "phone": "(972) 996-5555",
        "website": "https://localprorealty.com",
    }

    # Strict privacy whitelist — no sellers, no brokermint, no access codes
    return {
        "id": listing["id"],
        "token": token,
        "address_full": listing.get("address_full") or "Undisclosed Address",
        "list_price": listing.get("list_price"),
        "stage": current_stage,
        "specs": specs,
        "description": description,
        "pipeline": pipeline,
        "photos": photos,
        "comments": comments,
        "agent": agent_data,
        "brokerage": brokerage,
    }


@router.post("/public/share/{token}/comments")
async def submit_public_comment(
    token: str,
    payload: CreatePublicCommentPayload,
    request: Request,
):
    """
    Public comment submission endpoint.
    No login required. Protected by IP rate limiting and a honeypot field.
    """
    if not token or len(token.strip()) < 8:
        raise HTTPException(status_code=404, detail="Shared listing not found.")

    # 1. IP rate limiting (max 5 per 10 minutes)
    client_ip = get_client_ip(request)
    check_ip_rate_limit(client_ip)

    # 2. Honeypot check: if hp_website is filled, bot trap activated
    if payload.hp_website and payload.hp_website.strip():
        return {
            "id": "spam-trap",
            "commenter_name": html.escape(payload.commenter_name.strip()),
            "comment_text": html.escape(payload.comment_text.strip()),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

    # 3. Clean and sanitize inputs
    clean_name = html.escape(payload.commenter_name.strip())
    clean_text = html.escape(payload.comment_text.strip())

    if len(clean_name) < 2 or len(clean_text) < 3:
        raise HTTPException(status_code=400, detail="Name or comment is too short.")

    client = get_service_client()

    # 4. Verify listing exists and is actively shared
    res = (
        client.table("listings")
        .select("id, is_publicly_shared")
        .eq("public_share_token", token.strip())
        .maybe_single()
        .execute()
    )
    listing = res.data if res else None
    if not listing or not listing.get("is_publicly_shared"):
        raise HTTPException(
            status_code=404,
            detail="Shared listing not found or link has expired.",
        )

    # 5. Insert comment using service role
    insert_res = (
        client.table("listing_comments")
        .insert({
            "listing_id": listing["id"],
            "commenter_name": clean_name,
            "comment_text": clean_text,
        })
        .execute()
    )

    if not insert_res.data:
        raise HTTPException(status_code=500, detail="Failed to save comment.")

    new_comment = insert_res.data[0]
    return {
        "id": new_comment["id"],
        "commenter_name": new_comment["commenter_name"],
        "comment_text": new_comment["comment_text"],
        "created_at": new_comment["created_at"],
    }


# ---------------------------------------------------------------------------
# Authenticated Agent Endpoints (Listing Management & Moderation)
# ---------------------------------------------------------------------------

@router.post("/listings/{listing_id}/share-link")
async def generate_share_link(
    listing_id: str,
    agent_id: str = Depends(require_agent),
):
    """
    Generate a new 192-bit secure share token for the listing and enable sharing.
    """
    client = get_service_client()
    listing = _require_agent_listing(client, listing_id, agent_id)

    # If already has token, we can retain it unless regenerated, but generate if absent
    token = listing.get("public_share_token") or secrets.token_urlsafe(24)
    now = datetime.now(timezone.utc).isoformat()

    client.table("listings").update({
        "public_share_token": token,
        "is_publicly_shared": True,
        "public_share_created_at": now,
    }).eq("id", listing_id).execute()

    return {
        "token": token,
        "is_publicly_shared": True,
        "share_url": f"/share/{token}",
        "created_at": now,
    }


@router.get("/listings/{listing_id}/share-link")
async def get_share_link_status(
    listing_id: str,
    agent_id: str = Depends(require_agent),
):
    """
    Get current share link status and token for a listing.
    """
    client = get_service_client()
    listing = _require_agent_listing(client, listing_id, agent_id)

    token = listing.get("public_share_token")
    is_shared = bool(listing.get("is_publicly_shared"))

    return {
        "token": token,
        "is_publicly_shared": is_shared,
        "share_url": f"/share/{token}" if token else None,
    }


@router.patch("/listings/{listing_id}/share-link")
async def update_share_link(
    listing_id: str,
    payload: UpdateShareLinkPayload,
    agent_id: str = Depends(require_agent),
):
    """
    Toggle public sharing on/off, or regenerate the secure token (invalidating previous links).
    """
    client = get_service_client()
    listing = _require_agent_listing(client, listing_id, agent_id)

    current_token = listing.get("public_share_token")
    updates: dict[str, Any] = {
        "is_publicly_shared": payload.is_publicly_shared,
    }

    token = current_token
    if payload.regenerate_token or (payload.is_publicly_shared and not current_token):
        token = secrets.token_urlsafe(24)
        updates["public_share_token"] = token
        updates["public_share_created_at"] = datetime.now(timezone.utc).isoformat()

    client.table("listings").update(updates).eq("id", listing_id).execute()

    return {
        "token": token,
        "is_publicly_shared": payload.is_publicly_shared,
        "share_url": f"/share/{token}" if token else None,
    }


@router.get("/listings/{listing_id}/comments")
async def get_listing_comments(
    listing_id: str,
    agent_id: str = Depends(require_agent),
):
    """
    Retrieve all public comments/feedback submitted on this listing.
    """
    client = get_service_client()
    _require_agent_listing(client, listing_id, agent_id)

    try:
        res = (
            client.table("listing_comments")
            .select("id, listing_id, commenter_name, comment_text, created_at")
            .eq("listing_id", listing_id)
            .order("created_at", desc=True)
            .execute()
        )
        return res.data or []
    except Exception:
        return []


@router.delete("/listings/{listing_id}/comments/{comment_id}")
async def delete_listing_comment(
    listing_id: str,
    comment_id: str,
    agent_id: str = Depends(require_agent),
):
    """
    Moderate/delete a comment from the listing.
    Agent must own the listing that the comment belongs to.
    """
    client = get_service_client()
    _require_agent_listing(client, listing_id, agent_id)

    # Verify comment belongs to this listing
    res = (
        client.table("listing_comments")
        .select("id, listing_id")
        .eq("id", comment_id)
        .maybe_single()
        .execute()
    )
    comment = res.data if res else None
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment.get("listing_id") != listing_id:
        raise HTTPException(status_code=400, detail="Comment does not belong to this listing")

    client.table("listing_comments").delete().eq("id", comment_id).execute()
    return {"status": "deleted", "comment_id": comment_id}
