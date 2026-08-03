from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, File, UploadFile
from pydantic import BaseModel, Field

from config import get_settings
from services.rets_service import (
    RETSService,
    map_rets_to_address,
    map_rets_to_form,
)

router = APIRouter(prefix="/rets", tags=["rets"])


class PropertySearchRequest(BaseModel):
    query_type: str = Field(description="'mls_number' or 'address'")
    mls_number: str | None = None
    street_number: str | None = None
    street_name: str | None = None
    city: str | None = None


class PropertyMatch(BaseModel):
    property: dict[str, Any]
    raw: dict[str, str]
    label: str


class PropertySearchResponse(BaseModel):
    found: bool
    property: dict[str, Any] | None = None
    address: dict[str, str] | None = None
    raw: dict[str, str] | None = None
    multiple: list[PropertyMatch] | None = None
    error: str | None = None


_client = None


def _get_service_client():
    global _client
    if _client is None:
        settings = get_settings()
        url, key = settings.require_supabase()
        from supabase import create_client
        _client = create_client(url, key)
    return _client


async def require_active_user(authorization: str | None = Header(default=None)) -> str:
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

    client = _get_service_client()
    profile = (
        client.table("users")
        .select("id, status")
        .eq("id", user.id)
        .execute()
    )
    row = profile.data[0] if profile.data else None
    if not row or row.get("status") != "active":
        raise HTTPException(status_code=403, detail="Active account required.")

    return user.id


def _build_match(raw: dict[str, str]) -> PropertyMatch:
    address = map_rets_to_address(raw)
    form_fields = map_rets_to_form(raw)
    combined = {**form_fields, **address}
    parts = [
        address.get("street_number", ""),
        address.get("street_name", ""),
        address.get("city", ""),
    ]
    label = " ".join(p for p in parts if p).strip() or raw.get("ListingId", "Property")
    return PropertyMatch(property=combined, raw=raw, label=label)


@router.post("/search", response_model=PropertySearchResponse)
async def search_property(
    req: PropertySearchRequest,
    _user_id: str = Depends(require_active_user),
) -> PropertySearchResponse:
    settings = get_settings()
    if not settings.ntreis_rets_configured:
        raise HTTPException(status_code=503, detail="RETS credentials not configured")

    try:
        async with RETSService(settings) as rets:
            if req.query_type == "mls_number":
                if not req.mls_number or not req.mls_number.strip():
                    raise HTTPException(status_code=400, detail="mls_number required")

                raw = await rets.search_by_mls_number(req.mls_number.strip())
                if not raw:
                    return PropertySearchResponse(found=False)

                address = map_rets_to_address(raw)
                form_fields = map_rets_to_form(raw)
                return PropertySearchResponse(
                    found=True,
                    property=form_fields,
                    address=address,
                    raw=raw,
                )

            if req.query_type == "address":
                if not req.street_number or not req.street_name:
                    raise HTTPException(
                        status_code=400,
                        detail="street_number and street_name required",
                    )

                results = await rets.search_by_address(
                    req.street_number.strip(),
                    req.street_name.strip(),
                    (req.city or "").strip(),
                )
                if not results:
                    return PropertySearchResponse(found=False)

                if len(results) == 1:
                    raw = results[0]
                    return PropertySearchResponse(
                        found=True,
                        property=map_rets_to_form(raw),
                        address=map_rets_to_address(raw),
                        raw=raw,
                    )

                return PropertySearchResponse(
                    found=True,
                    multiple=[_build_match(row) for row in results],
                )

            raise HTTPException(
                status_code=400,
                detail="query_type must be 'mls_number' or 'address'",
            )
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"RETS search failed: {exc}") from exc


@router.get("/discover-fields")
async def discover_rets_fields(
    _user_id: str = Depends(require_active_user),
) -> dict[str, Any]:
    """Return sample NTREIS field names + one record for mapping refinement."""
    settings = get_settings()
    if not settings.ntreis_rets_configured:
        raise HTTPException(status_code=503, detail="RETS credentials not configured")

    try:
        async with RETSService(settings) as rets:
            sample = await rets.discover_sample()
            if not sample:
                return {"error": "No results found", "fields": [], "sample": None}

            return {
                "field_count": len(sample),
                "fields": sorted(sample.keys()),
                "sample": sample,
            }
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"RETS discover failed: {exc}") from exc


@router.post("/upload-pdf", response_model=PropertySearchResponse)
async def upload_pdf(
    file: UploadFile = File(...),
    _user_id: str = Depends(require_active_user),
) -> PropertySearchResponse:
    import io
    import pypdf
    import groq
    import json

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
        
    try:
        content = await file.read()
        pdf_file = io.BytesIO(content)
        reader = pypdf.PdfReader(pdf_file)
        
        # Extract all pages to prevent truncation
        text = ""
        for i, page in enumerate(reader.pages):
            text += f"=== PAGE {i+1} ===\n" + (page.extract_text() or "") + "\n"
            
        if not text.strip():
            raise HTTPException(status_code=400, detail="The uploaded PDF file contains no readable text.")
            
        settings = get_settings()
        groq_key = settings.require_groq()
        groq_client = groq.Groq(api_key=groq_key)
        
        prompt = f"""
You are an expert real estate data parser. Parse the following extracted text from a Realist Property Details PDF report and return a JSON object with the following keys. If a value is missing, N/A, or empty, set it to null.

Required Keys:
- street_number (string)
- street_name (string, e.g. 'Sam Dennis')
- street_type (string, e.g. 'Dr', 'St', 'Ln')
- city (string)
- state (string, e.g. 'TX')
- zip_code (string, e.g. '75077')
- county (string, without 'County' suffix, e.g. 'Denton')
- subdivision (string, e.g. 'Orchard Valley Estates Ph II')
- lot (string)
- tax_block (string, block value)
- school_district (string, e.g. 'Lewisville ISD')
- bedrooms_total (integer, total bedrooms)
- bathrooms_full (integer, full baths)
- bathrooms_half (integer, half baths, use 0 if N/A)
- levels (string, map stories/levels number to words like 'One', 'Two', 'Three')
- living_areas_total (integer, number of living areas, use 1 if not specified)
- dining_areas_total (integer, number of dining areas)
- living_area_sqft (integer, building/living area square footage, e.g. 1942)
- year_built (integer, year built, e.g. 1995)
- seller_name (string, format as 'First Last' or 'Last First' as present, e.g. 'Anita Jill Kendrick')
- property_sub_type (string, map 'SFR' to 'Single Family Residence', otherwise map to 'Single Family Residence', 'Condominium', 'Townhouse', 'Mobile Home', 'Manufactured Home', or 'Farm')
- housing_type (string, map 'Single Family' or 'Single Detached' to 'Single Detached', otherwise to one of: 'Apartment', 'Attached or 1/2 Duplex', 'Condo/Townhome', 'Garden/Zero Lot Line', 'Single Detached')
- parcel_id (string, APN/Tax ID)
- multi_parcel_id_yn (string, 'Yes' or 'No', based on MultiParcelIDYN)
- garage_spaces (integer, from Garage Capacity)
- foundation (array of strings, e.g. ['Slab'], select from: 'Block', 'Bois DArc Post', 'Brick/Mortar', 'Combination', 'Concrete Perimeter', 'Pillar/Post/Pier', 'Slab', 'Stone', 'Other', 'None')
- roof (array of strings, e.g. ['Composition'], select from: 'Asphalt', 'Built-up', 'Composition', 'Concrete', 'Fiber Cement', 'Fiberglass', 'Flat', 'Metal', 'Mixed', 'Shake', 'Shingle', 'Slate', 'Spanish Tile', 'Synthetic', 'Tar/Gravel', 'Tile', 'Wood', 'Other')
- flooring (array of strings, e.g. ['Carpet'], select from: 'Adobe', 'Bamboo', 'Brick', 'Brick/Adobe', 'Carpet', 'Ceramic Tile', 'Clay', 'Combination', 'Concrete', 'Cork', 'Dirt', 'Granite', 'Hardwood', 'Laminate', 'Linoleum', 'Luxury Vinyl Plank', 'Marble', 'Parquet', 'Tile', 'Vinyl', 'Wood', 'None', 'Other')
- cooling (array of strings, e.g. ['Central Air'], select from: 'Attic Fan', 'Ceiling Fan(s)', 'Central Air', 'Electric', 'ENERGY STAR Qualified Equipment', 'Evaporative Cooling', 'Gas', 'Geothermal', 'Heat Pump', 'None', 'Other')
- heating (array of strings, e.g. ['Central'], select from: 'Active Solar', 'Central', 'Electric', 'ENERGY STAR Equipment', 'Fireplace Insert', 'Fireplace(s)', 'Floor Furnace', 'Gas Jets', 'Heat Pump', 'Natural Gas', 'Propane', 'Space Heater', 'Wall Furnace', 'Wood Stove', 'None')
- fireplace_count (integer, number of fireplaces)
- high_school (string)
- middle_school (string)
- elementary_school (string)

Extracted Report Text:
{text}

Return ONLY the raw JSON object inside a code block.
"""

        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.0
        )
        
        raw_output = response.choices[0].message.content or ""
        # Extract JSON from code block if present
        if "```json" in raw_output:
            json_str = raw_output.split("```json")[1].split("```")[0].strip()
        elif "```" in raw_output:
            json_str = raw_output.split("```")[1].split("```")[0].strip()
        else:
            json_str = raw_output.strip()
            
        parsed_data = json.loads(json_str)
        
        # Build standard address structure
        address = {
            "street_number": str(parsed_data.get("street_number") or ""),
            "street_name": str(parsed_data.get("street_name") or ""),
            "street_type": str(parsed_data.get("street_type") or ""),
            "city": str(parsed_data.get("city") or ""),
            "state": str(parsed_data.get("state") or ""),
            "zip_code": str(parsed_data.get("zip_code") or ""),
            "county": str(parsed_data.get("county") or ""),
            "subdivision": str(parsed_data.get("subdivision") or "")
        }
        
        # Build property_data mapping keys directly to NTREIS form fields
        property_data = {
            "bedrooms_total": parsed_data.get("bedrooms_total"),
            "bathrooms_full": parsed_data.get("bathrooms_full"),
            "bathrooms_half": parsed_data.get("bathrooms_half"),
            "levels": parsed_data.get("levels"),
            "living_areas_total": parsed_data.get("living_areas_total"),
            "dining_areas_total": parsed_data.get("dining_areas_total"),
            "living_area_sqft": parsed_data.get("living_area_sqft"),
            "year_built": parsed_data.get("year_built"),
            "seller_name": parsed_data.get("seller_name"),
            "property_sub_type": parsed_data.get("property_sub_type"),
            "housing_type": parsed_data.get("housing_type"),
            "parcel_id": parsed_data.get("parcel_id"),
            "multi_parcel_id_yn": parsed_data.get("multi_parcel_id_yn"),
            "garage_spaces": parsed_data.get("garage_spaces"),
            "foundation": parsed_data.get("foundation") or [],
            "roof": parsed_data.get("roof") or [],
            "flooring": parsed_data.get("flooring") or [],
            "cooling": parsed_data.get("cooling") or [],
            "heating": parsed_data.get("heating") or [],
            "fireplace_count": parsed_data.get("fireplace_count"),
            "lot": parsed_data.get("lot"),
            "tax_block": parsed_data.get("tax_block"),
            "school_district": parsed_data.get("school_district"),
            "high_school": parsed_data.get("high_school"),
            "middle_school": parsed_data.get("middle_school"),
            "elementary_school": parsed_data.get("elementary_school")
        }
        
        # Merge both for form_fields
        form_fields = {**property_data, **address}
        
        # Convert raw to strings for Pydantic type validator
        raw_str_dict = {k: str(v) if v is not None else "" for k, v in parsed_data.items()}
        
        return PropertySearchResponse(
            found=True,
            property=form_fields,
            address=address,
            raw=raw_str_dict
        )
        
    except json.JSONDecodeError as jde:
        raise HTTPException(status_code=502, detail="Failed to parse structured JSON from parser output.") from jde
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error parsing PDF: {str(e)}")

