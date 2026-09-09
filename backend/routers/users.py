import os
from typing import Any
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from deps.auth import get_service_client, require_active_user

router = APIRouter(prefix="/users", tags=["users"])

MAX_LOGO_SIZE_BYTES = 5 * 1024 * 1024  # 5MB ceiling
ALLOWED_LOGO_MIME_TYPES = {
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/svg+xml",
}


@router.post("/me/brand-logo")
async def upload_brand_logo(
    file: UploadFile = File(...),
    user_id: str = Depends(require_active_user),
) -> dict[str, Any]:
    content_type = (file.content_type or "").lower().strip()
    if content_type not in ALLOWED_LOGO_MIME_TYPES:
        # Also check file extension fallback for SVG/PNG/JPG
        filename = (file.filename or "").lower()
        if filename.endswith(".svg"):
            content_type = "image/svg+xml"
        elif filename.endswith(".png"):
            content_type = "image/png"
        elif filename.endswith((".jpg", ".jpeg")):
            content_type = "image/jpeg"
        elif filename.endswith(".webp"):
            content_type = "image/webp"
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type '{content_type}'. Allowed types: PNG, JPEG, WebP, SVG.",
            )

    contents = await file.read()
    file_size = len(contents)
    if file_size > MAX_LOGO_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds 5MB limit ({file_size / (1024 * 1024):.1f}MB).",
        )

    ext = os.path.splitext(file.filename or "")[1].lower()
    if not ext or ext not in [".png", ".jpg", ".jpeg", ".webp", ".svg"]:
        ext = ".svg" if "svg" in content_type else ".png"

    storage_path = f"{user_id}/logo{ext}"
    client = get_service_client()

    try:
        client.storage.from_("agent-branding").upload(
            storage_path,
            contents,
            {"content-type": content_type, "upsert": "true"},
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to upload logo to storage: {e}",
        )

    public_url = client.storage.from_("agent-branding").get_public_url(storage_path)

    # Update public.users record
    try:
        client.table("users").update({"brand_logo_url": public_url}).eq("id", user_id).execute()
    except Exception as e:
        # Graceful notice if migration 025 is pending in SQL editor
        print(f"Warning: Could not update users.brand_logo_url (migration 025 may be pending): {e}")

    return {
        "success": True,
        "brand_logo_url": public_url,
    }


@router.delete("/me/brand-logo")
async def delete_brand_logo(
    user_id: str = Depends(require_active_user),
) -> dict[str, Any]:
    client = get_service_client()

    try:
        client.table("users").update({"brand_logo_url": None}).eq("id", user_id).execute()
    except Exception as e:
        print(f"Warning: Could not clear users.brand_logo_url: {e}")

    # Remove files in user's folder from agent-branding
    try:
        files = client.storage.from_("agent-branding").list(user_id)
        if files:
            paths = [f"{user_id}/{f['name']}" for f in files]
            client.storage.from_("agent-branding").remove(paths)
    except Exception as e:
        print(f"Warning: Could not clean up storage files: {e}")

    return {"success": True}
