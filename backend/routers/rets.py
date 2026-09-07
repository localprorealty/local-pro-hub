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


import re


def _extract_realist_pdf_text_deterministic(text: str) -> dict[str, Any]:
    """Fallback deterministic parser for CoreLogic / Realist property tax PDF reports."""
    data: dict[str, Any] = {}

    # 1. Address line (e.g., "1229 Sam Dennis Dr, Lewisville, TX 75077-2551, Denton County")
    addr_match = re.search(
        r"(\d+)\s+([A-Za-z0-9\s]+?)\s+(Dr|St|Ave|Blvd|Rd|Ln|Ct|Pl|Way|Cir|Trl|Pkwy|Loop|Cv|Hwy)\b[,\s]+([A-Za-z\s]+?)[,\s]+([A-Z]{2})\s+(\d{5})(?:-\d{4})?(?:[,\s]+([A-Za-z\s]+?)(?:\s+County)?)?(?:\n|\r|$)",
        text,
        re.IGNORECASE,
    )
    if addr_match:
        data["street_number"] = addr_match.group(1).strip()
        data["street_name"] = addr_match.group(2).strip()
        data["street_type"] = addr_match.group(3).strip().capitalize()
        data["city"] = addr_match.group(4).strip()
        data["state"] = addr_match.group(5).strip().upper()
        data["zip_code"] = addr_match.group(6).strip()
        if addr_match.group(7):
            data["county"] = addr_match.group(7).replace("County", "").strip()

    if not data.get("county"):
        m = re.search(r"([A-Za-z]+)\s+County", text, re.IGNORECASE)
        if m:
            data["county"] = m.group(1).strip()

    # 2. Owner Name
    m = re.search(r"Owner Name\s+([A-Za-z\s,]+?)(?:\s+Tax Billing|\s+Owner Name 2|\n|\r)", text, re.IGNORECASE)
    if m:
        raw_owner = m.group(1).strip()
        # Clean up owner name if needed
        data["seller_name"] = raw_owner
        data["sellers"] = [{"name": raw_owner, "email": "", "phone": ""}]

    # 3. Subdivision
    m = re.search(r"Subdivision\s+([^\n\r]+?)(?:\s+Census Tract|\n|\r)", text, re.IGNORECASE)
    if m:
        data["subdivision"] = m.group(1).strip()

    # 4. School District
    m = re.search(r"School District\s+([^\n\r]+?)(?:\s+Census Tract|\s+School District Code|\n|\r)", text, re.IGNORECASE)
    if m:
        data["school_district"] = m.group(1).strip()

    # 5. Tax ID / APN / Parcel ID
    m = re.search(r"(?:Tax ID|APN:|Parcel ID)\s*[:\s]*([A-Za-z0-9-]+)", text, re.IGNORECASE)
    if m:
        data["parcel_id"] = m.group(1).strip()

    # 6. Lot & Block
    m = re.search(r"\bLot(?:\s*#|:|\s+)(?!(?:Sq|Size|Acres|Area)\b)(\w+)", text, re.IGNORECASE)
    if not m:
        m = re.search(r"LOT\s+(\d+)", text)
    if m:
        data["lot"] = m.group(1).strip()
    m = re.search(r"\bBlock(?:\s*#|:|\s+)([A-Za-z0-9]+)", text, re.IGNORECASE)
    if not m:
        m = re.search(r"BLK\s+([A-Za-z0-9]+)", text)
    if m:
        data["tax_block"] = m.group(1).strip()

    # 7. Beds, Baths, SqFt, Year Built
    m = re.search(r"(?:MLS Beds|Bedrooms)\s*[:\n\r\s]*(\d+)", text, re.IGNORECASE)
    if m:
        data["bedrooms_total"] = int(m.group(1))

    m = re.search(r"(?:MLS Full Baths|Full Baths)\s*[:\n\r\s]*(\d+)", text, re.IGNORECASE)
    if m:
        data["bathrooms_full"] = int(m.group(1))

    m = re.search(r"(?:Half Baths)\s*[:\n\r\s]*(\d+|N/A)", text, re.IGNORECASE)
    if m:
        val = m.group(1).strip()
        data["bathrooms_half"] = int(val) if val.isdigit() else 0
    else:
        data["bathrooms_half"] = 0

    m = re.search(r"(?:MLS Sq Ft|Building Sq Ft)\s*[:\n\r\s]*([\d,]+)", text, re.IGNORECASE)
    if m:
        data["living_area_sqft"] = int(m.group(1).replace(",", ""))

    m = re.search(r"(?:MLS Yr Built|Year Built)\s*[:\n\r\s]*(\d{4})", text, re.IGNORECASE)
    if m:
        data["year_built"] = int(m.group(1))

    # 8. Stories / Levels
    m = re.search(r"\bStories\s*[:\n\r\s]*(\d+)", text, re.IGNORECASE)
    if m:
        s_num = int(m.group(1))
        levels_map = {1: "One", 2: "Two", 3: "Three"}
        data["levels"] = levels_map.get(s_num, str(s_num))
    else:
        data["levels"] = "One"

    # 9. Garage
    m = re.search(r"Garage Capacity\s*[:\n\r\s]*(?:MLS:\s*)?(\d+)", text, re.IGNORECASE)
    if m:
        data["garage_spaces"] = int(m.group(1))
    else:
        data["garage_spaces"] = 2

    # 10. Property & Housing Type
    data["property_sub_type"] = "Single Family Residence"
    data["housing_type"] = "Single Detached"

    # 11. Foundation
    m = re.search(r"Foundation\s*[:\n\r\s]*([A-Za-z\s]+?)(?:\s+Construction|\n|\r)", text, re.IGNORECASE)
    if m:
        found_val = m.group(1).strip()
        data["foundation"] = [found_val] if found_val else ["Slab"]
    else:
        data["foundation"] = ["Slab"]

    # 12. Roof
    m = re.search(r"Roof Material\s*[:\n\r\s]*([A-Za-z\s]+?)(?:\s+Roof Shape|\n|\r)", text, re.IGNORECASE)
    if m:
        r_val = m.group(1).strip()
        if "Composition" in r_val or "Shingle" in r_val:
            data["roof"] = ["Composition"]
        elif r_val:
            data["roof"] = [r_val]
        else:
            data["roof"] = ["Composition"]
    else:
        data["roof"] = ["Composition"]

    # 13. Fireplaces
    m = re.search(r"Fireplaces\s*[:\n\r\s]*(\d+)", text, re.IGNORECASE)
    if m:
        data["fireplace_count"] = int(m.group(1))

    # 14. Flooring
    m = re.search(r"Floor Cover\s*[:\n\r\s]*([A-Za-z\s]+?)(?:\s+Pool|\n|\r)", text, re.IGNORECASE)
    if m:
        fl_val = m.group(1).strip()
        if fl_val:
            data["flooring"] = [fl_val]

    # 15. Cooling & Heating
    m = re.search(r"Cooling Type\s*[:\n\r\s]*([A-Za-z\s]+?)(?:\s+Heat Type|\n|\r)", text, re.IGNORECASE)
    if m:
        c_val = m.group(1).strip()
        if "Central" in c_val:
            data["cooling"] = ["Central Air"]
        elif c_val:
            data["cooling"] = [c_val]

    m = re.search(r"Heat Type\s*[:\n\r\s]*([A-Za-z\s]+?)(?:\s+Heat Fuel|\n|\r)", text, re.IGNORECASE)
    if m:
        h_val = m.group(1).strip()
        if "Central" in h_val:
            data["heating"] = ["Central"]
        elif h_val:
            data["heating"] = [h_val]

    data["living_areas_total"] = 1
    data["dining_areas_total"] = 1
    return data


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
            
        parsed_data = {}
        llm_success = False

        # Attempt Groq LLM parsing first if key is present
        settings = get_settings()
        if settings.groq_api_key:
            try:
                groq_client = groq.Groq(api_key=settings.groq_api_key)
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
                    model=settings.groq_model,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.0
                )
                
                raw_output = response.choices[0].message.content or ""
                if "```json" in raw_output:
                    json_str = raw_output.split("```json")[1].split("```")[0].strip()
                elif "```" in raw_output:
                    json_str = raw_output.split("```")[1].split("```")[0].strip()
                else:
                    json_str = raw_output.strip()
                    
                parsed_data = json.loads(json_str)
                llm_success = True
            except Exception as llm_err:
                print(f"[WARN] Groq LLM parsing failed ({llm_err}). Falling back to deterministic parser.")

        # Fallback to deterministic regex parser if LLM failed or wasn't configured
        if not llm_success or not parsed_data:
            parsed_data = _extract_realist_pdf_text_deterministic(text)
        
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
            "sellers": [{"name": str(parsed_data.get("seller_name")).strip(), "email": "", "phone": ""}] if parsed_data.get("seller_name") else [],
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

