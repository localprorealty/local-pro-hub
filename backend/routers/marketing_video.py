import time
from typing import Any, Optional

import groq
import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

from config import get_settings
from deps.auth import get_service_client, require_agent

router = APIRouter(prefix="/marketing", tags=["marketing_video"])

HEYGEN_BASE_URL = "https://api.heygen.com"
AVATAR_BUCKET = "agent-avatars"
MAX_AVATAR_VIDEO_BYTES = 50 * 1024 * 1024
ALLOWED_VIDEO_TYPES = {"video/mp4", "video/webm", "video/quicktime"}


def _normalize_video_content_type(content_type: str | None) -> str:
    """Strip codec params (e.g. video/webm;codecs=vp8,opus → video/webm)."""
    raw = (content_type or "video/mp4").lower().strip()
    return raw.split(";", 1)[0].strip()


def _video_extension_for_content_type(content_type: str) -> str:
    if content_type == "video/webm":
        return "webm"
    if content_type == "video/quicktime":
        return "mov"
    return "mp4"


def _detect_video_content_type(video_bytes: bytes, declared: str) -> str:
    """Prefer declared type; fall back to magic-byte sniffing."""
    if len(video_bytes) >= 4 and video_bytes[:4] == b"\x1a\x45\xdf\xa3":
        return "video/webm"
    if len(video_bytes) >= 8 and video_bytes[4:8] == b"ftyp":
        return "video/mp4"
    return declared

BACKGROUND_MAP: dict[str, dict[str, str]] = {
    "clean_white": {"type": "color", "value": "#FFFFFF"},
    "dark_studio": {"type": "color", "value": "#1a1a1a"},
    "blurred_outdoor": {
        "type": "image",
        "url": "https://images.unsplash.com/photo-1582407940307-76b7e4e9a55c?w=1920&q=80",
    },
    "office": {
        "type": "image",
        "url": "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1920&q=80",
    },
    "bookshelf": {
        "type": "image",
        "url": "https://images.unsplash.com/photo-1521587760476-6c12a4bc040a?w=1920&q=80",
    },
    "gradient": {
        "type": "image",
        "url": "https://images.unsplash.com/photo-1557683316-973673baf926?w=1920&q=80",
    },
}


def _background_uses_image(background_key: str) -> bool:
    setting = BACKGROUND_MAP.get(background_key, BACKGROUND_MAP["clean_white"])
    return setting.get("type") == "image"

ASPECT_RATIO_MAP: dict[str, str] = {
    "9:16": "9:16",
    "16:9": "16:9",
    "1:1": "1:1",
}

AUDIENCE_MAP: dict[str, str] = {
    "first_time_buyers": (
        "first-time homebuyers who are nervous, don't know "
        "the process, and need reassurance and education"
    ),
    "move_up_buyers": (
        "existing homeowners looking to upsize, who already "
        "understand real estate basics and care about schools, "
        "neighborhoods, and timing"
    ),
    "sellers": (
        "homeowners thinking about selling, who want to know "
        "their home's value, how long it will take, and how "
        "to get the most money"
    ),
    "investors": (
        "real estate investors who think in numbers — ROI, "
        "cash flow, cap rate, appreciation. Skip the emotion, "
        "lead with data"
    ),
}

STYLE_MAP: dict[str, str] = {
    "talking_head": (
        "Direct to camera. Open with a confident statement. "
        "Deliver your core message in 2-3 sentences. "
        "Close with CTA. Professional but approachable."
    ),
    "story_time": (
        "Open with 'I was working with a client...' or "
        "'Last week something happened that...' — tell a "
        "brief real story (20 seconds) then deliver the lesson "
        "and CTA. Makes it personal and relatable."
    ),
    "qa_hook": (
        "Open with THE question your audience is already asking. "
        "Literally start with the question. Then answer it "
        "directly and confidently. End with CTA. "
        "Example: 'Is now a good time to buy? Here's the truth...'"
    ),
    "data_drop": (
        "Open with a specific number or statistic that is "
        "surprising or counterintuitive. 'Did you know X% of...' "
        "or 'In the last 30 days, [specific market data]...' "
        "Make the number feel relevant, then explain what it "
        "means for them."
    ),
    "announcement": (
        "High energy reveal format. Build anticipation in the "
        "first sentence. Make the announcement feel exciting. "
        "Give the key details quickly. End with urgency in CTA."
    ),
    "quick_tip": (
        "Fast, punchy, numbered if possible. "
        "'Three things buyers always get wrong: one... two... "
        "three...' Or a single tip explained in 3 sentences. "
        "Fast pacing. Immediately actionable."
    ),
}

PACING_MAP: dict[str, str] = {
    "slow": (
        "Write with natural pauses. Shorter sentences. "
        "Use ellipses (...) sparingly to suggest a breath. "
        "About 100 words for 45-50 seconds. "
        "Clear, simple language — every word counts."
    ),
    "normal": (
        "Conversational pace. 110-130 words for ~45 seconds. "
        "Mix sentence lengths. Natural flow."
    ),
    "fast": (
        "Punchy. Short sentences. High energy. No filler words. "
        "130-150 words for ~45 seconds but feels fast. "
        "Rhythm-driven. Like a radio ad."
    ),
}

CTA_MAP: dict[str, str] = {
    "call_me": "Call or text me — my number is in my bio.",
    "visit_website": "Check out my website — link in bio.",
    "dm_instagram": "DM me anytime — I reply to everyone.",
}

TOPIC_MAP: dict[str, str] = {
    "market_update": "the current DFW North Texas real estate market",
    "new_listing": "a new listing",
    "just_sold": "a property I just sold",
    "buyer_tips": "practical advice for buyers in today's market",
    "seller_tips": "how sellers can maximize their results right now",
    "open_house": "an upcoming open house",
    "neighborhood_spotlight": "why people love living in a specific neighborhood",
    "why_work_with_me": "why clients choose me as their agent",
    "interest_rate_update": "what current mortgage rates mean right now",
    "my_story": "my background and passion for real estate",
}


def _heygen_headers(api_key: str, json_body: bool = True) -> dict[str, str]:
    headers = {"X-Api-Key": api_key, "Accept": "application/json"}
    if json_body:
        headers["Content-Type"] = "application/json"
    return headers


def _require_heygen_key() -> str:
    settings = get_settings()
    try:
        return settings.require_heygen()
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


def _heygen_error_detail(response: httpx.Response) -> str:
    text = response.text.strip()
    if text.lstrip().startswith("<!DOCTYPE") or text.lstrip().startswith("<html"):
        return "HeyGen returned an unexpected server error. Try again in a moment."
    try:
        body = response.json()
        error = body.get("error") if isinstance(body, dict) else None
        if isinstance(error, dict):
            code = str(error.get("code") or "")
            message = str(error.get("message") or "")
            if code == "avatar_consent_required":
                return (
                    "Avatar consent is required before video generation. "
                    "Complete the one-time consent step in Market Yourself, then try again."
                )
            if message:
                return f"HeyGen error: {message}"
    except Exception:
        pass
    return f"HeyGen error: {text}"


def _frontend_base_url() -> str:
    settings = get_settings()
    if settings.frontend_url.strip():
        return settings.frontend_url.strip().rstrip("/")
    origins = settings.cors_origin_list
    return origins[0].rstrip("/") if origins else "http://localhost:5173"


CONSENT_APPROVED_STATUSES = frozenset(
    {"approved", "accepted", "completed", "verified", "granted"}
)


def _consent_approved(consent_status: str | None) -> bool:
    if not consent_status:
        return False
    return str(consent_status).lower().strip() in CONSENT_APPROVED_STATUSES


async def _heygen_get_avatar_group(api_key: str, group_id: str) -> dict[str, Any]:
    headers = _heygen_headers(api_key, json_body=False)
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(
            f"{HEYGEN_BASE_URL}/v3/avatars/{group_id}",
            headers=headers,
        )
    if response.status_code != 200:
        raise HTTPException(status_code=502, detail=_heygen_error_detail(response))
    body: dict[str, Any] = response.json()
    return body.get("data") or body


def _get_agent_avatar_row(agent_id: str) -> dict[str, Any]:
    client = get_service_client()
    result = (
        client.table("users")
        .select(
            "heygen_avatar_id, heygen_avatar_group_id, "
            "heygen_avatar_created_at, heygen_avatar_thumbnail_url, full_name, "
            "heygen_avatar_type, heygen_voice_id, heygen_talking_photo_id"
        )
        .eq("id", agent_id)
        .single()
        .execute()
    )
    return result.data or {}


def _require_agent_avatar_group_id(agent_id: str) -> str:
    row = _get_agent_avatar_row(agent_id)
    group_id = str(row.get("heygen_avatar_group_id") or "").strip()
    if not group_id:
        raise HTTPException(
            status_code=400,
            detail="No avatar group found. Finish avatar training first.",
        )
    return group_id


def _topic_context(req: "GenerateScriptRequest") -> str:
    if req.topic == "new_listing" and req.property_address:
        return f"The property is at {req.property_address}."
    if req.topic == "open_house":
        return (
            f"Open house at {req.open_house_address or 'TBD'} "
            f"on {req.open_house_date or 'TBD'} "
            f"at {req.open_house_time or 'TBD'}."
        )
    if req.topic == "neighborhood_spotlight" and req.neighborhood:
        return f"Focus on {req.neighborhood}."
    return ""


def _load_prompt_template(filename: str) -> str:
    import os
    path = os.path.join(os.path.dirname(__file__), "..", "prompts", filename)
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def build_script_prompt(req: "GenerateScriptRequest") -> tuple[str, str]:
    topic_line = TOPIC_MAP.get(req.topic, req.topic)
    if req.topic == "new_listing" and req.property_address:
        topic_line = f"a new listing at {req.property_address}"
    if req.topic == "just_sold":
        topic_line = f"a property I just sold{f' — {req.sale_detail}' if req.sale_detail else ''}"
    if req.topic == "open_house":
        topic_line = (
            f"an open house at {req.open_house_address or 'a great property'} "
            f"on {req.open_house_date or 'this weekend'} "
            f"at {req.open_house_time or 'noon'}"
        )
    if req.topic == "neighborhood_spotlight" and req.neighborhood:
        topic_line = f"why people love living in {req.neighborhood}"

    extra = _topic_context(req)
    cta_text = CTA_MAP.get(req.cta, req.cta)
    scenario_prompt_val = req.scenario_prompt or ""
    visual_environment_val = req.visual_environment or ""
    extra_context_val = req.extra_context or ""

    outfit_map = {
        "default": "default/none",
        "professional_suit": "professional navy suit",
        "smart_casual": "smart casual (blazer and shirt)",
        "business_casual": "business casual (polo or sweater)",
        "casual": "casual (t-shirt / everyday)",
    }
    outfit_val = outfit_map.get(req.outfit or "default", "default/none")

    if req.refinement and req.current_script:
        system = _load_prompt_template("script_system_prompt.txt")
        user = f"""The agent wants to revise their existing script, storyboard, and prompt.

Current Script & Storyboard JSON:
{req.current_script}

Revision instruction:
"{req.refinement}"

Preserve the following settings where possible:
Agent Name: {req.agent_name}
Brokerage: Local Pro Realty (Dallas-Fort Worth, Texas)
Tone: {req.tone}
Outfit Style Preference: {outfit_val}
End with: "{cta_text}"
"""
        return system, user

    system = _load_prompt_template("script_system_prompt.txt")
    user_template = _load_prompt_template("script_user_prompt.txt")
    user = user_template.format(
        agent_name=req.agent_name,
        topic_line=topic_line,
        pacing=req.pacing,
        tone=req.tone,
        cta_text=cta_text,
        scenario_prompt=scenario_prompt_val,
        visual_environment=visual_environment_val,
        extra=extra,
        extra_context=extra_context_val,
        outfit_description=outfit_val,
    )
    return system, user


async def _upload_avatar_video_to_supabase(
    video_bytes: bytes,
    agent_id: str,
    content_type: str,
) -> str:
    settings = get_settings()
    settings.require_supabase()
    client = get_service_client()
    ext = _video_extension_for_content_type(content_type)
    filename = f"{agent_id}/{int(time.time())}.{ext}"
    try:
        client.storage.from_(AVATAR_BUCKET).upload(
            filename,
            video_bytes,
            file_options={"content-type": content_type, "upsert": "true"},
        )
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=(
                f"Failed to upload training video to storage. "
                f"Ensure bucket '{AVATAR_BUCKET}' exists and is public. {exc}"
            ),
        ) from exc

    public = client.storage.from_(AVATAR_BUCKET).get_public_url(filename)
    if isinstance(public, dict):
        return str(public.get("publicUrl") or public.get("publicURL") or "")
    return str(public)


def _save_agent_avatar(
    agent_id: str,
    look_id: str,
    group_id: str | None,
    thumbnail_url: str | None,
) -> None:
    client = get_service_client()
    payload: dict[str, Any] = {
        "heygen_avatar_id": look_id,
        "heygen_avatar_group_id": group_id,
        "heygen_avatar_created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "heygen_avatar_thumbnail_url": thumbnail_url,
    }
    client.table("users").update(payload).eq("id", agent_id).execute()


class AvatarSettingsRequest(BaseModel):
    avatar_type: str
    avatar_id: Optional[str] = None
    voice_id: Optional[str] = None
    talking_photo_id: Optional[str] = None


class GenerateScriptRequest(BaseModel):
    topic: str
    audience: Optional[str] = None
    content_style: Optional[str] = None
    tone: str
    pacing: str
    cta: str
    extra_context: Optional[str] = None
    agent_name: str
    agent_phone: Optional[str] = None
    property_address: Optional[str] = None
    neighborhood: Optional[str] = None
    open_house_address: Optional[str] = None
    open_house_date: Optional[str] = None
    open_house_time: Optional[str] = None
    sale_detail: Optional[str] = None
    refinement: Optional[str] = None
    current_script: Optional[str] = None
    scenario_prompt: Optional[str] = None
    visual_environment: Optional[str] = None
    outfit: Optional[str] = None


class GenerateVideoRequest(BaseModel):
    script: str
    avatar_id: str
    voice_id: str
    background: str
    aspect_ratio: str
    agent_name: str


class GenerateVideoAgentRequest(BaseModel):
    prompt: str
    avatar_id: str
    voice_id: str
    orientation: str = "portrait"
    agent_name: str
    script: Optional[str] = None
    scenes: Optional[list[dict[str, Any]]] = None


class GenerateTeleprompterRequest(BaseModel):
    agent_name: str = Field(min_length=1)


@router.get("/avatar")
async def get_agent_avatar(agent_id: str = Depends(require_agent)) -> dict[str, Any]:
    row = _get_agent_avatar_row(agent_id)
    group_id = row.get("heygen_avatar_group_id")
    consent_status: str | None = None
    consent_required = False

    if group_id:
        try:
            api_key = _require_heygen_key()
            group = await _heygen_get_avatar_group(api_key, str(group_id))
            consent_status = group.get("consent_status")
            consent_required = not _consent_approved(
                str(consent_status) if consent_status is not None else None
            )
        except HTTPException:
            raise
        except Exception:
            # Avatar profile still loads if HeyGen is temporarily unreachable.
            pass

    return {
        "avatar_id": row.get("heygen_avatar_id"),
        "group_id": group_id,
        "created_at": row.get("heygen_avatar_created_at"),
        "thumbnail_url": row.get("heygen_avatar_thumbnail_url"),
        "has_avatar": bool(row.get("heygen_avatar_id") or row.get("heygen_talking_photo_id")),
        "consent_status": consent_status,
        "consent_required": consent_required,
        "avatar_type": row.get("heygen_avatar_type") or "digital_twin",
        "voice_id": row.get("heygen_voice_id"),
        "talking_photo_id": row.get("heygen_talking_photo_id"),
    }


def trim_video_to_30s(data: bytes, content_type: str) -> bytes:
    import subprocess
    import tempfile
    import os

    ffmpeg_bin = "/opt/homebrew/bin/ffmpeg"
    if not os.path.exists(ffmpeg_bin):
        ffmpeg_bin = "ffmpeg"

    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as temp_in:
        temp_in.write(data)
        temp_in_path = temp_in.name

    temp_out_path = temp_in_path + "_trimmed.mp4"
    try:
        cmd = [
            ffmpeg_bin,
            "-y",
            "-ss", "00:00:00",
            "-i", temp_in_path,
            "-t", "30",
            "-c", "copy",
            temp_out_path
        ]
        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=20.0)
        if result.returncode != 0:
            cmd_reencode = [
                ffmpeg_bin,
                "-y",
                "-ss", "00:00:00",
                "-i", temp_in_path,
                "-t", "30",
                "-c:v", "libx264",
                "-preset", "veryfast",
                "-c:a", "aac",
                temp_out_path
            ]
            subprocess.run(cmd_reencode, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=30.0)

        if os.path.exists(temp_out_path) and os.path.getsize(temp_out_path) > 0:
            with open(temp_out_path, "rb") as f:
                trimmed_data = f.read()
            return trimmed_data
    except Exception as exc:
        print(f"Video trimming failed: {exc}")
    finally:
        try:
            os.unlink(temp_in_path)
            if os.path.exists(temp_out_path):
                os.unlink(temp_out_path)
        except Exception:
            pass

    return data


async def _upload_to_heygen_assets(
    api_key: str,
    data: bytes,
    filename: str,
    content_type: str,
) -> str:
    headers = _heygen_headers(api_key)
    init_payload = {
        "filename": filename,
        "content_type": content_type,
        "size_bytes": len(data),
    }
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{HEYGEN_BASE_URL}/v3/assets/direct-uploads",
            headers=headers,
            json=init_payload,
        )
        if response.status_code not in (200, 201):
            raise HTTPException(
                status_code=502,
                detail=f"HeyGen asset initialization failed: {_heygen_error_detail(response)}",
            )
        
        body = response.json()
        data_block = body.get("data") or {}
        asset_id = data_block.get("id") or data_block.get("asset_id")
        upload_url = data_block.get("upload_url")
        upload_headers = data_block.get("upload_headers") or {}
        
        if not asset_id or not upload_url:
            raise HTTPException(
                status_code=502,
                detail=f"HeyGen asset initialization did not return upload details: {body}",
            )
            
    # Do NOT inject headers since S3 pre-signed URL has exact signed headers already in upload_headers
    put_headers = {str(k): str(v) for k, v in upload_headers.items()}

    async with httpx.AsyncClient(timeout=180.0) as client:
        put_response = await client.put(
            upload_url,
            headers=put_headers,
            content=data,
        )
        if put_response.status_code not in (200, 201, 204):
            raise HTTPException(
                status_code=502,
                detail=f"Failed to upload raw video to HeyGen storage: {put_response.status_code} - {put_response.text}",
            )

    async with httpx.AsyncClient(timeout=30.0) as client:
        complete_response = await client.post(
            f"{HEYGEN_BASE_URL}/v3/assets/{asset_id}/complete",
            headers=headers,
        )
        if complete_response.status_code not in (200, 201):
            raise HTTPException(
                status_code=502,
                detail=f"HeyGen asset finalization failed: {_heygen_error_detail(complete_response)}",
            )

    return str(asset_id)


@router.post("/avatar-settings")
async def update_avatar_settings(
    req: AvatarSettingsRequest,
    agent_id: str = Depends(require_agent),
) -> dict[str, str]:
    if req.avatar_type not in ("digital_twin", "talking_photo"):
        raise HTTPException(status_code=400, detail="Invalid avatar type.")

    client = get_service_client()
    payload = {
        "heygen_avatar_type": req.avatar_type,
        "heygen_avatar_id": req.avatar_id.strip() if req.avatar_id else None,
        "heygen_voice_id": req.voice_id.strip() if req.voice_id else None,
        "heygen_talking_photo_id": req.talking_photo_id.strip() if req.talking_photo_id else None,
    }
    try:
        client.table("users").update(payload).eq("id", agent_id).execute()
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to update avatar settings: {exc}",
        ) from exc

    return {"status": "success"}


@router.post("/upload-avatar-photo")
async def upload_avatar_photo(
    file: UploadFile = File(...),
    agent_name: str = Form(""),
    agent_id: str = Depends(require_agent),
) -> dict[str, str]:
    api_key = _require_heygen_key()

    content_type = file.content_type or ""
    if not (content_type.startswith("image/jpeg") or content_type.startswith("image/png")):
        raise HTTPException(
            status_code=400,
            detail="Photo must be a JPEG or PNG image.",
        )

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty photo file.")

    # 1. Upload Asset to HeyGen
    headers = {"X-Api-Key": api_key}
    files = {"file": (file.filename or "headshot.jpg", data, content_type)}

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{HEYGEN_BASE_URL}/v3/assets",
                headers=headers,
                files=files,
            )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"HeyGen asset upload failed: {exc}") from exc

    if response.status_code not in (200, 201):
        raise HTTPException(status_code=502, detail=_heygen_error_detail(response))

    body = response.json()
    data_block = body.get("data") or {}
    asset_id = data_block.get("id") or data_block.get("asset_id")
    if not asset_id:
        raise HTTPException(status_code=502, detail=f"HeyGen asset upload did not return asset ID: {body}")

    # Resolve agent name
    if not agent_name.strip():
        client_db = get_service_client()
        profile = (
            client_db.table("users")
            .select("full_name")
            .eq("id", agent_id)
            .single()
            .execute()
        )
        agent_name = (profile.data or {}).get("full_name") or "Agent"

    # 2. Create Photo Avatar Look
    payload = {
        "type": "photo",
        "name": f"{agent_name.strip()} Photo Avatar",
        "file": {
            "type": "asset_id",
            "asset_id": asset_id
        }
    }

    headers_json = _heygen_headers(api_key)
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response_avatar = await client.post(
                f"{HEYGEN_BASE_URL}/v3/avatars",
                headers=headers_json,
                json=payload,
            )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"HeyGen avatar creation failed: {exc}") from exc

    if response_avatar.status_code not in (200, 201):
        raise HTTPException(status_code=502, detail=_heygen_error_detail(response_avatar))

    body_avatar = response_avatar.json()
    avatar_data = body_avatar.get("data") or {}
    avatar_item = avatar_data.get("avatar_item") or {}

    talking_photo_id = str(avatar_item.get("id") or "")
    if not talking_photo_id:
        raise HTTPException(status_code=502, detail="HeyGen did not return a photo avatar look ID.")

    thumbnail = avatar_item.get("preview_image_url") or avatar_data.get("preview_image_url")

    # 3. Update User Profile
    client_db = get_service_client()
    db_payload = {
        "heygen_avatar_type": "talking_photo",
        "heygen_talking_photo_id": talking_photo_id,
        "heygen_avatar_thumbnail_url": thumbnail,
        "heygen_avatar_created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    client_db.table("users").update(db_payload).eq("id", agent_id).execute()

    return {
        "status": "success",
        "talking_photo_id": talking_photo_id,
        "thumbnail_url": thumbnail or "",
    }


@router.post("/upload-avatar-video")
async def upload_avatar_video(
    file: UploadFile = File(...),
    agent_name: str = Form(""),
    agent_id: str = Depends(require_agent),
) -> dict[str, str]:
    api_key = _require_heygen_key()

    content_type = _normalize_video_content_type(file.content_type)
    if content_type not in ALLOWED_VIDEO_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Training video must be MP4 or WebM.",
        )

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty video file.")
    if len(data) > MAX_AVATAR_VIDEO_BYTES:
        raise HTTPException(status_code=400, detail="Video must be under 50 MB.")

    content_type = _detect_video_content_type(data, content_type)
    
    # Auto-trim to the first 30 seconds for optimal HeyGen setup and file sizing
    data = trim_video_to_30s(data, content_type)

    # We still save a backup copy in our Supabase bucket
    await _upload_avatar_video_to_supabase(data, agent_id, content_type)

    # Perform direct direct-upload to HeyGen to bypass 32MB URL download limits
    asset_id = await _upload_to_heygen_assets(
        api_key, data, file.filename or "avatar.mp4", content_type
    )

    if not agent_name.strip():
        client = get_service_client()
        profile = (
            client.table("users")
            .select("full_name")
            .eq("id", agent_id)
            .single()
            .execute()
        )
        agent_name = (profile.data or {}).get("full_name") or "Agent"

    payload = {
        "type": "digital_twin",
        "name": f"{agent_name.strip()} Avatar",
        "file": {"type": "asset_id", "asset_id": asset_id},
    }

    headers = _heygen_headers(api_key)
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{HEYGEN_BASE_URL}/v3/avatars",
                headers=headers,
                json=payload,
            )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"HeyGen avatar request failed: {exc}") from exc

    if response.status_code not in (200, 201):
        raise HTTPException(status_code=502, detail=_heygen_error_detail(response))

    body: dict[str, Any] = response.json()
    data_block = body.get("data") or body
    avatar_item = data_block.get("avatar_item") or {}
    avatar_group = data_block.get("avatar_group") or {}

    look_id = str(avatar_item.get("id") or "")
    group_id = str(avatar_group.get("id") or avatar_item.get("group_id") or "")
    if not look_id:
        raise HTTPException(status_code=502, detail="HeyGen did not return an avatar look id.")

    thumbnail = avatar_item.get("preview_image_url") or avatar_group.get("preview_image_url")

    if group_id:
        client = get_service_client()
        client.table("users").update({"heygen_avatar_group_id": group_id}).eq("id", agent_id).execute()

    return {
        "job_id": look_id,
        "group_id": group_id,
        "status": str(avatar_item.get("status") or "processing"),
        "thumbnail_url": thumbnail,
    }


@router.get("/avatar-status/{job_id}")
async def get_avatar_status(
    job_id: str,
    agent_id: str = Depends(require_agent),
) -> dict[str, Any]:
    api_key = _require_heygen_key()
    headers = _heygen_headers(api_key, json_body=False)

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{HEYGEN_BASE_URL}/v3/avatars/looks/{job_id}",
                headers=headers,
            )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"HeyGen status failed: {exc}") from exc

    if response.status_code != 200:
        raise HTTPException(status_code=502, detail=_heygen_error_detail(response))

    body: dict[str, Any] = response.json()
    look = body.get("data") or body
    status = str(look.get("status") or "processing")
    thumbnail = look.get("preview_image_url")
    group_id = look.get("group_id")

    result: dict[str, Any] = {
        "job_id": job_id,
        "status": status,
        "avatar_id": job_id if status == "completed" else None,
        "thumbnail_url": thumbnail,
        "error": None,
    }

    if status == "completed":
        _save_agent_avatar(agent_id, job_id, group_id, thumbnail)
        result["avatar_id"] = job_id
        consent_status = None
        consent_required = True
        if group_id:
            try:
                group = await _heygen_get_avatar_group(api_key, str(group_id))
                consent_status = group.get("consent_status")
                consent_required = not _consent_approved(
                    str(consent_status) if consent_status is not None else None
                )
            except Exception:
                pass
        result["consent_status"] = consent_status
        result["consent_required"] = consent_required
    elif status == "failed":
        result["error"] = "Avatar training failed. Please record again."

    return result


@router.get("/avatar-consent")
async def get_avatar_consent_status(
    agent_id: str = Depends(require_agent),
) -> dict[str, Any]:
    api_key = _require_heygen_key()
    group_id = _require_agent_avatar_group_id(agent_id)
    group = await _heygen_get_avatar_group(api_key, group_id)
    consent_status = group.get("consent_status")
    normalized = str(consent_status) if consent_status is not None else None
    return {
        "group_id": group_id,
        "consent_status": consent_status,
        "consent_required": not _consent_approved(normalized),
        "avatar_status": group.get("status"),
    }


@router.post("/avatar-consent")
async def start_avatar_consent(
    agent_id: str = Depends(require_agent),
) -> dict[str, Any]:
    api_key = _require_heygen_key()
    group_id = _require_agent_avatar_group_id(agent_id)

    group = await _heygen_get_avatar_group(api_key, group_id)
    consent_status = group.get("consent_status")
    normalized = str(consent_status) if consent_status is not None else None
    if _consent_approved(normalized):
        return {
            "consent_url": "",
            "group_id": group_id,
            "consent_status": consent_status,
            "consent_required": False,
        }

    reroute_url = f"{_frontend_base_url()}/market-yourself?step=1&consent=done"

    headers = _heygen_headers(api_key)
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{HEYGEN_BASE_URL}/v3/avatars/{group_id}/consent",
                headers=headers,
                json={"reroute_url": reroute_url},
            )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"HeyGen consent request failed: {exc}") from exc

    if response.status_code not in (200, 201):
        detail = _heygen_error_detail(response)
        if "already been provided" in detail.lower() or "already provided" in detail.lower():
            group = await _heygen_get_avatar_group(api_key, group_id)
            consent_status = group.get("consent_status")
            normalized = str(consent_status) if consent_status is not None else None
            return {
                "consent_url": "",
                "group_id": group_id,
                "consent_status": consent_status,
                "consent_required": not _consent_approved(normalized),
            }
        raise HTTPException(status_code=502, detail=detail)

    body: dict[str, Any] = response.json()
    data_block = body.get("data") or body
    avatar_group = data_block.get("avatar_group") or {}
    consent_status = avatar_group.get("consent_status")
    normalized = str(consent_status) if consent_status is not None else None

    return {
        "consent_url": str(data_block.get("url") or ""),
        "group_id": group_id,
        "consent_status": consent_status,
        "consent_required": not _consent_approved(normalized),
    }


@router.post("/generate-teleprompter")
async def generate_teleprompter(
    req: GenerateTeleprompterRequest,
    _agent_id: str = Depends(require_agent),
) -> dict[str, str]:
    settings = get_settings()
    groq_client = groq.Groq(api_key=settings.require_groq())
    name = req.agent_name.strip()
    prompt = f"""Write a spoken teleprompter script for a real estate agent recording a 30-second avatar training video.

Agent name: {name}
Brokerage: Local Pro Realty
Market: Dallas–Fort Worth / North Texas
Product: LocalPRO Hub (all-in-one listings, marketing, photography, MLS workflow)

Requirements:
- First person, conversational, warm and professional
- 55–75 words (about 20–30 seconds when read aloud)
- Mention their name, DFW/North Texas, and LocalPRO Hub briefly
- Vary the opening — do NOT always start with "Hi, I'm..."
- No hashtags, labels, stage directions, or quotes
- Plain spoken text only"""

    try:
        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.95,
            max_tokens=200,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Teleprompter generation failed: {exc}") from exc

    script = (response.choices[0].message.content or "").strip()
    if script.startswith("```"):
        parts = script.split("```")
        if len(parts) >= 2:
            script = parts[1]
            if script.startswith("json"):
                script = script[4:]
        script = script.strip().strip('"')

    return {"script": script}


@router.post("/generate-script")
async def generate_script(
    req: GenerateScriptRequest,
    _agent_id: str = Depends(require_agent),
) -> dict[str, Any]:
    settings = get_settings()
    groq_client = groq.Groq(api_key=settings.require_groq())
    system_prompt, user_prompt = build_script_prompt(req)

    try:
        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.8,
            max_tokens=1000,
            response_format={"type": "json_object"},
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Script generation failed: {exc}") from exc

    raw_content = (response.choices[0].message.content or "").strip()
    
    import json
    try:
        data = json.loads(raw_content)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to parse AI response as JSON: {raw_content}",
        ) from exc

    script = data.get("script") or ""
    word_count = len(script.split())
    seconds = round(word_count / 2.5)

    return {
        "script": script,
        "video_agent_prompt": data.get("video_agent_prompt") or "",
        "scenes": data.get("scenes") or [],
        "social_captions": data.get("social_captions") or {},
        "posting_tips": data.get("posting_tips") or "",
        "word_count": word_count,
        "estimated_seconds": seconds,
    }


@router.get("/heygen-voices")
async def list_heygen_voices(
    _agent_id: str = Depends(require_agent),
) -> dict[str, Any]:
    api_key = _require_heygen_key()
    headers = _heygen_headers(api_key, json_body=False)

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{HEYGEN_BASE_URL}/v3/voices",
                headers=headers,
            )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"HeyGen voices failed: {exc}") from exc

    if response.status_code != 200:
        raise HTTPException(status_code=502, detail=_heygen_error_detail(response))

    body: dict[str, Any] = response.json()
    voices_raw = body.get("data") or []
    voices = []
    for voice in voices_raw:
        if not isinstance(voice, dict):
            continue
        voices.append(
            {
                "voice_id": voice.get("voice_id") or voice.get("id"),
                "name": voice.get("name") or voice.get("display_name") or "Voice",
                "language": voice.get("language") or voice.get("language_code"),
                "gender": voice.get("gender"),
                "preview_audio_url": voice.get("preview_audio_url"),
            }
        )

    default_voice_id = None
    for voice in voices:
        name = str(voice.get("name") or "").lower()
        if "rachel" in name:
            default_voice_id = voice.get("voice_id")
            break
    if not default_voice_id and voices:
        default_voice_id = voices[0].get("voice_id")

    return {"voices": voices, "default_voice_id": default_voice_id}


@router.post("/generate-video")
async def generate_video(
    req: GenerateVideoRequest,
    agent_id: str = Depends(require_agent),
) -> dict[str, str]:
    api_key = _require_heygen_key()

    if not req.script.strip():
        raise HTTPException(status_code=400, detail="Script is required.")
    if not req.avatar_id.strip():
        raise HTTPException(status_code=400, detail="Avatar is required.")
    if not req.voice_id.strip():
        raise HTTPException(status_code=400, detail="Voice is required.")

    row = _get_agent_avatar_row(agent_id)
    avatar_type = row.get("heygen_avatar_type") or "digital_twin"
    group_id = row.get("heygen_avatar_group_id")
    
    if avatar_type == "digital_twin" and group_id:
        try:
            group = await _heygen_get_avatar_group(api_key, str(group_id))
            consent_status = group.get("consent_status")
            if not _consent_approved(
                str(consent_status) if consent_status is not None else None
            ):
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Avatar identity verification is still pending. "
                        "Complete verification in Step 1 (Avatar) before generating videos."
                    ),
                )
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(
                status_code=502,
                detail=f"Could not verify avatar consent status: {exc}",
            ) from exc

    aspect_ratio = ASPECT_RATIO_MAP.get(req.aspect_ratio, "9:16")
    background_key = req.background if req.background in BACKGROUND_MAP else "clean_white"
    background = BACKGROUND_MAP[background_key]

    payload: dict[str, Any] = {
        "type": "avatar",
        "avatar_id": req.avatar_id.strip(),
        "script": req.script.strip(),
        "voice_id": req.voice_id.strip(),
        "title": f"Market Yourself — {req.agent_name}",
        "resolution": "1080p",
        "aspect_ratio": aspect_ratio,
        "background": background,
    }

    if _background_uses_image(background_key):
        payload["remove_background"] = True
        payload["fit"] = "cover"

    headers = _heygen_headers(api_key)
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{HEYGEN_BASE_URL}/v3/videos",
                headers=headers,
                json=payload,
            )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"HeyGen video request failed: {exc}") from exc

    if response.status_code not in (200, 201):
        raise HTTPException(status_code=502, detail=_heygen_error_detail(response))

    body: dict[str, Any] = response.json()
    data_block = body.get("data") or body
    video_id = data_block.get("video_id") or data_block.get("id")
    if not video_id:
        raise HTTPException(status_code=502, detail="HeyGen did not return a video id.")

    return {
        "video_id": str(video_id),
        "status": str(data_block.get("status") or "pending"),
    }


@router.get("/heygen-video-status/{video_id}")
async def get_heygen_video_status(
    video_id: str,
    _agent_id: str = Depends(require_agent),
) -> dict[str, str | None]:
    api_key = _require_heygen_key()
    headers = _heygen_headers(api_key, json_body=False)

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{HEYGEN_BASE_URL}/v3/videos/{video_id}",
                headers=headers,
            )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"HeyGen status failed: {exc}") from exc

    if response.status_code != 200:
        raise HTTPException(status_code=502, detail=_heygen_error_detail(response))

    body: dict[str, Any] = response.json()
    video = body.get("data") or body
    status = str(video.get("status") or "pending")

    result: dict[str, str | None] = {
        "video_id": video_id,
        "status": status,
        "video_url": None,
        "thumbnail_url": None,
        "error": None,
    }

    if status == "completed":
        result["video_url"] = video.get("video_url")
        result["thumbnail_url"] = video.get("thumbnail_url")
    elif status == "failed":
        result["error"] = (
            video.get("failure_message")
            or video.get("failure_code")
            or "Video generation failed"
        )

    return result


@router.post("/generate-video-agent")
async def generate_video_agent(
    req: GenerateVideoAgentRequest,
    agent_id: str = Depends(require_agent),
) -> dict[str, str]:
    api_key = _require_heygen_key()

    row = _get_agent_avatar_row(agent_id)
    avatar_type = row.get("heygen_avatar_type") or "digital_twin"
    group_id = row.get("heygen_avatar_group_id")

    # For Option 1: Digital Twin (full-body replica) consent checks
    if avatar_type == "digital_twin" and group_id:
        try:
            group = await _heygen_get_avatar_group(api_key, str(group_id))
            consent_status = group.get("consent_status")
            if not _consent_approved(
                str(consent_status) if consent_status is not None else None
            ):
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Avatar identity verification is still pending. "
                        "Complete verification in Step 1 (Avatar) before generating videos."
                    ),
                )
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(
                status_code=502,
                detail=f"Could not verify avatar consent status: {exc}",
            ) from exc

    # Compile the Video Agent prompt instructions based on options layout
    prompt_text = req.prompt.strip()
    if req.script and req.script.strip():
        clean_script = req.script.strip()
        aspect_label = "portrait (vertical 9:16)" if req.orientation == "portrait" else "landscape (horizontal 16:9)"
        
        is_talking_photo = (avatar_type == "talking_photo")
        avatar_layout_directive = (
            "Format the talking photo avatar as a circular speaking bubble overlay placed in the bottom corner of the frame. The background visuals, charts, graphs, and property details should render in full screen behind it."
            if is_talking_photo
            else "Format the speaking avatar as a full-body presenter standing in the environment."
        )

        scenes_block = ""
        if req.scenes:
            scene_descriptions = []
            for scene in req.scenes:
                num = scene.get("scene_number", 1)
                visual = scene.get("visual", "").strip()
                sc_script = scene.get("script", "").strip()
                
                is_intro = (num == 1) or ("intro" in visual.lower())
                duration = 3 if is_intro else max(5, int(len(sc_script.split()) / 2.5))
                
                scene_type = "Intro Scene" if is_intro else "Content Scene"
                vo_text = f'"{sc_script}"' if sc_script else "None"
                
                scene_descriptions.append(
                    f"- Scene {num} ({scene_type}) → Visuals: {visual} → Voice-over/Script: {vo_text} → Duration: {duration}s"
                )
            scenes_block = "\n".join(scene_descriptions)

        layout_directives = f"""
[LAYOUT DIRECTIVES]
- Aspect Ratio: {aspect_label}
- Avatar Style Layout: {avatar_layout_directive}
- Visual style: Minimal, premium clean styled visuals. Use brand colors (white, slate gray, gold accents).
- Chapter Cards & Transitions: Smooth transitions between scenes. Include section headers or title text overlays.
- Layout Positioning: Place all market graphs, bar charts, tables, and visual card overlays centered near the top of the frame so they never cover the avatar's face or mouth.
- Agent Branding Footer: Always display the agent's name "{req.agent_name}" and brokerage "Local Pro Realty" clearly at the bottom of the frame throughout the video.
"""
        storyboard_header = f"[SCENE-BY-SCENE STORYBOARD]\n{scenes_block}\n" if scenes_block else ""

        prompt_text = f"""{storyboard_header}
{prompt_text}

{layout_directives}

[FULL SPOKEN SCRIPT]
{clean_script}
"""

    payload = {
        "prompt": prompt_text.strip(),
        "avatar_id": req.avatar_id.strip(),
        "voice_id": req.voice_id.strip(),
        "orientation": req.orientation,
        "mode": "generate",
    }

    headers = _heygen_headers(api_key)
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{HEYGEN_BASE_URL}/v3/video-agents",
                headers=headers,
                json=payload,
            )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"HeyGen Video Agent request failed: {exc}") from exc

    if response.status_code not in (200, 201):
        raise HTTPException(status_code=502, detail=_heygen_error_detail(response))

    body: dict[str, Any] = response.json()
    data_block = body.get("data") or body
    session_id = data_block.get("session_id") or data_block.get("id")
    if not session_id:
        raise HTTPException(status_code=502, detail="HeyGen did not return a session id.")

    return {
        "session_id": str(session_id),
        "status": str(data_block.get("status") or "pending"),
    }


@router.get("/video-agent-status/{session_id}")
async def get_video_agent_status(
    session_id: str,
    agent_id: str = Depends(require_agent),
) -> dict[str, Any]:
    api_key = _require_heygen_key()
    headers = _heygen_headers(api_key, json_body=False)

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            session_response = await client.get(
                f"{HEYGEN_BASE_URL}/v3/video-agents/{session_id}",
                headers=headers,
            )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"HeyGen session fetch failed: {exc}") from exc

    if session_response.status_code != 200:
        raise HTTPException(status_code=502, detail=_heygen_error_detail(session_response))

    session_body: dict[str, Any] = session_response.json()
    session_data = session_body.get("data") or session_body
    
    session_status = str(session_data.get("status") or "processing")
    video_id = session_data.get("video_id")

    if session_status == "failed":
        return {
            "session_id": session_id,
            "status": "failed",
            "video_url": None,
            "thumbnail_url": None,
            "error": session_data.get("error") or "Video agent session failed",
        }

    if not video_id:
        return {
            "session_id": session_id,
            "status": "processing",
            "video_url": None,
            "thumbnail_url": None,
            "error": None,
        }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            video_response = await client.get(
                f"{HEYGEN_BASE_URL}/v3/videos/{video_id}",
                headers=headers,
            )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"HeyGen video status failed: {exc}") from exc

    if video_response.status_code != 200:
        raise HTTPException(status_code=502, detail=_heygen_error_detail(video_response))

    video_body: dict[str, Any] = video_response.json()
    video_data = video_body.get("data") or video_body
    video_status = str(video_data.get("status") or "pending")

    result = {
        "session_id": session_id,
        "video_id": video_id,
        "status": video_status,
        "video_url": None,
        "thumbnail_url": None,
        "error": None,
    }

    if video_status == "completed":
        result["video_url"] = video_data.get("video_url")
        result["thumbnail_url"] = video_data.get("thumbnail_url")
    elif video_status == "failed":
        result["error"] = (
            video_data.get("failure_message")
            or video_data.get("failure_code")
            or "Video generation failed"
        )

    return result
