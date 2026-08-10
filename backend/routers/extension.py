from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from deps.auth import require_agent, get_service_client

router = APIRouter(prefix="/extension", tags=["extension"])

class LoginRequest(BaseModel):
    email: str
    password: str

def _single_row(builder: Any) -> dict[str, Any] | None:
    response = builder.maybe_single().execute()
    if response is None:
        return None
    data = response.data
    return data if isinstance(data, dict) else None

@router.post("/auth/login")
async def extension_login(req: LoginRequest) -> dict[str, Any]:
    client = get_service_client()
    try:
        res = client.auth.sign_in_with_password({
            "email": req.email,
            "password": req.password
        })
        if not res or not res.session:
            raise HTTPException(status_code=401, detail="Invalid email or password.")
        
        user_id = res.user.id
        user_profile = _single_row(
            client.table("users")
            .select("id, role, status, full_name")
            .eq("id", user_id)
        )
        
        if not user_profile or user_profile.get("role") != "agent" or user_profile.get("status") != "active":
            raise HTTPException(status_code=403, detail="Active agent account required.")
            
        return {
            "access_token": res.session.access_token,
            "user": {
                "id": user_profile.get("id"),
                "full_name": user_profile.get("full_name"),
                "role": user_profile.get("role")
            }
        }
    except Exception as exc:
        if isinstance(exc, HTTPException):
            raise exc
        
        # Check if it's a known AuthApiError (from supabase_auth)
        exc_type_name = type(exc).__name__
        if exc_type_name == "AuthApiError":
            raise HTTPException(status_code=401, detail=str(exc))
            
        # Log unexpected system exceptions (e.g. FileNotFoundError, ConnectionError)
        import traceback
        print("Unexpected system error during extension login:")
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail="Login failed, please try again."
        )

@router.get("/listing/{listing_id}")
async def get_extension_listing(
    listing_id: str,
    agent_id: str = Depends(require_agent),
) -> dict[str, Any]:
    client = get_service_client()
    
    listing = _single_row(
        client.table("listings")
        .select("id, agent_id, address_full, mls_number, list_price, description_generated, form_data")
        .eq("id", listing_id)
    )
    
    if not listing or listing.get("agent_id") != agent_id:
        raise HTTPException(status_code=403, detail="Not your listing")
        
    form_data = listing.get("form_data") or {}
    if not isinstance(form_data, dict):
        form_data = {}
        
    flat_data = {
        "id": listing.get("id"),
        "address_full": listing.get("address_full"),
        "mls_number": listing.get("mls_number"),
        "list_price": listing.get("list_price"),
        "description": listing.get("description_generated"),
    }
    
    for k, v in form_data.items():
        if k not in flat_data:
            flat_data[k] = v
            
    return flat_data
