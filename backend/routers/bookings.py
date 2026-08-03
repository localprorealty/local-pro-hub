import calendar
from datetime import datetime, timezone
from typing import Any, Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from config import get_settings
from deps.auth import get_service_client, require_active_user, require_agent, require_photographer

router = APIRouter(prefix="/bookings", tags=["bookings"])

ACTIVE_BOOKING_STATUSES = ("pending", "confirmed")
NEGOTIATION_STATUSES = ("pending", "alt_suggested", "confirmed")


class CreateBookingRequest(BaseModel):
    listing_id: str
    photographer_id: str
    shoot_date: str
    shoot_time: str
    access_notes: str | None = None


class SuggestAlternateRequest(BaseModel):
    suggested_dates: list[str] = Field(min_length=1, max_length=3)
    suggested_times: list[str] = Field(min_length=1, max_length=3)
    note: str | None = None


class BlockedDatesRequest(BaseModel):
    blocked_dates: list[str]


class AgentRespondRequest(BaseModel):
    action: Literal["accept_alternate", "counter"]
    alternate_index: int | None = Field(default=None, ge=0, le=2)
    shoot_date: str | None = None
    shoot_time: str | None = None
    note: str | None = None


def _normalize_time(value: str) -> str:
    trimmed = value.strip()
    if len(trimmed) == 5:
        return f"{trimmed}:00"
    return trimmed


def _single_row(builder: Any) -> dict[str, Any] | None:
    """maybe_single().execute() returns None (not an empty response) when no row exists."""
    response = builder.maybe_single().execute()
    if response is None:
        return None
    data = response.data
    return data if isinstance(data, dict) else None


def _blocked_dates_from_row(row: dict[str, Any] | None) -> list[str]:
    if not row:
        return []
    blocked = row.get("blocked_dates")
    if isinstance(blocked, list):
        return [str(d) for d in blocked]
    return []


def _ensure_photographer_profile(
    client: Any,
    photographer_id: str,
) -> dict[str, Any]:
    row = _single_row(
        client.table("photographers")
        .select("id, tier, blocked_dates")
        .eq("id", photographer_id),
    )
    if row:
        return row

    user = _single_row(
        client.table("users")
        .select("photographer_tier")
        .eq("id", photographer_id)
        .eq("role", "photographer"),
    )
    tier = (user or {}).get("photographer_tier") or "standard"
    upserted = (
        client.table("photographers")
        .upsert(
            {
                "id": photographer_id,
                "tier": tier,
                "blocked_dates": [],
            },
        )
        .select("id, tier, blocked_dates")
        .execute()
    )
    if upserted.data:
        return upserted.data[0]
    return {"id": photographer_id, "tier": tier, "blocked_dates": []}


def _listing_address(listing_row: dict[str, Any]) -> str:
    if listing_row.get("address_full"):
        return str(listing_row["address_full"])
    form_data = listing_row.get("form_data") or {}
    if isinstance(form_data, dict):
        parts = [
            form_data.get("street_number"),
            form_data.get("street_name"),
            form_data.get("city"),
            form_data.get("state"),
            form_data.get("zip_code"),
        ]
        line = " ".join(str(p) for p in parts[:2] if p)
        city_line = ", ".join(str(p) for p in parts[2:] if p)
        if line and city_line:
            return f"{line}, {city_line}"
        if line:
            return line
    return "Address not set"


def _advance_listing_on_confirm(client: Any, listing_id: str | None) -> None:
    if not listing_id:
        return
    client.table("listings").update({"stage": "shoot_booked"}).eq(
        "id",
        listing_id,
    ).in_("stage", ["docs_signed"]).execute()


def _enrich_listing_booking(
    client: Any,
    row: dict[str, Any],
) -> dict[str, Any]:
    photographer = _single_row(
        client.table("users")
        .select("full_name, phone, photographer_tier")
        .eq("id", row["photographer_id"]),
    ) or {}
    return {
        "id": row["id"],
        "listing_id": row["listing_id"],
        "photographer_id": row["photographer_id"],
        "shoot_date": row["shoot_date"],
        "shoot_time": row["shoot_time"],
        "status": row["status"],
        "access_notes": row.get("access_notes"),
        "suggested_alternate": row.get("suggested_alternate"),
        "created_at": row.get("created_at"),
        "photographer_name": photographer.get("full_name"),
        "photographer_phone": photographer.get("phone"),
        "photographer_tier": photographer.get("photographer_tier"),
    }


async def _trigger_photographer_notification(
    *,
    booking_id: str,
    listing_row: dict[str, Any],
    photographer: dict[str, Any],
    shoot_date: str,
    shoot_time: str,
    access_notes: str | None,
) -> None:
    settings = get_settings()
    webhook_url = settings.n8n_booking_webhook_url.strip()
    if not webhook_url:
        return

    payload = {
        "event": "photography_booked",
        "booking_id": booking_id,
        "photographer_name": photographer.get("full_name", ""),
        "photographer_email": photographer.get("email", ""),
        "photographer_phone": photographer.get("phone", ""),
        "property_address": _listing_address(listing_row),
        "shoot_date": shoot_date,
        "shoot_time": shoot_time,
        "access_notes": access_notes or "None provided",
        "listing_type": listing_row.get("listing_type", "listing"),
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            await client.post(
                webhook_url,
                json=payload,
                headers={"Content-Type": "application/json"},
            )
    except httpx.HTTPError:
        pass


@router.get("/photographers")
async def list_photographers(
    tier: str | None = None,
    _user_id: str = Depends(require_active_user),
) -> list[dict[str, Any]]:
    client = get_service_client()
    query = (
        client.table("users")
        .select("id, full_name, phone, photographer_tier")
        .eq("role", "photographer")
        .eq("status", "active")
    )
    if tier:
        query = query.eq("photographer_tier", tier)
    result = query.order("full_name").execute()
    return result.data or []


@router.get("/photographer/{photographer_id}/availability")
async def get_availability(
    photographer_id: str,
    month: str = Query(..., pattern=r"^\d{4}-\d{2}$"),
    _user_id: str = Depends(require_active_user),
) -> dict[str, Any]:
    client = get_service_client()
    year_str, month_str = month.split("-")
    year, mon = int(year_str), int(month_str)
    last_day = calendar.monthrange(year, mon)[1]
    start = f"{month}-01"
    end = f"{month}-{last_day:02d}"

    ph_row = _ensure_photographer_profile(client, photographer_id)
    blocked = _blocked_dates_from_row(ph_row)

    booked = (
        client.table("bookings")
        .select("shoot_date, shoot_time, status")
        .eq("photographer_id", photographer_id)
        .gte("shoot_date", start)
        .lte("shoot_date", end)
        .in_("status", list(ACTIVE_BOOKING_STATUSES))
        .execute()
    )

    return {
        "blocked_dates": blocked,
        "booked_dates": [
            {"date": row["shoot_date"], "time": row["shoot_time"]}
            for row in (booked.data or [])
        ],
    }


@router.post("/create")
async def create_booking(
    req: CreateBookingRequest,
    agent_id: str = Depends(require_agent),
) -> dict[str, Any]:
    client = get_service_client()

    listing = _single_row(
        client.table("listings")
        .select("id, stage, agent_id, address_full, form_data, listing_type")
        .eq("id", req.listing_id),
    )
    if not listing or listing["agent_id"] != agent_id:
        raise HTTPException(status_code=403, detail="Not your listing")

    photographer = _single_row(
        client.table("users")
        .select("id, full_name, email, phone")
        .eq("id", req.photographer_id)
        .eq("role", "photographer")
        .eq("status", "active"),
    )
    if not photographer:
        raise HTTPException(status_code=404, detail="Photographer not found")

    ph_row = _ensure_photographer_profile(client, req.photographer_id)
    blocked = _blocked_dates_from_row(ph_row)
    if req.shoot_date in blocked:
        raise HTTPException(status_code=409, detail="Photographer unavailable on that date")

    open_booking = (
        client.table("bookings")
        .select("id")
        .eq("listing_id", req.listing_id)
        .in_("status", list(NEGOTIATION_STATUSES))
        .execute()
    )
    if open_booking.data:
        raise HTTPException(
            status_code=409,
            detail="This listing already has an active shoot request",
        )

    shoot_time = _normalize_time(req.shoot_time)
    existing = (
        client.table("bookings")
        .select("id")
        .eq("photographer_id", req.photographer_id)
        .eq("shoot_date", req.shoot_date)
        .eq("shoot_time", shoot_time)
        .in_("status", list(ACTIVE_BOOKING_STATUSES))
        .execute()
    )
    if existing.data:
        raise HTTPException(
            status_code=409,
            detail="Photographer already booked at that time",
        )

    now = datetime.now(timezone.utc).isoformat()
    booking = (
        client.table("bookings")
        .insert(
            {
                "listing_id": req.listing_id,
                "photographer_id": req.photographer_id,
                "shoot_date": req.shoot_date,
                "shoot_time": shoot_time,
                "status": "pending",
                "access_notes": req.access_notes,
                "photographer_notified_at": now,
            },
        )
        .execute()
    )
    if not booking.data:
        raise HTTPException(status_code=500, detail="Booking creation failed")

    booking_id = booking.data[0]["id"]

    await _trigger_photographer_notification(
        booking_id=booking_id,
        listing_row=listing,
        photographer=photographer,
        shoot_date=req.shoot_date,
        shoot_time=shoot_time,
        access_notes=req.access_notes,
    )

    return {"success": True, "booking_id": booking_id}


@router.get("/listing/{listing_id}")
async def get_listing_booking(
    listing_id: str,
    agent_id: str = Depends(require_agent),
) -> dict[str, Any] | None:
    client = get_service_client()
    listing = _single_row(
        client.table("listings")
        .select("id, agent_id")
        .eq("id", listing_id),
    )
    if not listing or listing["agent_id"] != agent_id:
        raise HTTPException(status_code=403, detail="Not your listing")

    rows = (
        client.table("bookings")
        .select(
            "id, listing_id, photographer_id, shoot_date, shoot_time, status, "
            "access_notes, suggested_alternate, created_at",
        )
        .eq("listing_id", listing_id)
        .in_("status", list(NEGOTIATION_STATUSES))
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if not rows.data:
        return None
    return _enrich_listing_booking(client, rows.data[0])


@router.get("/my-shoots")
async def my_shoots(
    photographer_id: str = Depends(require_photographer),
) -> list[dict[str, Any]]:
    client = get_service_client()
    bookings = (
        client.table("bookings")
        .select(
            "id, listing_id, shoot_date, shoot_time, status, access_notes, "
            "suggested_alternate, created_at, "
            "listings(address_full, form_data, listing_type, agent_id)"
        )
        .eq("photographer_id", photographer_id)
        .order("shoot_date")
        .execute()
    )
    rows = bookings.data or []

    enriched: list[dict[str, Any]] = []
    for row in rows:
        listing = row.get("listings") or {}
        agent_id = listing.get("agent_id")
        agent: dict[str, Any] = {}
        if agent_id:
            agent = _single_row(
                client.table("users")
                .select("full_name, phone, email")
                .eq("id", agent_id),
            ) or {}

        enriched.append(
            {
                "id": row["id"],
                "listing_id": row["listing_id"],
                "shoot_date": row["shoot_date"],
                "shoot_time": row["shoot_time"],
                "status": row["status"],
                "access_notes": row.get("access_notes"),
                "suggested_alternate": row.get("suggested_alternate"),
                "property_address": _listing_address(listing),
                "listing_type": listing.get("listing_type"),
                "agent_name": agent.get("full_name"),
                "agent_phone": agent.get("phone"),
                "agent_email": agent.get("email"),
            },
        )

    return enriched


@router.put("/photographer/blocked-dates")
async def update_blocked_dates(
    body: BlockedDatesRequest,
    photographer_id: str = Depends(require_photographer),
) -> dict[str, bool]:
    client = get_service_client()
    _ensure_photographer_profile(client, photographer_id)
    user = _single_row(
        client.table("users")
        .select("photographer_tier")
        .eq("id", photographer_id),
    )
    tier = (user or {}).get("photographer_tier") or "standard"
    client.table("photographers").upsert(
        {
            "id": photographer_id,
            "tier": tier,
            "blocked_dates": body.blocked_dates,
        },
    ).execute()
    return {"success": True}


@router.put("/{booking_id}/confirm")
async def confirm_booking(
    booking_id: str,
    photographer_id: str = Depends(require_photographer),
) -> dict[str, bool]:
    client = get_service_client()
    booking = _single_row(
        client.table("bookings")
        .select("id, photographer_id, listing_id, status")
        .eq("id", booking_id),
    )
    if not booking or booking["photographer_id"] != photographer_id:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking["status"] not in ("pending", "alt_suggested"):
        raise HTTPException(
            status_code=409,
            detail="Only pending shoot requests can be accepted",
        )

    client.table("bookings").update(
        {
            "status": "confirmed",
            "suggested_alternate": None,
        },
    ).eq("id", booking_id).execute()
    _advance_listing_on_confirm(client, booking.get("listing_id"))
    return {"success": True}


@router.put("/{booking_id}/complete")
async def complete_booking(
    booking_id: str,
    photographer_id: str = Depends(require_photographer),
) -> dict[str, bool]:
    client = get_service_client()
    booking = _single_row(
        client.table("bookings")
        .select("id, photographer_id, status")
        .eq("id", booking_id),
    )
    if not booking or booking["photographer_id"] != photographer_id:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.get("status") != "confirmed":
        raise HTTPException(
            status_code=409,
            detail="Only confirmed shoots can be marked complete",
        )

    client.table("bookings").update({"status": "completed"}).eq(
        "id",
        booking_id,
    ).execute()
    return {"success": True}


@router.post("/{booking_id}/suggest-alternate")
async def suggest_alternate(
    booking_id: str,
    req: SuggestAlternateRequest,
    photographer_id: str = Depends(require_photographer),
) -> dict[str, bool]:
    if len(req.suggested_dates) != len(req.suggested_times):
        raise HTTPException(
            status_code=400,
            detail="suggested_dates and suggested_times must match length",
        )

    client = get_service_client()
    booking = _single_row(
        client.table("bookings")
        .select("id, photographer_id, status, access_notes")
        .eq("id", booking_id),
    )
    if not booking or booking["photographer_id"] != photographer_id:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking["status"] != "pending":
        raise HTTPException(
            status_code=409,
            detail="Alternates can only be suggested for pending requests",
        )

    alternates = [
        {"date": d, "time": _normalize_time(t)}
        for d, t in zip(req.suggested_dates, req.suggested_times, strict=True)
    ]
    note = req.note or ""

    client.table("bookings").update(
        {
            "status": "alt_suggested",
            "suggested_alternate": {
                "options": alternates,
                "note": note,
                "proposed_by": "photographer",
            },
            "agent_notified_at": datetime.now(timezone.utc).isoformat(),
        },
    ).eq("id", booking_id).execute()

    return {"success": True}


@router.post("/{booking_id}/agent-respond")
async def agent_respond(
    booking_id: str,
    req: AgentRespondRequest,
    agent_id: str = Depends(require_agent),
) -> dict[str, bool]:
    client = get_service_client()
    booking = _single_row(
        client.table("bookings")
        .select(
            "id, listing_id, photographer_id, shoot_date, shoot_time, status, "
            "access_notes, suggested_alternate",
        )
        .eq("id", booking_id),
    )
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    listing = _single_row(
        client.table("listings")
        .select("id, agent_id")
        .eq("id", booking["listing_id"]),
    )
    if not listing or listing["agent_id"] != agent_id:
        raise HTTPException(status_code=403, detail="Not your listing")
    if booking["status"] != "alt_suggested":
        raise HTTPException(
            status_code=409,
            detail="No photographer alternate to respond to",
        )

    suggested = booking.get("suggested_alternate") or {}
    options = suggested.get("options") if isinstance(suggested, dict) else []
    if not isinstance(options, list):
        options = []

    if req.action == "accept_alternate":
        if req.alternate_index is None or req.alternate_index >= len(options):
            raise HTTPException(status_code=400, detail="Invalid alternate selection")
        chosen = options[req.alternate_index]
        new_date = str(chosen["date"])
        new_time = _normalize_time(str(chosen["time"]))
        photographer_note = suggested.get("note", "") if isinstance(suggested, dict) else ""
        alternate_payload = {
            "options": [{"date": new_date, "time": new_time}],
            "note": photographer_note,
            "proposed_by": "photographer",
        }
    else:
        if not req.shoot_date or not req.shoot_time:
            raise HTTPException(
                status_code=400,
                detail="shoot_date and shoot_time required for counter",
            )
        new_date = req.shoot_date
        new_time = _normalize_time(req.shoot_time)
        alternate_payload = {
            "options": [{"date": new_date, "time": new_time}],
            "note": req.note or "",
            "proposed_by": "agent",
        }

    client.table("bookings").update(
        {
            "shoot_date": new_date,
            "shoot_time": new_time,
            "status": "pending",
            "suggested_alternate": alternate_payload,
            "photographer_notified_at": datetime.now(timezone.utc).isoformat(),
        },
    ).eq("id", booking_id).execute()

    photographer = _single_row(
        client.table("users")
        .select("id, full_name, email, phone")
        .eq("id", booking["photographer_id"]),
    )
    listing_row = _single_row(
        client.table("listings")
        .select("address_full, form_data, listing_type")
        .eq("id", booking["listing_id"]),
    )
    if photographer and listing_row:
        notify_note = (
            alternate_payload.get("note")
            or (booking.get("access_notes") if isinstance(booking, dict) else None)
        )
        await _trigger_photographer_notification(
            booking_id=booking_id,
            listing_row=listing_row,
            photographer=photographer,
            shoot_date=new_date,
            shoot_time=new_time,
            access_notes=notify_note,
        )

    return {"success": True}
