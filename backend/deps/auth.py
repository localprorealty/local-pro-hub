from fastapi import Header, HTTPException

from config import get_settings


_client = None


def get_service_client():
    global _client
    if _client is None:
        settings = get_settings()
        url, key = settings.require_supabase()
        from supabase import create_client
        _client = create_client(url, key)
    return _client


def _profile_for_token(token: str) -> dict:
    # Use a temporary client for token validation to prevent mutating global service client headers
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
    result = (
        client.table("users")
        .select("id, role, status")
        .eq("id", user.id)
        .execute()
    )
    row = result.data[0] if result.data else None
    if not row or row.get("status") != "active":
        raise HTTPException(status_code=403, detail="Active account required.")

    return row


async def require_active_user(
    authorization: str | None = Header(default=None),
) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization token.")
    token = authorization.removeprefix("Bearer ").strip()
    row = _profile_for_token(token)
    return row["id"]


async def require_agent(
    authorization: str | None = Header(default=None),
) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization token.")
    token = authorization.removeprefix("Bearer ").strip()
    row = _profile_for_token(token)
    if row.get("role") != "agent":
        raise HTTPException(status_code=403, detail="Agent access required.")
    return row["id"]


async def require_photographer(
    authorization: str | None = Header(default=None),
) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization token.")
    token = authorization.removeprefix("Bearer ").strip()
    row = _profile_for_token(token)
    if row.get("role") != "photographer":
        raise HTTPException(status_code=403, detail="Photographer access required.")
    return row["id"]


def _profile_for_token_full(token: str) -> dict:
    # Use a temporary client for token validation to prevent mutating global service client headers
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
    result = (
        client.table("users")
        .select("id, role, status, email, can_view_revenue")
        .eq("id", user.id)
        .execute()
    )
    row = result.data[0] if result.data else None
    if not row or row.get("status") != "active":
        raise HTTPException(status_code=403, detail="Active account required.")

    return row


async def get_current_user(
    authorization: str | None = Header(default=None),
) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization token.")
    token = authorization.removeprefix("Bearer ").strip()
    return _profile_for_token_full(token)


async def require_admin(
    authorization: str | None = Header(default=None),
) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization token.")
    token = authorization.removeprefix("Bearer ").strip()
    row = _profile_for_token(token)
    if row.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required.")
    return row["id"]

