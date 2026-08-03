import logging
from datetime import date, datetime, timezone
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from supabase import create_client

from config import get_settings
from deps.auth import require_admin, get_current_user, get_service_client
from services.brokermint_service import update_bm_user_custom_field
from services.brokermint_sync import resolve_sponsors
from services.revenue_share import (
    revenue_share_earnings_job,
    get_cap_cycle_start,
    check_agent_eligibility,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/revenue-share", tags=["revenue-share"])

class SettingsUpdateBody(BaseModel):
    min_cap_amount: float
    grace_period_months: int
    production_min_transactions: int
    production_window_months: int
    gen1_rate: float
    gen2_rate: float
    gen3_rate: float
    gen4_rate: float
    gen5_rate: float
    gen1_completion_bonus: float
    gen2_completion_bonus: float
    gen3_completion_bonus: float
    gen4_completion_bonus: float
    gen5_completion_bonus: float
    gen1_max_payout: float
    gen2_max_payout: float
    gen3_max_payout: float
    gen4_max_payout: float
    gen5_max_payout: float
    gen2_unlock_count: int
    gen3_unlock_count: int
    gen4_unlock_count: int
    gen5_unlock_count: int

class OverrideUpdateBody(BaseModel):
    user_id: str
    cap_override: Optional[float] = None
    eligibility_override: Optional[bool] = None
    cash_override: bool = False
    sponsor_override: Optional[str] = None
    notes: Optional[str] = None

class ResolveBody(BaseModel):
    user_id: str
    sponsor_override: Optional[str] = None  # user ID of the selected sponsor

class PaymentCreateBody(BaseModel):
    recipient_user_id: str
    period_label: str
    cash_amount: float
    credit_amount: float
    earning_ids: List[str]
    bonus_ids: List[str]
    notes: Optional[str] = None


@router.get("/settings")
async def get_settings_endpoint():
    """Retrieve global revenue share settings configuration."""
    client = get_service_client()
    res = client.table("revenue_share_settings").select("*").order("updated_at", desc=True).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Settings not found")
    return res.data[0]


@router.post("/settings")
async def update_settings_endpoint(body: SettingsUpdateBody, admin_id: str = Depends(require_admin)):
    """Admin only. Update global revenue share settings configuration."""
    client = get_service_client()
    res = client.table("revenue_share_settings").insert({
        **body.model_dump(),
        "updated_by": admin_id,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }).execute()
    return res.data[0]


@router.get("/overrides")
async def get_overrides_endpoint(admin_id: str = Depends(require_admin)):
    """Admin only. Retrieve all overrides joined with user names."""
    client = get_service_client()
    # Fetch users and overrides
    users = client.table("users").select("id, full_name, email, role, status, cap_amount").eq("role", "agent").execute()
    overrides = client.table("agent_overrides").select("*").execute()
    
    overrides_map = {o["user_id"]: o for o in overrides.data} if overrides.data else {}
    
    result = []
    for u in (users.data or []):
        uid = u["id"]
        override = overrides_map.get(uid, {})
        result.append({
            "user_id": uid,
            "full_name": u["full_name"],
            "email": u["email"],
            "status": u["status"],
            "cap_amount": u["cap_amount"],
            "cap_override": override.get("cap_override"),
            "eligibility_override": override.get("eligibility_override"),
            "cash_override": override.get("cash_override", False),
            "sponsor_override": override.get("sponsor_override"),
            "notes": override.get("notes")
        })
    return result


@router.post("/overrides")
async def update_override_endpoint(body: OverrideUpdateBody, admin_id: str = Depends(require_admin)):
    """Admin only. Create or update override details for an agent."""
    client = get_service_client()
    override_data = {
        "user_id": body.user_id,
        "cap_override": body.cap_override,
        "eligibility_override": body.eligibility_override,
        "cash_override": body.cash_override,
        "sponsor_override": body.sponsor_override,
        "notes": body.notes,
        "updated_by": admin_id,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    res = client.table("agent_overrides").upsert(override_data, on_conflict="user_id").execute()
    # Trigger sponsor resolution after override change
    await resolve_sponsors(client)
    return res.data[0] if res.data else {}


@router.get("/resolution-logs")
async def get_resolution_logs_endpoint(admin_id: str = Depends(require_admin)):
    """Admin only. Retrieve sponsor resolution issues logs."""
    client = get_service_client()
    logs = client.table("sponsor_resolution_log").select("*, users:users!sponsor_resolution_log_user_id_fkey!inner(full_name, email)").execute()
    return logs.data or []


@router.post("/resolution-logs/resolve")
async def resolve_log_endpoint(body: ResolveBody, admin_id: str = Depends(require_admin)):
    """Admin only. Manually resolve unmatched/ambiguous sponsor relationship."""
    client = get_service_client()
    
    # 1. Update agent_overrides
    override_data = {
        "user_id": body.user_id,
        "sponsor_override": body.sponsor_override,
        "updated_by": admin_id,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    client.table("agent_overrides").upsert(override_data, on_conflict="user_id").execute()
    
    # 2. Clear resolution log entry
    client.table("sponsor_resolution_log").delete().eq("user_id", body.user_id).execute()
    
    # 3. Trigger full resolution pass
    await resolve_sponsors(client)
    return {"status": "resolved"}


@router.get("/payments")
async def get_payment_ledger_endpoint(admin_id: str = Depends(require_admin)):
    """
    Admin only. Suggested payment ledger for Tricia.
    Fills agent's remaining cap space first, rest is cash.
    """
    client = get_service_client()
    
    # Get all global settings
    settings_res = client.table("revenue_share_settings").select("*").order("updated_at", desc=True).limit(1).execute()
    settings = settings_res.data[0]
    
    # 1. Query all unpaid earnings and completion bonuses
    # An earning or bonus is unpaid if it does not appear in revenue_share_payment_contributions
    earnings_res = client.table("revenue_share_earnings")\
        .select("id, recipient_user_id, amount, contributing_user_id, generation")\
        .execute()
        
    bonuses_res = client.table("revenue_share_completion_bonuses")\
        .select("id, recipient_user_id, amount, contributing_user_id, generation")\
        .execute()
        
    contribs_res = client.table("revenue_share_payment_contributions").select("earning_id, bonus_id").execute()
    paid_earning_ids = set(c["earning_id"] for c in contribs_res.data if c.get("earning_id"))
    paid_bonus_ids = set(c["bonus_id"] for c in contribs_res.data if c.get("bonus_id"))
    
    unpaid_earnings = [e for e in (earnings_res.data or []) if e["id"] not in paid_earning_ids]
    unpaid_bonuses = [b for b in (bonuses_res.data or []) if b["id"] not in paid_bonus_ids]
    
    # Group by recipient_user_id
    ledger: Dict[str, Dict[str, Any]] = {}
    
    # Fetch all user info
    users_res = client.table("users").select("id, full_name, email, anniversary_date, cap_start_date, cap_amount").execute()
    users = {u["id"]: u for u in users_res.data}
    
    # Fetch all overrides
    overrides_res = client.table("agent_overrides").select("user_id, cap_override").execute()
    overrides = {o["user_id"]: o["cap_override"] for o in overrides_res.data}
    
    for item in unpaid_earnings + unpaid_bonuses:
        rec_id = item["recipient_user_id"]
        if not rec_id or rec_id not in users:
            continue
            
        if rec_id not in ledger:
            ledger[rec_id] = {
                "recipient_id": rec_id,
                "recipient_name": users[rec_id]["full_name"],
                "recipient_email": users[rec_id]["email"],
                "unpaid_total": 0.0,
                "earning_ids": [],
                "bonus_ids": [],
                "items": []
            }
            
        is_earning = "recipient_user_id" in item and "bm_commission_id" in item  # Wait, both lists have id/amount
        ledger[rec_id]["unpaid_total"] += float(item["amount"] or 0)
        
        contrib_agent = users.get(item["contributing_user_id"], {}).get("full_name", "Unknown Agent")
        
        # Check if earning or bonus
        if item["id"] in [e["id"] for e in unpaid_earnings]:
            ledger[rec_id]["earning_ids"].append(item["id"])
            ledger[rec_id]["items"].append({
                "type": "earning",
                "id": item["id"],
                "contributor": contrib_agent,
                "generation": item["generation"],
                "amount": float(item["amount"])
            })
        else:
            ledger[rec_id]["bonus_ids"].append(item["id"])
            ledger[rec_id]["items"].append({
                "type": "bonus",
                "id": item["id"],
                "contributor": contrib_agent,
                "generation": item["generation"],
                "amount": float(item["amount"])
            })
            
    # Calculate suggestion split for each recipient
    suggestions = []
    for rec_id, rec_data in ledger.items():
        unpaid_total = round(rec_data["unpaid_total"], 2)
        
        # Calculate cap cycle details for recipient
        rec_user = users[rec_id]
        today = date.today()
        cycle_start = get_cap_cycle_start(
            rec_user.get("anniversary_date"),
            rec_user.get("cap_start_date"),
            today
        )
        
        # Sum recipient's COMPANY_DOLLAR_CONTRIBUTION in current cycle
        comm_res = client.table("bm_commissions")\
            .select("calculated_dollar_amount, bm_transactions!inner(closed_at)")\
            .eq("user_id", rec_id)\
            .eq("item_type", "COMPANY_DOLLAR_CONTRIBUTION")\
            .execute()
            
        cap_paid = 0.0
        for c in (comm_res.data or []):
            closed_at = c["bm_transactions"]["closed_at"]
            if closed_at and closed_at[:10] >= cycle_start.isoformat():
                cap_paid += float(c["calculated_dollar_amount"] or 0)
                
        # Sum already paid credit in this cap year
        paid_credit_res = client.table("revenue_share_payments")\
            .select("credit_amount")\
            .eq("recipient_user_id", rec_id)\
            .eq("status", "paid")\
            .gte("paid_at", cycle_start.isoformat())\
            .execute()
            
        paid_credit = sum(float(p["credit_amount"] or 0) for p in paid_credit_res.data) if paid_credit_res.data else 0.0
        
        # Effective cap amount
        cap_override = overrides.get(rec_id)
        cap_amount = float(cap_override) if cap_override is not None else float(rec_user.get("cap_amount") or 0)
        
        total_credited = cap_paid + paid_credit
        remaining_cap_room = max(0.0, cap_amount - total_credited)
        
        credit_suggested = min(unpaid_total, remaining_cap_room)
        cash_suggested = max(0.0, unpaid_total - credit_suggested)
        
        suggestions.append({
            **rec_data,
            "unpaid_total": unpaid_total,
            "credit_suggested": round(credit_suggested, 2),
            "cash_suggested": round(cash_suggested, 2),
            "remaining_cap_room": round(remaining_cap_room, 2)
        })
        
    return suggestions


@router.post("/payments")
async def create_payment_endpoint(body: PaymentCreateBody, admin_id: str = Depends(require_admin)):
    """Admin only. Record payout details, link contributions, and sync credit back to BrokerMint."""
    client = get_service_client()
    
    # 1. Insert payment record
    payment_res = client.table("revenue_share_payments").insert({
        "recipient_user_id": body.recipient_user_id,
        "period_label": body.period_label,
        "cash_amount": body.cash_amount,
        "credit_amount": body.credit_amount,
        "status": "paid",
        "paid_at": datetime.now(timezone.utc).isoformat(),
        "paid_by": admin_id,
        "notes": body.notes,
        "created_at": datetime.now(timezone.utc).isoformat()
    }).execute()
    
    if not payment_res.data:
        raise HTTPException(status_code=500, detail="Failed to create payment record.")
        
    payment = payment_res.data[0]
    payment_id = payment["id"]
    
    # 2. Insert contributions
    # Calculate payout weights if unpaid total doesn't match total paid
    total_paid = body.cash_amount + body.credit_amount
    
    # Retrieve all earnings/bonuses to distribute payment fairly
    all_earnings = []
    if body.earning_ids:
        all_earnings = client.table("revenue_share_earnings").select("id, amount").in_("id", body.earning_ids).execute().data or []
        
    all_bonuses = []
    if body.bonus_ids:
        all_bonuses = client.table("revenue_share_completion_bonuses").select("id, amount").in_("id", body.bonus_ids).execute().data or []
        
    unpaid_total = sum(float(x["amount"]) for x in all_earnings + all_bonuses)
    
    for item in all_earnings:
        weight = float(item["amount"]) / unpaid_total if unpaid_total > 0 else 0
        allocated = round(total_paid * weight, 2)
        client.table("revenue_share_payment_contributions").insert({
            "payment_id": payment_id,
            "earning_id": item["id"],
            "amount": allocated
        }).execute()
        
    for item in all_bonuses:
        weight = float(item["amount"]) / unpaid_total if unpaid_total > 0 else 0
        allocated = round(total_paid * weight, 2)
        client.table("revenue_share_payment_contributions").insert({
            "payment_id": payment_id,
            "bonus_id": item["id"],
            "amount": allocated
        }).execute()
        
    # 3. Push calculations to BrokerMint
    from services.revenue_share import sync_agent_revenue_share_to_brokermint
    await sync_agent_revenue_share_to_brokermint(client, body.recipient_user_id)
            
    return payment


@router.post("/reprocess")
async def reprocess_endpoint(admin_id: str = Depends(require_admin)):
    """Admin only. Force re-run the calculations job from the launch date."""
    client = get_service_client()
    try:
        await revenue_share_earnings_job(client)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/my-earnings")
async def get_my_earnings_endpoint(user: dict = Depends(get_current_user)):
    """Agent only. Retrieve detailed earnings breakdowns by generation and payments."""
    client = get_service_client()
    user_id = user["id"]
        
    # Query earnings and completion bonuses
    earnings_res = client.table("revenue_share_earnings")\
        .select("id, amount, generation, created_at, contributing_user_id, bm_commission_id, bm_commissions(bm_transactions(address))")\
        .eq("recipient_user_id", user_id)\
        .execute()
        
    bonuses_res = client.table("revenue_share_completion_bonuses")\
        .select("id, amount, generation, created_at, contributing_user_id")\
        .eq("recipient_user_id", user_id)\
        .execute()
        
    # Get payment contributions
    contribs_res = client.table("revenue_share_payment_contributions")\
        .select("id, payment_id, earning_id, bonus_id, amount, revenue_share_payments(status)")\
        .execute()
        
    paid_earning_ids = set(c["earning_id"] for c in contribs_res.data if c.get("earning_id") and c["revenue_share_payments"]["status"] == "paid")
    paid_bonus_ids = set(c["bonus_id"] for c in contribs_res.data if c.get("bonus_id") and c["revenue_share_payments"]["status"] == "paid")
    
    # User info mapping
    users_res = client.table("users").select("id, full_name").execute()
    users_map = {u["id"]: u["full_name"] for u in users_res.data} if users_res.data else {}
    
    earnings_list = []
    total_earned = 0.0
    paid_cash = 0.0
    paid_credit = 0.0
    
    generation_breakdown = {1: 0.0, 2: 0.0, 3: 0.0, 4: 0.0, 5: 0.0}
    
    for item in (earnings_res.data or []):
        amount = float(item["amount"])
        total_earned += amount
        gen = item["generation"]
        if gen in generation_breakdown:
            generation_breakdown[gen] += amount
            
        is_paid = item["id"] in paid_earning_ids
        
        # Find contribution details
        contrib = next((c for c in contribs_res.data if c.get("earning_id") == item["id"]), None)
        c_amount = float(contrib["amount"]) if contrib else 0.0
        
        address = item.get("bm_commissions", {}).get("bm_transactions", {}).get("address", "Unknown Address") if item.get("bm_commissions") else "Transaction Earning"
        
        earnings_list.append({
            "id": item["id"],
            "type": "earning",
            "amount": amount,
            "generation": gen,
            "contributor": users_map.get(item["contributing_user_id"], "Unknown Agent"),
            "description": f"Split on {address}",
            "created_at": item["created_at"],
            "is_paid": is_paid
        })
        
    for item in (bonuses_res.data or []):
        amount = float(item["amount"])
        total_earned += amount
        gen = item["generation"]
        if gen in generation_breakdown:
            generation_breakdown[gen] += amount
            
        is_paid = item["id"] in paid_bonus_ids
        
        earnings_list.append({
            "id": item["id"],
            "type": "bonus",
            "amount": amount,
            "generation": gen,
            "contributor": users_map.get(item["contributing_user_id"], "Unknown Agent"),
            "description": "Cap Completion Bonus",
            "created_at": item["created_at"],
            "is_paid": is_paid
        })
        
    # Get payments list
    payments_res = client.table("revenue_share_payments")\
        .select("*")\
        .eq("recipient_user_id", user_id)\
        .order("created_at", desc=True)\
        .execute()
        
    for p in (payments_res.data or []):
        if p["status"] == "paid":
            paid_cash += float(p["cash_amount"] or 0)
            paid_credit += float(p["credit_amount"] or 0)
            
    summary = {
        "total_earned": round(total_earned, 2),
        "paid_cash": round(paid_cash, 2),
        "paid_credit": round(paid_credit, 2),
        "unpaid_balance": round(total_earned - (paid_cash + paid_credit), 2),
        "generation_breakdown": {g: round(val, 2) for g, val in generation_breakdown.items()}
    }
    
    return {
        "eligible": True,
        "earnings": sorted(earnings_list, key=lambda x: x["created_at"], reverse=True),
        "payments": payments_res.data or [],
        "summary": summary
    }


@router.get("/policy-url")
async def get_policy_url_endpoint(user: dict = Depends(get_current_user)):
    """Generate signed URLs for download links of growth policy decks."""
    client = get_service_client()
    try:
        # Generate signed URLs for docs in "revenue-share-docs" bucket
        # Fallback to standard URL if not found or let the client handle missing files gracefully
        deck_url = client.storage.from_("revenue-share-docs").create_signed_url("growth_club_deck.pdf", 3600)
        policy_url = client.storage.from_("revenue-share-docs").create_signed_url("revenue_share_policy.pdf", 3600)
        
        return {
            "growth_club_deck": deck_url.get("signedURL") if isinstance(deck_url, dict) else deck_url,
            "revenue_share_policy": policy_url.get("signedURL") if isinstance(policy_url, dict) else policy_url
        }
    except Exception as e:
        logger.error("Error generating signed doc URLs: %s", e)
        return {
            "growth_club_deck": None,
            "revenue_share_policy": None
        }
