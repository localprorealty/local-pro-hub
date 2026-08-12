import os
from datetime import date, datetime
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel
from supabase import create_client
from services.brokermint_sync import run_full_sync
from deps.auth import require_admin, get_current_user
from config import get_settings

router = APIRouter(prefix="/brokermint", tags=["brokermint"])

settings = get_settings()
supabase = create_client(*settings.require_supabase())


class MarkPaidRequest(BaseModel):
    commission_ids: List[str]
    payment_note: Optional[str] = None


@router.post("/sync")
async def trigger_sync(background_tasks: BackgroundTasks, _admin_id: str = Depends(require_admin)):
    """Admin only. Runs full BrokerMint sync in the background."""
    # Check if a sync is already running
    active_sync = supabase.table("bm_sync_log").select("status").eq("status", "running").execute()
    if active_sync.data:
        raise HTTPException(status_code=400, detail="A sync is already in progress.")

    background_tasks.add_task(run_full_sync, supabase)
    return {"status": "started"}


@router.post("/sync/reset")
async def reset_sync(_admin_id: str = Depends(require_admin)):
    """Admin only. Resets any stuck 'running' sync logs to 'cancelled' so a new sync can be started."""
    # Find all running sync logs
    running_logs = supabase.table("bm_sync_log").select("id").eq("status", "running").execute()
    if not running_logs.data:
        return {"status": "ok", "message": "No active sync was running."}
        
    for log in running_logs.data:
        supabase.table("bm_sync_log").update({
            "status": "cancelled",
            "finished_at": datetime.utcnow().isoformat(),
            "errors": [{"error": "Cancelled by admin"}]
        }).eq("id", log["id"]).execute()
        
    return {"status": "reset", "message": f"Successfully reset {len(running_logs.data)} stuck sync logs."}


class ChecklistMappingRow(BaseModel):
    listing_type: str
    checklist_template_id: int


@router.get("/checklist-mappings")
async def get_checklist_mappings(_admin_id: str = Depends(require_admin)):
    res = supabase.table("listing_type_checklist_mapping").select("*").execute()
    return res.data or []


@router.post("/checklist-mappings")
async def update_checklist_mappings(mappings: List[ChecklistMappingRow], _admin_id: str = Depends(require_admin)):
    for m in mappings:
        supabase.table("listing_type_checklist_mapping").upsert({
            "listing_type": m.listing_type,
            "checklist_template_id": m.checklist_template_id
        }, on_conflict="listing_type").execute()
    return {"status": "success"}



@router.get("/sync-status")
async def sync_status(_admin_id: str = Depends(require_admin)):
    """Returns the active running sync log entry, or the most recent sync log entry."""
    running = supabase.table("bm_sync_log") \
        .select("*") \
        .eq("status", "running") \
        .order("started_at", desc=True) \
        .limit(1) \
        .execute()
    if running.data:
        return running.data[0]

    result = supabase.table("bm_sync_log") \
        .select("*") \
        .order("started_at", desc=True) \
        .limit(1) \
        .execute()
    return result.data[0] if result.data else {"status": "never_synced"}


@router.get("/my-history")
async def my_history(user: dict = Depends(get_current_user)):
    """
    Returns the current agent's transaction history with
    their commission amounts. Sorted by closing_date desc.
    """
    result = supabase.table("bm_commissions") \
        .select("*, bm_transactions(*)") \
        .eq("user_id", user["id"]) \
        .execute()

    rows = result.data or []

    # Agent take-home: NET_COMMISSION items only
    # These represent what the agent actually receives after splits
    AGENT_EARNING_TYPES = {"NET_COMMISSION"}

    # For context display: ADJUSTED_BASIS shows gross before company cut
    GROSS_TYPES = {"ADJUSTED_BASIS"}

    def is_closed(row):
        txn = row.get("bm_transactions") or {}
        return txn.get("status") == "closed"

    def is_in_progress(row):
        txn = row.get("bm_transactions") or {}
        return txn.get("status") in ("active", "pending", "listing")

    earning_rows = [
        r for r in rows
        if r.get("item_type") in AGENT_EARNING_TYPES
    ]

    closed_earning_rows = [r for r in earning_rows if is_closed(r)]
    pending_earning_rows = [r for r in earning_rows if is_in_progress(r)]

    today = date.today()
    this_month_prefix = f"{today.year}-{today.month:02d}"

    this_month_rows = [
        r for r in closed_earning_rows
        if (r.get("bm_transactions") or {})
           .get("closing_date", "")
           .startswith(this_month_prefix)
    ]

    total_earned = sum(
        float(r.get("calculated_dollar_amount") or 0)
        for r in closed_earning_rows
    )
    pending = sum(
        float(r.get("calculated_dollar_amount") or 0)
        for r in pending_earning_rows
    )
    this_month = sum(
        float(r.get("calculated_dollar_amount") or 0)
        for r in this_month_rows
    )

    # Build transaction list — one entry per transaction showing
    # the agent's NET_COMMISSION for that deal
    txn_map = {}
    for row in rows:
        txn = row.get("bm_transactions") or {}
        txn_id = txn.get("id")
        if not txn_id:
            continue
        if txn_id not in txn_map:
            txn_map[txn_id] = {
                "id": txn_id,
                "address": txn.get("address"),
                "city": txn.get("city"),
                "state": txn.get("state"),
                "status": txn.get("status"),
                "closing_date": txn.get("closing_date"),
                "price": txn.get("price"),
                "representing": txn.get("representing"),
                "net_commission": 0,
                "adjusted_basis": 0,
                "paid_at": None,
                "payment_note": None,
                "commission_rows": [],
            }
        if row.get("item_type") == "NET_COMMISSION":
            txn_map[txn_id]["net_commission"] = float(
                row.get("calculated_dollar_amount") or 0
            )
            txn_map[txn_id]["paid_at"] = row.get("paid_at")
            txn_map[txn_id]["payment_note"] = row.get("payment_note")
        if row.get("item_type") == "ADJUSTED_BASIS":
            txn_map[txn_id]["adjusted_basis"] = float(
                row.get("calculated_dollar_amount") or 0
            )
        txn_map[txn_id]["commission_rows"].append(row.get("id"))

    transactions = sorted(
        txn_map.values(),
        key=lambda x: x.get("closing_date") or "",
        reverse=True,
    )

    return {
        "transactions": transactions,
        "summary": {
            "total_earned": total_earned,
            "pending": pending,
            "this_month": this_month,
            "total_transactions": len(txn_map),
            "closed_count": len(closed_earning_rows),
        }
    }


@router.post("/mark-paid")
async def mark_paid(req: MarkPaidRequest, user: dict = Depends(get_current_user)):
    """
    Tricia marks specific commission records as paid.
    Only accessible to users with can_view_revenue = true.
    """
    if not user.get("can_view_revenue"):
        raise HTTPException(status_code=403, detail="Access denied")

    now = datetime.utcnow().isoformat()

    supabase.table("bm_commissions") \
        .update({
            "paid_at": now,
            "paid_by": user["id"],
            "payment_note": req.payment_note,
        }) \
        .in_("id", req.commission_ids) \
        .execute()

    return {"marked_paid": len(req.commission_ids), "paid_at": now}


@router.post("/mark-unpaid")
async def mark_unpaid(req: MarkPaidRequest, user: dict = Depends(get_current_user)):
    """Reverse a payment mark. Same access control."""
    if not user.get("can_view_revenue"):
        raise HTTPException(status_code=403, detail="Access denied")

    supabase.table("bm_commissions") \
        .update({
            "paid_at": None,
            "paid_by": None,
            "payment_note": None,
        }) \
        .in_("id", req.commission_ids) \
        .execute()

    return {"marked_unpaid": len(req.commission_ids)}


@router.get("/all-agents-revenue")
async def all_agents_revenue(
    user: dict = Depends(get_current_user),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
):
    """
    Tricia's view — all agents, all earnings, with paid/unpaid status.
    Filterable by date range.
    Only for can_view_revenue = true users.
    """
    if not user.get("can_view_revenue"):
        raise HTTPException(status_code=403, detail="Access denied")

    # Build commission query
    query = supabase.table("bm_commissions") \
        .select(
            "id, calculated_dollar_amount, item_type, paid_at, payment_note,"
            "bm_transactions(address, city, status, closing_date, price),"
            "users:users!bm_commissions_user_id_fkey(id, full_name, email)"
        ) \
        .eq("item_type", "NET_COMMISSION")

    result = query.execute()
    rows = result.data or []

    # Filter by date range if provided
    if date_from or date_to:
        filtered = []
        for row in rows:
            closing = (row.get("bm_transactions") or {}).get("closing_date")
            if not closing:
                continue
            if date_from and closing < date_from:
                continue
            if date_to and closing > date_to:
                continue
            filtered.append(row)
        rows = filtered

    # Group by agent
    agents = {}
    for row in rows:
        u = row.get("users") or {}
        txn = row.get("bm_transactions") or {}
        uid = u.get("id", "unknown")

        if uid not in agents:
            agents[uid] = {
                "name": u.get("full_name"),
                "email": u.get("email"),
                "total_earned": 0,
                "total_paid": 0,
                "total_unpaid": 0,
                "transactions": [],
            }

        amount = float(row.get("calculated_dollar_amount") or 0)
        is_paid = row.get("paid_at") is not None
        status = (txn.get("status") or "")

        if status == "closed":
            agents[uid]["total_earned"] += amount
            if is_paid:
                agents[uid]["total_paid"] += amount
            else:
                agents[uid]["total_unpaid"] += amount

        agents[uid]["transactions"].append({
            "commission_id": row.get("id"),
            "address": txn.get("address"),
            "city": txn.get("city"),
            "closing_date": txn.get("closing_date"),
            "price": txn.get("price"),
            "amount": amount,
            "status": status,
            "paid": is_paid,
            "payment_note": row.get("payment_note"),
        })

    return {
        "agents": list(agents.values()),
        "date_from": date_from,
        "date_to": date_to,
    }


@router.get("/my-cap-progress")
async def my_cap_progress(user: dict = Depends(get_current_user)):
    """
    Returns the current agent's cap progress for their active cycle.
    
    Cap cycle = from cap_start_date to next anniversary.
    Progress = sum of COMPANY_DOLLAR_CONTRIBUTION since cap_start_date.
    """
    # Get agent's cap info from their profile
    user_result = supabase.table("users") \
        .select(
            "cap_amount, cap_start_date, anniversary_date, "
            "commission_split, monthly_fee, brokermint_id"
        ) \
        .eq("id", user["id"]) \
        .single() \
        .execute()

    if not user_result.data:
        raise HTTPException(status_code=404, detail="User not found")

    u = user_result.data
    cap_amount = u.get("cap_amount")
    cap_start_date = u.get("cap_start_date")
    bm_id = u.get("brokermint_id")

    # If no cap data, return empty state
    if cap_amount is None or not cap_start_date or not bm_id:
        return {
            "has_cap": False,
            "cap_amount": None,
            "cap_paid": 0,
            "cap_remaining": None,
            "percent_complete": 0,
            "capped_out": False,
            "commission_split": u.get("commission_split"),
            "monthly_fee": u.get("monthly_fee"),
            "cap_start_date": None,
            "next_anniversary": None,
        }

    # Calculate cycle start and cycle end (next_anniversary) based on anniversary_date
    from datetime import date
    today = date.today()
    anniversary_date = u.get("anniversary_date")

    if not anniversary_date:
        cycle_start_str = str(cap_start_date)
        next_anniversary = None
    else:
        try:
            ann = date.fromisoformat(str(anniversary_date))

            def get_anniversary_in_year(base_date, year):
                try:
                    return base_date.replace(year=year)
                except ValueError:
                    return base_date.replace(year=year, day=28)

            this_year_ann = get_anniversary_in_year(ann, today.year)
            last_year_ann = get_anniversary_in_year(ann, today.year - 1)

            # Current cycle started on the most recent anniversary that has passed
            if this_year_ann <= today:
                cycle_start = this_year_ann
                cycle_end = get_anniversary_in_year(ann, today.year + 1)
            else:
                cycle_start = last_year_ann
                cycle_end = this_year_ann

            cycle_start_str = cycle_start.isoformat()
            next_anniversary = cycle_end.isoformat()
        except Exception as e:
            logger.warning("Error parsing/calculating anniversary dates %r: %s", anniversary_date, e)
            cycle_start_str = str(cap_start_date)
            next_anniversary = None

    # Sum COMPANY_DOLLAR_CONTRIBUTION since cycle_start_str
    # This is what the agent has paid toward Local Pro's cap
    commissions_result = supabase.table("bm_commissions") \
        .select("calculated_dollar_amount, bm_transactions(closed_at)") \
        .eq("user_id", user["id"]) \
        .eq("item_type", "COMPANY_DOLLAR_CONTRIBUTION") \
        .execute()

    rows = commissions_result.data or []

    # Filter to current cycle only (closed_at >= cycle_start_str)
    cap_paid = 0.0
    for row in rows:
        txn = row.get("bm_transactions") or {}
        closed_at = txn.get("closed_at")
        if not closed_at:
            continue
        try:
            closed_date = closed_at[:10]  # "YYYY-MM-DD"
            if closed_date >= cycle_start_str:
                amount = row.get("calculated_dollar_amount") or 0
                cap_paid += float(amount)
        except (TypeError, ValueError):
            continue

    # Sum paid credit from revenue share payments in current cycle
    paid_credit_result = supabase.table("revenue_share_payments") \
        .select("credit_amount") \
        .eq("recipient_user_id", user["id"]) \
        .eq("status", "paid") \
        .gte("paid_at", cycle_start_str) \
        .execute()
    
    cap_credit = sum(float(p.get("credit_amount") or 0) for p in paid_credit_result.data) if paid_credit_result.data else 0.0

    # Check for cap override
    override_res = supabase.table("agent_overrides").select("cap_override").eq("user_id", user["id"]).execute()
    cap_override = override_res.data[0].get("cap_override") if override_res.data else None

    cap_paid = round(cap_paid, 2)
    cap_amount_val = float(cap_override) if cap_override is not None else float(cap_amount)
    
    total_cap_paid = round(cap_paid + cap_credit, 2)
    cap_remaining = max(0.0, round(cap_amount_val - total_cap_paid, 2))
    if cap_amount_val == 0.0:
        percent_complete = 100.0
        capped_out = True
    else:
        percent_complete = min(100.0, round((total_cap_paid / cap_amount_val) * 100, 1))
        capped_out = total_cap_paid >= cap_amount_val

    return {
        "has_cap": True,
        "cap_amount": cap_amount_val,
        "cap_paid": total_cap_paid,
        "production_paid": cap_paid,
        "credit_paid": cap_credit,
        "cap_remaining": cap_remaining,
        "percent_complete": percent_complete,
        "capped_out": capped_out,
        "commission_split": u.get("commission_split"),
        "monthly_fee": u.get("monthly_fee"),
        "cap_start_date": cycle_start_str,
        "next_anniversary": next_anniversary,
    }

