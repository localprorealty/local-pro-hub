from datetime import date, datetime, timezone
from typing import Any, Literal

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel, Field, field_validator, model_validator

from config import get_settings

router = APIRouter(prefix="/admin", tags=["admin"])

MILESTONE_TYPES = frozenset({
    "agent_birthday",
    "work_anniversary",
    "wedding_anniversary",
    "spouse_birthday",
    "child_birthday",
    "home_purchase_anniversary",
    "license_renewal",
    "custom",
})

MilestoneType = Literal[
    "agent_birthday",
    "work_anniversary",
    "wedding_anniversary",
    "spouse_birthday",
    "child_birthday",
    "home_purchase_anniversary",
    "license_renewal",
    "custom",
]


def _normalize_email(value: str) -> str:
    normalized = value.strip().lower()
    if "@" not in normalized or "." not in normalized.split("@")[-1]:
        raise ValueError("Invalid email address.")
    return normalized


class AdminPatchUserBody(BaseModel):
    email: str | None = None
    full_name: str | None = None
    phone: str | None = None
    mls_id: str | None = Field(default=None, pattern=r"^\d{7}$")
    brokermint_id: str | None = None
    role: str | None = Field(default=None, pattern=r"^(agent|admin|photographer|marketing)$")
    status: str | None = Field(default=None, pattern=r"^(pending|active|suspended)$")
    photographer_tier: str | None = Field(
        default=None,
        pattern=r"^(elite|standard|basic)$",
    )
    approved_at: str | None = None

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _normalize_email(value)


class AdminCreateUserBody(BaseModel):
    email: str
    password: str = Field(min_length=8)
    full_name: str
    phone: str
    mls_id: str = Field(pattern=r"^\d{7}$")
    brokermint_id: str
    role: str = Field(pattern=r"^(agent|admin|photographer|marketing)$")
    status: str = Field(pattern=r"^(pending|active|suspended)$")
    photographer_tier: str = Field(pattern=r"^(elite|standard|basic)$")

    @field_validator("email")
    @classmethod
    def validate_create_email(cls, value: str) -> str:
        return _normalize_email(value)


_client = None


def get_service_client():
    global _client
    if _client is None:
        settings = get_settings()
        url, key = settings.require_supabase()
        from supabase import create_client
        _client = create_client(url, key)
    return _client


async def require_admin(authorization: str | None = Header(default=None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization token.")

    token = authorization.removeprefix("Bearer ").strip()
    
    settings = get_settings()
    url, key = settings.require_supabase()
    from supabase import create_client
    temp_client = create_client(url, key)

    try:
        user_response = temp_client.auth.get_user(token)
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Invalid session.") from exc

    user = user_response.user
    if not user:
        raise HTTPException(status_code=401, detail="Invalid session.")

    client = get_service_client()
    profile = (
        client.table("users")
        .select("id, role, status")
        .eq("id", user.id)
        .execute()
    )

    row = profile.data[0] if profile.data else None
    if not row or row.get("role") != "admin" or row.get("status") != "active":
        raise HTTPException(status_code=403, detail="Admin access required.")

    return user.id


@router.post("/users")
def create_user(
    body: AdminCreateUserBody,
    _admin_id: str = Depends(require_admin),
) -> dict[str, Any]:
    client = get_service_client()

    try:
        created = client.auth.admin.create_user(
            {
                "email": body.email.strip(),
                "password": body.password,
                "email_confirm": True,
                "user_metadata": {
                    "full_name": body.full_name.strip(),
                    "phone": body.phone,
                    "mls_id": body.mls_id,
                    "brokermint_id": body.brokermint_id.strip(),
                    "license_number": body.brokermint_id.strip(),
                    "photographer_tier": body.photographer_tier,
                },
            }
        )
    except Exception as exc:
        message = str(exc)
        if "already" in message.lower():
            raise HTTPException(status_code=409, detail="User already registered.") from exc
        raise HTTPException(status_code=400, detail=message) from exc

    user = created.user
    if not user:
        raise HTTPException(status_code=500, detail="User creation failed.")

    patch: dict[str, Any] = {
        "role": body.role,
        "status": body.status,
        "full_name": body.full_name.strip(),
        "phone": body.phone,
        "mls_id": body.mls_id,
        "brokermint_id": body.brokermint_id.strip(),
        "photographer_tier": body.photographer_tier,
    }
    if body.status == "active":
        patch["approved_at"] = datetime.now(timezone.utc).isoformat()
        patch["approved_by"] = _admin_id

    client.table("users").update(patch).eq("id", user.id).execute()

    return {"id": user.id, "email": str(body.email).strip()}


@router.patch("/users/{user_id}")
def patch_user(
    user_id: str,
    body: AdminPatchUserBody,
    _admin_id: str = Depends(require_admin),
) -> dict[str, Any]:
    client = get_service_client()

    existing = (
        client.table("users")
        .select("id, email")
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )
    row = existing.data
    if not row:
        raise HTTPException(status_code=404, detail="User not found.")

    patch = body.model_dump(exclude_none=True)
    new_email = patch.pop("email", None)

    if new_email:
        normalized = _normalize_email(str(new_email))
        current = (row.get("email") or "").strip().lower()
        if normalized != current:
            try:
                client.auth.admin.update_user_by_id(
                    user_id,
                    {"email": normalized},
                )
            except Exception as exc:
                message = str(exc)
                if "already" in message.lower():
                    raise HTTPException(
                        status_code=409,
                        detail="Email already in use.",
                    ) from exc
                raise HTTPException(status_code=400, detail=message) from exc
            patch["email"] = normalized

    if not patch:
        raise HTTPException(status_code=400, detail="No fields to update.")

    try:
        updated = (
            client.table("users")
            .update(patch)
            .eq("id", user_id)
            .select(
                "id, email, full_name, phone, mls_id, brokermint_id, role, status, "
                "photographer_tier, created_at, approved_at"
            )
            .single()
            .execute()
        )
    except Exception as exc:
        message = str(exc)
        if "unique" in message.lower() or "duplicate" in message.lower():
            raise HTTPException(status_code=409, detail="Email already in use.") from exc
        raise HTTPException(status_code=400, detail=message) from exc

    if not updated.data:
        raise HTTPException(status_code=500, detail="Update failed.")

    return updated.data


class MilestoneInput(BaseModel):
    milestone_type: MilestoneType
    event_date: date
    person_name: str | None = None
    custom_label: str | None = None
    send_lead_days: int = Field(default=0, ge=0, le=365)
    notes: str | None = None

    @field_validator("person_name", "custom_label", "notes")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None

    @model_validator(mode="after")
    def validate_custom_label(self) -> "MilestoneInput":
        if self.milestone_type == "custom" and not self.custom_label:
            raise ValueError("custom_label is required when milestone_type is custom.")
        if self.milestone_type in {"child_birthday", "spouse_birthday"} and not self.person_name:
            raise ValueError("person_name is required for child and spouse birthdays.")
        if self.milestone_type == "home_purchase_anniversary" and not self.custom_label:
            raise ValueError(
                "custom_label (e.g. property address) is required for home purchase anniversary."
            )
        return self


class ReplaceMilestonesBody(BaseModel):
    milestones: list[MilestoneInput] = Field(default_factory=list)


class AutomationTemplatePatchBody(BaseModel):
    subject_template: str | None = None
    html_body: str | None = None
    is_active: bool | None = None

    @field_validator("subject_template", "html_body")
    @classmethod
    def strip_required_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        if not stripped:
            raise ValueError("Field cannot be empty.")
        return stripped


@router.get("/users/{user_id}/milestones")
def get_user_milestones(
    user_id: str,
    _admin_id: str = Depends(require_admin),
) -> list[dict[str, Any]]:
    client = get_service_client()

    user = (
        client.table("users")
        .select("id")
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )
    if not user.data:
        raise HTTPException(status_code=404, detail="User not found.")

    rows = (
        client.table("agent_milestones")
        .select(
            "id, user_id, milestone_type, event_date, person_name, custom_label, "
            "send_lead_days, notes, created_at, updated_at"
        )
        .eq("user_id", user_id)
        .order("event_date")
        .execute()
    )
    return rows.data or []


@router.put("/users/{user_id}/milestones")
def replace_user_milestones(
    user_id: str,
    body: ReplaceMilestonesBody,
    _admin_id: str = Depends(require_admin),
) -> list[dict[str, Any]]:
    client = get_service_client()

    user = (
        client.table("users")
        .select("id")
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )
    if not user.data:
        raise HTTPException(status_code=404, detail="User not found.")

    client.table("agent_milestones").delete().eq("user_id", user_id).execute()

    if not body.milestones:
        return []

    payload = [
        {
            "user_id": user_id,
            "milestone_type": item.milestone_type,
            "event_date": item.event_date.isoformat(),
            "person_name": item.person_name,
            "custom_label": item.custom_label,
            "send_lead_days": item.send_lead_days,
            "notes": item.notes,
        }
        for item in body.milestones
    ]

    try:
        inserted = (
            client.table("agent_milestones")
            .insert(payload)
            .select(
                "id, user_id, milestone_type, event_date, person_name, custom_label, "
                "send_lead_days, notes, created_at, updated_at"
            )
            .execute()
        )
    except Exception as exc:
        message = str(exc)
        if "unique" in message.lower() or "duplicate" in message.lower():
            raise HTTPException(
                status_code=409,
                detail="Duplicate milestone: same type, date, and person name.",
            ) from exc
        raise HTTPException(status_code=400, detail=message) from exc

    return inserted.data or []


@router.get("/milestone-counts")
def get_milestone_counts(
    user_ids: str = Query(..., description="Comma-separated user UUIDs"),
    _admin_id: str = Depends(require_admin),
) -> dict[str, int]:
    ids = [part.strip() for part in user_ids.split(",") if part.strip()]
    if not ids:
        return {}

    client = get_service_client()
    rows = (
        client.table("agent_milestones")
        .select("user_id")
        .in_("user_id", ids)
        .execute()
    )

    counts: dict[str, int] = {uid: 0 for uid in ids}
    for row in rows.data or []:
        uid = row.get("user_id")
        if uid in counts:
            counts[uid] += 1
    return counts


@router.get("/automation-templates")
def list_automation_templates(
    _admin_id: str = Depends(require_admin),
) -> list[dict[str, Any]]:
    client = get_service_client()
    rows = (
        client.table("automation_email_templates")
        .select(
            "id, milestone_type, subject_template, html_body, is_active, "
            "created_at, updated_at"
        )
        .order("milestone_type")
        .execute()
    )
    return rows.data or []


@router.patch("/automation-templates/{milestone_type}")
def patch_automation_template(
    milestone_type: str,
    body: AutomationTemplatePatchBody,
    _admin_id: str = Depends(require_admin),
) -> dict[str, Any]:
    if milestone_type not in MILESTONE_TYPES:
        raise HTTPException(status_code=400, detail="Invalid milestone_type.")

    patch = body.model_dump(exclude_none=True)
    if not patch:
        raise HTTPException(status_code=400, detail="No fields to update.")

    client = get_service_client()
    try:
        updated = (
            client.table("automation_email_templates")
            .update(patch)
            .eq("milestone_type", milestone_type)
            .select(
                "id, milestone_type, subject_template, html_body, is_active, "
                "created_at, updated_at"
            )
            .single()
            .execute()
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if not updated.data:
        raise HTTPException(status_code=404, detail="Template not found.")

    return updated.data


class RunMilestonesBody(BaseModel):
    force: bool = True


@router.get("/automations/sends-today")
def list_milestone_sends_today(
    on_date: date | None = Query(default=None, alias="date"),
    _admin_id: str = Depends(require_admin),
) -> list[dict[str, Any]]:
    client = get_service_client()
    target = on_date or date.today()
    try:
        rows = client.rpc(
            "get_milestone_sends_for_date",
            {"target_date": target.isoformat()},
        ).execute()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return rows.data or []


@router.post("/automations/run-milestones")
async def run_milestone_automation(
    body: RunMilestonesBody | None = None,
    _admin_id: str = Depends(require_admin),
) -> dict[str, Any]:
    """Trigger n8n milestone branch now (admin manual run)."""
    settings = get_settings()
    webhook_url = settings.n8n_milestone_webhook_url.strip()
    if not webhook_url:
        raise HTTPException(
            status_code=503,
            detail="N8N_MILESTONE_WEBHOOK_URL not set in backend/.env",
        )

    if "/webhook-test/" in webhook_url:
        raise HTTPException(
            status_code=400,
            detail=(
                "Use the production webhook URL (/webhook/localpro-run-milestones), "
                "not the test URL (/webhook-test/...). Activate the workflow in n8n first."
            ),
        )

    force = body.force if body else True
    payload = {"force": force, "triggered_at": datetime.now(timezone.utc).isoformat()}

    try:
        async with httpx.AsyncClient(timeout=60.0) as http:
            response = await http.post(
                webhook_url,
                json=payload,
                headers={"Content-Type": "application/json"},
            )
            response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        message = "n8n webhook failed."
        hint = "Open n8n → LocalPRO — All Automations → toggle Active ON. Copy Production URL from Webhook — Run milestones now (not webhook-test)."
        if exc.response is not None:
            try:
                data = exc.response.json()
                if isinstance(data, dict):
                    message = str(data.get("message") or message)
                    hint = str(data.get("hint") or hint)
            except Exception:
                message = exc.response.text or message
        raise HTTPException(
            status_code=502,
            detail=f"{message} {hint}",
        ) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Could not reach n8n: {exc}",
        ) from exc

    return {"ok": True, "force": force}
