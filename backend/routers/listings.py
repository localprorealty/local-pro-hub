from datetime import date
import json
from typing import Any

import groq
import httpx
from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import BaseModel, Field

from config import get_settings
from deps.auth import get_service_client, require_agent

router = APIRouter(prefix="/listings", tags=["listings"])


class GoLiveBody(BaseModel):
    go_live_date: str | None = Field(default=None, max_length=10)


class MarketingRefineRequest(BaseModel):
    page_type: str
    current_content: str
    instruction: str
    listing_context: dict[str, Any] = Field(default_factory=dict)


NEIGHBORHOOD_PROMPT = """Write a real estate neighborhood guide for {city}, Texas.
Format the response as JSON with these exact keys:
intro, commute_times (array of objects with destination and time),
boundaries, nearby_neighborhoods, what_to_expect, the_lifestyle,
unexpected_appeal, the_market, youll_fall_in_love.
Return only valid JSON. No markdown."""

DESCRIPTION_PROMPT = """You are a professional real estate copywriter specializing \
in North Texas MLS listings. Write a compelling property description \
for the following listing.

{context}

Rules:
- Maximum 900 characters (MLS limit is 1000, leave buffer)
- Start with the strongest selling point, not the address
- Highlight location, schools, and unique features
- Use active language — "soaring ceilings" not "has high ceilings"
- Never use the words "stunning", "gorgeous", "amazing", "perfect"
- End with a location/lifestyle benefit
- Write as one flowing paragraph, no bullet points
- Do NOT include the price or address in the description

Write only the description. No preamble, no quotes."""


def _single_row(builder: Any) -> dict[str, Any] | None:
    response = builder.maybe_single().execute()
    if response is None:
        return None
    data = response.data
    return data if isinstance(data, dict) else None


def _fmt_list(value: Any) -> str:
    if isinstance(value, list):
        return ", ".join(str(v) for v in value if v)
    if value is None:
        return ""
    return str(value)


def _pick(form_data: dict[str, Any], *keys: str) -> str:
    for key in keys:
        value = form_data.get(key)
        if value is not None and str(value).strip():
            return str(value)
    return ""


def _build_description_context(
    form_data: dict[str, Any],
    listing_type: str,
    address_full: str | None,
) -> str:
    address = address_full or _pick(form_data, "address_full") or "Not set"
    return f"""
Property Type: {_pick(form_data, 'property_sub_type', 'property_type') or listing_type}
Address: {address}
List Price: ${_pick(form_data, 'list_price', 'list_price_total')}
Bedrooms: {_pick(form_data, 'bedrooms_total', 'bedrooms', 'beds')}
Full Baths: {_pick(form_data, 'bathrooms_full', 'bathrooms', 'baths')}
Half Baths: {_pick(form_data, 'bathrooms_half')}
Square Feet: {_pick(form_data, 'living_area_sqft', 'sqft', 'square_feet', 'living_area')}
Year Built: {_pick(form_data, 'year_built')}
Lot Size: {_pick(form_data, 'lot_size_area', 'lot_size')} {_pick(form_data, 'lot_size_unit')}
School District: {_pick(form_data, 'school_district')}
HOA: {_pick(form_data, 'hoa_type')} {_pick(form_data, 'hoa_dues')}
Interior Features: {_fmt_list(form_data.get('interior_features'))}
Appliances: {_fmt_list(form_data.get('appliances'))}
Flooring: {_fmt_list(form_data.get('flooring'))}
Heating: {_fmt_list(form_data.get('heating'))}
Cooling: {_fmt_list(form_data.get('cooling'))}
Pool: {_pick(form_data, 'pool_yn') or 'No'}
Pool Features: {_fmt_list(form_data.get('pool_features'))}
Garage: {_pick(form_data, 'garage_yn')} - {_pick(form_data, 'garage_spaces')} spaces
Parking: {_fmt_list(form_data.get('parking_features'))}
Community Features: {_fmt_list(form_data.get('community_features'))}
Exterior Features: {_fmt_list(form_data.get('exterior_features'))}
Lot Features: {_fmt_list(form_data.get('lot_features'))}
Construction: {_fmt_list(form_data.get('construction_material'))}
Foundation: {_fmt_list(form_data.get('foundation'))}
Roof: {_fmt_list(form_data.get('roof'))}
Agent notes: {_pick(form_data, 'private_remarks', 'public_remarks')}
"""


def _require_agent_listing(
    client: Any,
    listing_id: str,
    agent_id: str,
    *,
    expected_stage: str | None = None,
) -> dict[str, Any]:
    listing = _single_row(
        client.table("listings")
        .select(
            "id, agent_id, stage, listing_type, address_full, form_data, "
            "description_generated, list_price, mls_number, brokermint_transaction_id",
        )
        .eq("id", listing_id),
    )
    if not listing or listing.get("agent_id") != agent_id:
        raise HTTPException(status_code=403, detail="Not your listing")
    if expected_stage and listing.get("stage") != expected_stage:
        raise HTTPException(
            status_code=409,
            detail=f"Listing must be in {expected_stage} stage",
        )
    return listing


@router.post("/{listing_id}/generate-description")
async def generate_description(
    listing_id: str,
    agent_id: str = Depends(require_agent),
) -> dict[str, Any]:
    client = get_service_client()
    listing = _require_agent_listing(
        client,
        listing_id,
        agent_id,
        expected_stage="mls_submitted",
    )

    form_data = listing.get("form_data") or {}
    if not isinstance(form_data, dict):
        form_data = {}

    context = _build_description_context(
        form_data,
        str(listing.get("listing_type") or "listing"),
        listing.get("address_full"),
    )

    settings = get_settings()
    groq_client = groq.Groq(api_key=settings.require_groq())

    try:
        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {
                    "role": "user",
                    "content": DESCRIPTION_PROMPT.format(context=context),
                },
            ],
            temperature=0.7,
            max_tokens=400,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Description generation failed: {exc}",
        ) from exc

    description = (response.choices[0].message.content or "").strip()
    if len(description) > 1000:
        description = description[:1000].rstrip()

    return {"description": description, "char_count": len(description)}


@router.post("/{listing_id}/go-live")
async def mark_listing_live(
    listing_id: str,
    body: GoLiveBody = Body(default_factory=GoLiveBody),
    agent_id: str = Depends(require_agent),
) -> dict[str, Any]:
    client = get_service_client()
    listing = _require_agent_listing(
        client,
        listing_id,
        agent_id,
        expected_stage="mls_submitted",
    )

    form_data = listing.get("form_data") or {}
    if not isinstance(form_data, dict):
        form_data = {}

    description = (
        form_data.get("property_description")
        or listing.get("description_generated")
        or ""
    )
    if isinstance(description, str):
        description = description.strip()
    else:
        description = str(description)

    if not description:
        raise HTTPException(
            status_code=400,
            detail="Property description required before going live",
        )

    live_date = body.go_live_date.strip() if body.go_live_date else ""
    if not live_date:
        live_date = date.today().isoformat()
    client.table("listings").update(
        {
            "stage": "live",
            "go_live_date": live_date,
            "description_generated": description,
            "form_data": {**form_data, "property_description": description},
        },
    ).eq("id", listing_id).execute()

    agent = _single_row(
        client.table("users")
        .select("full_name, email, phone")
        .eq("id", agent_id),
    ) or {}

    settings = get_settings()
    frontend_url = settings.frontend_url.strip() or (
        settings.cors_origin_list[0] if settings.cors_origin_list else "http://localhost:5173"
    )

    webhook_url = settings.n8n_go_live_webhook_url.strip()
    if webhook_url:
        payload = {
            "event": "listing_live",
            "listing_id": listing_id,
            "brokermint_transaction_id": listing.get("brokermint_transaction_id"),
            "property_address": listing.get("address_full")
            or _pick(form_data, "address_full"),
            "list_price": _pick(form_data, "list_price", "list_price_total")
            or listing.get("list_price"),
            "bedrooms": _pick(form_data, "bedrooms_total", "bedrooms", "beds"),
            "bathrooms": _pick(form_data, "bathrooms_full", "bathrooms", "baths"),
            "sqft": _pick(form_data, "living_area_sqft", "sqft", "square_feet"),
            "property_description": description,
            "school_district": _pick(form_data, "school_district"),
            "agent_name": agent.get("full_name", ""),
            "agent_email": agent.get("email", ""),
            "agent_phone": agent.get("phone", ""),
            "listing_url": f"{frontend_url.rstrip('/')}/listing/{listing_id}",
            "lofty_webhook_url": settings.lofty_webhook_url.strip(),
        }
        try:
            async with httpx.AsyncClient(timeout=15.0) as http_client:
                await http_client.post(
                    webhook_url,
                    json=payload,
                    headers={"Content-Type": "application/json"},
                )
        except httpx.HTTPError:
            pass

    return {"success": True, "stage": "live"}


def _parse_json_content(raw: str) -> dict[str, Any]:
    content = raw.strip()
    if content.startswith("```"):
        parts = content.split("```")
        if len(parts) >= 2:
            content = parts[1]
            if content.startswith("json"):
                content = content[4:]
    return json.loads(content.strip())


@router.post("/{listing_id}/marketing/refine")
async def refine_marketing_content(
    listing_id: str,
    req: MarketingRefineRequest,
    agent_id: str = Depends(require_agent),
) -> dict[str, str]:
    client = get_service_client()
    _require_agent_listing(client, listing_id, agent_id, expected_stage="marketing")

    settings = get_settings()
    groq_client = groq.Groq(api_key=settings.require_groq())

    if req.page_type == "flyer_footer":
        prompt = f"""You are a real estate marketing assistant.

The agent wants to update the footer contact line on a listing flyer.

Current footer line (format: Full Name | Phone | Email):
{req.current_content}

Agent's instruction:
"{req.instruction}"

Return ONLY the revised footer line in exactly this format:
Full Name | Phone | Email

Rules:
- Change only the contact fields the instruction asks for; keep the others unchanged.
- Do not include property description or any other text.
- Return a single line, no explanation."""
    else:
        prompt = f"""You are a real estate marketing copywriter.

The agent wants to refine this content for their {req.page_type}:

Current content:
{req.current_content}

Property context:
{req.listing_context}

Agent's instruction:
"{req.instruction}"

Rewrite the content following the instruction.
Keep the same approximate length and format.
Do not add agent contact details unless the instruction explicitly asks for them.
Return only the revised content, no explanation."""

    try:
        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=500,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Marketing refinement failed: {exc}",
        ) from exc

    content = (response.choices[0].message.content or "").strip()
    if content.startswith("```"):
        parts = content.split("```")
        if len(parts) >= 2:
            content = parts[1]
            if content.startswith("json"):
                content = content[4:]
        content = content.strip()
    return {"content": content}


@router.post("/{listing_id}/marketing/neighborhood-guide")
async def generate_neighborhood_guide(
    listing_id: str,
    agent_id: str = Depends(require_agent),
) -> dict[str, Any]:
    client = get_service_client()
    listing = _require_agent_listing(
        client,
        listing_id,
        agent_id,
        expected_stage="marketing",
    )

    form_data = listing.get("form_data") or {}
    if not isinstance(form_data, dict):
        form_data = {}

    city = _pick(form_data, "address_city", "city")
    if not city:
        raise HTTPException(status_code=400, detail="City not found in listing data")

    settings = get_settings()
    groq_client = groq.Groq(api_key=settings.require_groq())

    try:
        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {
                    "role": "user",
                    "content": NEIGHBORHOOD_PROMPT.format(city=city),
                },
            ],
            temperature=0.5,
            max_tokens=700,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Neighborhood guide generation failed: {exc}",
        ) from exc

    raw = (response.choices[0].message.content or "").strip()
    try:
        guide = _parse_json_content(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=502,
            detail="Neighborhood guide returned invalid JSON",
        ) from exc

    return guide


class TransitionRequest(BaseModel):
    stage: str


def date_to_epoch_ms(date_str: str | None) -> int:
    from datetime import datetime, timezone
    if not date_str:
        return int(datetime.utcnow().timestamp() * 1000)
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        return int(dt.replace(tzinfo=timezone.utc).timestamp() * 1000)
    except Exception:
        return int(datetime.utcnow().timestamp() * 1000)


async def _trigger_docs_pending_notification(
    client: Any,
    listing_id: str,
    agent_id: str,
    listing: dict[str, Any],
    txn_id: str,
) -> None:
    settings = get_settings()
    webhook_url = settings.n8n_docs_pending_webhook_url.strip()
    if not webhook_url:
        return

    agent = _single_row(
        client.table("users")
        .select("full_name, email")
        .eq("id", agent_id),
    ) or {}

    agent_email = agent.get("email")
    if not agent_email:
        return

    form_data = listing.get("form_data") or {}
    frontend_url = settings.frontend_url.strip() or (
        settings.cors_origin_list[0] if settings.cors_origin_list else "http://localhost:5173"
    )

    payload = {
        "event": "docs_pending",
        "listing_id": listing_id,
        "brokermint_transaction_id": txn_id,
        "property_address": listing.get("address_full") or _pick(form_data, "address_full") or "New Listing",
        "agent_name": agent.get("full_name", ""),
        "recipients": [agent_email],
        "listing_url": f"{frontend_url.rstrip('/')}/listing/{listing_id}",
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as http_client:
            await http_client.post(
                webhook_url,
                json=payload,
                headers={"Content-Type": "application/json"},
            )
    except httpx.HTTPError:
        pass


async def _trigger_marketing_notification(
    client: Any,
    listing_id: str,
    agent_id: str,
    listing: dict[str, Any],
    asset: dict[str, Any] | None = None,
) -> None:
    settings = get_settings()
    webhook_url = settings.n8n_marketing_webhook_url.strip()
    if not webhook_url:
        return

    agent = _single_row(
        client.table("users")
        .select("full_name, email, phone")
        .eq("id", agent_id),
    ) or {}

    form_data = listing.get("form_data") or {}
    frontend_url = settings.frontend_url.strip() or (
        settings.cors_origin_list[0] if settings.cors_origin_list else "http://localhost:5173"
    )

    payload = {
        "event": "marketing_asset_added" if asset else "marketing_pending",
        "listing_id": listing_id,
        "property_address": listing.get("address_full") or _pick(form_data, "address_full"),
        "list_price": _pick(form_data, "list_price", "list_price_total") or listing.get("list_price"),
        "listing_type": form_data.get("listing_type") or listing.get("listing_type") or "listing",
        "agent_name": agent.get("full_name", ""),
        "agent_email": agent.get("email", ""),
        "agent_phone": agent.get("phone", ""),
        "listing_url": f"{frontend_url.rstrip('/')}/listing/{listing_id}",
    }
    if asset:
        payload["asset"] = asset

    try:
        async with httpx.AsyncClient(timeout=15.0) as http_client:
            await http_client.post(
                webhook_url,
                json=payload,
                headers={"Content-Type": "application/json"},
            )
    except httpx.HTTPError:
        pass


@router.post("/{listing_id}/transition")
async def transition_listing(
    listing_id: str,
    req: TransitionRequest,
    agent_id: str = Depends(require_agent),
) -> dict[str, Any]:
    client = get_service_client()
    listing = _require_agent_listing(client, listing_id, agent_id)
    
    target_stage = req.stage.strip()
    
    if target_stage == "docs_pending":
        existing_txn_id = listing.get("brokermint_transaction_id")
        if existing_txn_id:
            client.table("listings").update({"stage": target_stage}).eq("id", listing_id).execute()
            return {"success": True, "stage": target_stage}

        # 1. Validate required fields in form_data
        form_data = listing.get("form_data") or {}
        seller_name = form_data.get("seller_name")
        seller_email = form_data.get("seller_email")
        seller_phone = form_data.get("seller_phone")
        listing_type = form_data.get("listing_type") or listing.get("listing_type")
        
        if not seller_name or not seller_email or not seller_phone or not listing_type:
            raise HTTPException(
                status_code=400,
                detail="Missing required fields: seller_name, seller_email, seller_phone, and listing_type must be complete."
            )
            
        # 2. Get checklist template mapping
        mapping = client.table("listing_type_checklist_mapping") \
            .select("checklist_template_id") \
            .eq("listing_type", listing_type) \
            .maybe_single() \
            .execute()
            
        if not mapping or not mapping.data:
            raise HTTPException(
                status_code=400,
                detail=f"No checklist mapping configured for listing type '{listing_type}'"
            )
        template_id = mapping.data["checklist_template_id"]
        
        # Fetch agent profile to get their brokermint_id
        agent_profile = client.table("users").select("brokermint_id").eq("id", agent_id).single().execute()
        agent_bm_id = agent_profile.data.get("brokermint_id") if agent_profile.data else None
        if not agent_bm_id:
            raise HTTPException(
                status_code=400,
                detail="Your agent profile is not synchronized with BrokerMint (missing BrokerMint ID)."
            )
            
        # 3. Create a real Contact in BrokerMint first
        from services.brokermint_service import (
            create_bm_transaction,
            create_bm_contact,
            add_bm_user_participant,
            add_bm_contact_participant,
            apply_bm_checklist_template
        )
        
        parts = seller_name.strip().split(" ", 1)
        first_name = parts[0]
        last_name = parts[1] if len(parts) > 1 else ""
        
        contact_payload = {
            "first_name": first_name,
            "last_name": last_name,
            "email": seller_email,
            "phone": seller_phone
        }
        contact_res = await create_bm_contact(contact_payload)
        seller_contact_id = contact_res["id"]
            
        # 4. Formulate the BrokerMint transaction payload
        # Map property type
        prop_sub_type = form_data.get("property_sub_type") or form_data.get("property_type")
        mapped_prop_type = "Other"
        if prop_sub_type:
            pst = str(prop_sub_type).lower()
            if "single family" in pst:
                mapped_prop_type = "Single family"
            elif "condo" in pst:
                mapped_prop_type = "Condo"
            elif "townhouse" in pst:
                mapped_prop_type = "Townhouse"
            elif "mobile" in pst:
                mapped_prop_type = "Mobile"
            elif "manufactured" in pst:
                mapped_prop_type = "Manufactured"
            elif "farm" in pst:
                mapped_prop_type = "Farm"
        
        # Representing, transaction_type, and representer configuration
        representing = "seller"
        listing_side_rep = {"id": 15827, "type": "Account"}
        buying_side_rep = None
        
        # Exact transaction types matching BrokerMint live values
        if listing_type == "lease":
            transaction_type = "rent/lease"
        elif listing_type == "buyer":
            representing = "buyer"
            transaction_type = "traditional sale"
            listing_side_rep = None
            buying_side_rep = {"id": 15827, "type": "Account"}
        else:
            transaction_type = "traditional sale"
            
        payload = {
            "address": form_data.get("street_number", "") + " " + form_data.get("street_name", ""),
            "city": form_data.get("city", "Dallas"),
            "state": form_data.get("state", "TX"),
            "zip": form_data.get("zip_code", "75248"),
            "transaction_name": listing.get("address_full") or "Listing Draft",
            "price": float(form_data.get("list_price") or listing.get("list_price") or 0.0),
            "transaction_type": transaction_type,
            "status": "pending",
            "representing": representing,
            "listing_side_representer": listing_side_rep,
            "buying_side_representer": buying_side_rep,
            "listing_date": date_to_epoch_ms(form_data.get("list_date")),
            "expiration_date": date_to_epoch_ms(form_data.get("expire_date")),
            "custom_attributes": [
                {
                    "type": "dropdown", "label": "Lead source", "name": "lead_source", "value": "Other",
                    "options": ["Other", "SOI", "Company Lead", "Company Lead Allegiance PM", 
                                "OJO Lead", "Primestreet Lead", "Opcity Lead", "Team Lead", 
                                "Referral from another company", "Relocation Company Referral", 
                                "Referral from LP agent"]
                },
                {
                    "type": "text", "label": "Client 1 Name", "name": "f458183117", 
                    "value": seller_name, "options": []
                },
                {
                    "type": "text", "label": "Client 1 Email", "name": "f770006910", 
                    "value": seller_email, "options": []
                },
                {
                    "type": "text", "label": "Client 1 Phone", "name": "f426667625", 
                    "value": seller_phone, "options": []
                },
                {
                    "type": "text", "label": "MLS Number", "name": "mls_number", 
                    "value": listing.get("mls_number") or "", "options": []
                },
                {
                    "type": "text", "label": "County", "name": "county", 
                    "value": form_data.get("county") or "", "options": []
                },
                {
                    "type": "dropdown", "label": "Property type", "name": "property_type",
                    "value": mapped_prop_type,
                    "options": ["Not specified", "Apartment", "Commercial", "Condo", "Duplex",
                                "Farm", "Land", "Manufactured", "Mobile", "Multi unit",
                                "Rentals", "Single family", "Townhouse", "Other"]
                },
                {
                    "type": "dropdown", "label": "Lockbox", "name": "lockbox",
                    "value": form_data.get("lockbox", "No"), "options": ["Yes", "No"]
                },
                {
                    "type": "dropdown", "label": "Yard sign", "name": "yard_sign",
                    "value": form_data.get("yard_sign", "No"), "options": ["Yes", "No"]
                }
            ]
        }
        
        # 5. Invoke BrokerMint API to create transaction
        txn = await create_bm_transaction(payload)
        txn_id = txn["id"]
        
        # 6. Attach participants
        # Agent
        await add_bm_user_participant(txn_id, int(agent_bm_id), "Agent", owner=True)
        # Tricia as accountant
        await add_bm_user_participant(txn_id, 177899, "accountant")
        # Angie Smith as office administrator & cda administrator
        await add_bm_user_participant(txn_id, 177976, "office administrator, cda administrator")
        # Attach the created seller/buyer contact
        client_role = "buyer" if listing_type == "buyer" else "seller"
        await add_bm_contact_participant(txn_id, seller_contact_id, client_role)
        
        # 7. Apply Checklist
        await apply_bm_checklist_template(txn_id, template_id)
        
        # 8. Store Transaction ID
        client.table("listings").update({
            "stage": target_stage,
            "brokermint_transaction_id": str(txn_id)
        }).eq("id", listing_id).execute()
        
        # 9. Trigger docs_pending notification
        await _trigger_docs_pending_notification(client, listing_id, agent_id, listing, str(txn_id))
        
    else:
        # Standard transition
        client.table("listings").update({"stage": target_stage}).eq("id", listing_id).execute()
        if target_stage == "marketing":
            await _trigger_marketing_notification(client, listing_id, agent_id, listing)
        
    return {"success": True, "stage": target_stage}


class AddMarketingAssetRequest(BaseModel):
    asset_id: str
    asset_name: str
    price_cents: int
    paid: bool = False


@router.post("/{listing_id}/marketing/add-asset")
async def add_marketing_asset(
    listing_id: str,
    req: AddMarketingAssetRequest,
    agent_id: str = Depends(require_agent),
) -> dict[str, Any]:
    client = get_service_client()
    listing = _require_agent_listing(client, listing_id, agent_id)

    form_data = listing.get("form_data") or {}
    marketing_statuses = form_data.get("marketing_statuses") or {}
    marketing_statuses[req.asset_id] = "in_progress"
    
    # Save back to Supabase
    form_data["marketing_statuses"] = marketing_statuses
    client.table("listings").update({"form_data": form_data}).eq("id", listing_id).execute()

    # Trigger webhook with the asset details structured
    asset_payload = {
        "id": req.asset_id,
        "name": req.asset_name,
        "price_cents": req.price_cents,
        "paid": req.paid
    }
    await _trigger_marketing_notification(
        client, listing_id, agent_id, listing, asset=asset_payload
    )

    return {"success": True, "marketing_statuses": marketing_statuses}

