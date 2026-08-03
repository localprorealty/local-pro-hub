import logging
from datetime import date, datetime, timezone
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

LAUNCH_DATE = date(2026, 7, 1)

def get_anniversary_in_year(base_date: date, year: int) -> date:
    """Safe date replacement handling leap years."""
    try:
        return base_date.replace(year=year)
    except ValueError:
        return base_date.replace(year=year, day=28)


def get_cap_cycle_start(anniversary_date: Optional[str], cap_start_date: Optional[str], closed_date: date) -> date:
    """
    Calculates the cap cycle start date for a given transaction closed date.
    Snaps to the most recent past anniversary date.
    """
    if not anniversary_date:
        if cap_start_date:
            try:
                return date.fromisoformat(str(cap_start_date))
            except ValueError:
                pass
        return date(closed_date.year, 1, 1)  # Fallback to Jan 1 of closed year

    try:
        ann = date.fromisoformat(str(anniversary_date))
        this_year_ann = get_anniversary_in_year(ann, closed_date.year)
        
        if this_year_ann <= closed_date:
            return this_year_ann
        else:
            return get_anniversary_in_year(ann, closed_date.year - 1)
    except Exception as e:
        logger.warning("Error calculating cycle start: %s", e)
        if cap_start_date:
            try:
                return date.fromisoformat(str(cap_start_date))
            except ValueError:
                pass
        return date(closed_date.year, 1, 1)


async def check_agent_eligibility(
    supabase,
    user_id: str,
    as_of_date: date,
    settings: Dict[str, Any]
) -> bool:
    """
    Determines if an agent is eligible to receive revenue share payouts as of a given date.
    Logic:
      1. Must be active (role/status active, and not Deana Custer).
      2. If overrides.eligibility_override is set (True/False), use it directly.
      3. Otherwise:
         - Must be within their grace period from registration, OR
         - Must have >= production_min_transactions closed transactions in trailing production_window_months.
      4. Unless overrides.cash_override is True, they must also satisfy:
         - cap_amount (cap_override ?? BrokerMint Goal amount) >= min_cap_amount.
    """
    try:
        # Fetch user details
        user_res = supabase.table("users").select("id, status, email, created_at, cap_amount").eq("id", user_id).single().execute()
        if not user_res.data:
            return False
            
        user = user_res.data
        
        # Hardcode Deana Custer as permanently ineligible
        if (user.get("email") or "").strip().lower() == "deana@localprorealty.com":
            return False
            
        # 1. Must be active
        if user.get("status") != "active":
            return False
            
        # Fetch overrides
        override_res = supabase.table("agent_overrides")\
            .select("cap_override, eligibility_override, cash_override")\
            .eq("user_id", user_id)\
            .execute()
            
        override = override_res.data[0] if override_res.data else {}
        eligibility_override = override.get("eligibility_override")
        cash_override = override.get("cash_override", False)
        
        # 2. Check eligibility override
        if eligibility_override is not None:
            is_eligible = bool(eligibility_override)
        else:
            # Check grace period from registration
            created_at_str = user.get("created_at")
            within_grace = False
            if created_at_str:
                created_date = datetime.fromisoformat(created_at_str.replace("Z", "+00:00")).date()
                months_diff = (as_of_date.year - created_date.year) * 12 + (as_of_date.month - created_date.month)
                if months_diff < settings["grace_period_months"]:
                    within_grace = True
                    
            if within_grace:
                is_eligible = True
            else:
                # Check trailing production
                window_months = settings["production_window_months"]
                min_txns = settings["production_min_transactions"]
                
                # Calculate window start date
                start_month = as_of_date.month - window_months
                start_year = as_of_date.year
                while start_month <= 0:
                    start_month += 12
                    start_year -= 1
                window_start = date(start_year, start_month, 1)
                
                # Query closed transactions for this agent in window
                txns_res = supabase.table("bm_commissions")\
                    .select("id, bm_transactions!inner(closing_date, status)")\
                    .eq("user_id", user_id)\
                    .eq("bm_transactions.status", "closed")\
                    .gte("bm_transactions.closing_date", window_start.isoformat())\
                    .lt("bm_transactions.closing_date", as_of_date.isoformat())\
                    .execute()
                
                # Unique transaction ids
                unique_txns = set(t["bm_transactions"]["closing_date"] for t in txns_res.data if t.get("bm_transactions"))
                is_eligible = len(unique_txns) >= min_txns
                
        # 4. Check cap limit unless cash_override is True
        if not cash_override:
            effective_cap = override.get("cap_override")
            if effective_cap is None:
                effective_cap = user.get("cap_amount")
                
            if effective_cap is None or float(effective_cap) < float(settings["min_cap_amount"]):
                return False
                
        return is_eligible
    except Exception as e:
        logger.error("Error checking agent eligibility for %s: %s", user_id, e)
        return False


async def get_unlock_status(
    supabase,
    sponsor_id: str,
    as_of_date: date,
    generation: int,
    settings: Dict[str, Any]
) -> bool:
    """
    Checks if a sponsor has unlocked a specific generation.
    Gen 1: Always unlocked.
    Gen 2-5: Needs >= configured count of eligible Gen-1 agents.
    """
    if generation == 1:
        return True
        
    unlock_key = f"gen{generation}_unlock_count"
    required_count = settings.get(unlock_key, 25)
    
    # Fetch all directly sponsored users (Gen-1)
    # Check both users.sponsor_id and overrides
    direct_agents_res = supabase.table("users")\
        .select("id, sponsor_id")\
        .execute()
        
    # Join with overrides to find effective sponsors
    overrides_res = supabase.table("agent_overrides").select("user_id, sponsor_override").execute()
    sponsor_overrides = {o["user_id"]: o["sponsor_override"] for o in overrides_res.data} if overrides_res.data else {}
    
    gen1_agent_ids = []
    for u in (direct_agents_res.data or []):
        agent_id = u["id"]
        # Skip self or Tricia
        if agent_id == sponsor_id:
            continue
        effective_sponsor = sponsor_overrides.get(agent_id, u["sponsor_id"])
        if effective_sponsor == sponsor_id:
            gen1_agent_ids.append(agent_id)
            
    # Count how many Gen-1 agents are eligible as of this date
    eligible_count = 0
    for agent_id in gen1_agent_ids:
        is_el = await check_agent_eligibility(supabase, agent_id, as_of_date, settings)
        if is_el:
            eligible_count += 1
            
    return eligible_count >= required_count


async def calculate_running_earnings(
    supabase,
    recipient_id: str,
    contributor_id: str,
    generation: int,
    cap_year_start: date
) -> float:
    """Calculates the sum of already earned payouts for this cap cycle configuration."""
    res = supabase.table("revenue_share_earnings")\
        .select("amount")\
        .eq("recipient_user_id", recipient_id)\
        .eq("contributing_user_id", contributor_id)\
        .eq("generation", generation)\
        .eq("cap_year_start", cap_year_start.isoformat())\
        .execute()
        
    return sum(float(r["amount"] or 0) for r in res.data) if res.data else 0.0


async def revenue_share_earnings_job(supabase, closing_date_from: date = LAUNCH_DATE):
    """
    Idempotent job that processes COMPANY_SPLIT commission items
    on closed transactions to calculate revenue share payouts and completion bonuses.
    """
    logger.info("Running Revenue Share Earnings Job from %s...", closing_date_from)
    
    try:
        # 1. Fetch Global Settings
        settings_res = supabase.table("revenue_share_settings").select("*").order("updated_at", desc=True).limit(1).execute()
        if not settings_res.data:
            logger.error("No revenue share settings found. Aborting job.")
            return
        settings = settings_res.data[0]
        
        # 2. Fetch all closed transactions and their COMPANY_SPLIT commission items
        # Join using PostgREST !inner filter
        comms_res = supabase.table("bm_commissions")\
            .select("id, transaction_id, user_id, calculated_dollar_amount, bm_transactions!inner(id, closing_date, status, closed_at)")\
            .eq("item_type", "COMPANY_SPLIT")\
            .eq("bm_transactions.status", "closed")\
            .gte("bm_transactions.closing_date", closing_date_from.isoformat())\
            .execute()
            
        comms = comms_res.data or []
        logger.info("Found %d COMPANY_SPLIT items to process.", len(comms))
        
        # Fetch all overrides and users for fast caching
        overrides_res = supabase.table("agent_overrides").select("user_id, sponsor_override").execute()
        sponsor_overrides = {o["user_id"]: o["sponsor_override"] for o in overrides_res.data} if overrides_res.data else {}
        
        users_res = supabase.table("users").select("id, sponsor_id, anniversary_date, cap_start_date, cap_amount").execute()
        users_by_id = {u["id"]: u for u in users_res.data} if users_res.data else {}
        
        for comm in comms:
            comm_id = comm["id"]
            txn = comm["bm_transactions"]
            txn_id = txn["id"]
            contributor_id = comm["user_id"]
            company_split = float(comm["calculated_dollar_amount"] or 0)
            
            if not contributor_id or contributor_id not in users_by_id:
                continue
                
            contributor = users_by_id[contributor_id]
            closing_date = date.fromisoformat(txn["closing_date"])
            
            # Calculate cap year start for contributor
            cap_year_start = get_cap_cycle_start(
                contributor.get("anniversary_date"),
                contributor.get("cap_start_date"),
                closing_date
            )
            
            # Walk up the sponsor chain
            current_node_id = contributor_id
            for gen in range(1, 6):
                # Resolve sponsor
                sponsor_override = sponsor_overrides.get(current_node_id)
                u_node = users_by_id.get(current_node_id)
                sponsor_id = sponsor_override or (u_node.get("sponsor_id") if u_node else None)
                
                if not sponsor_id or sponsor_id == current_node_id:
                    # No sponsor or self-sponsor, stop walk
                    break
                    
                # Check eligibility
                is_eligible = await check_agent_eligibility(supabase, sponsor_id, closing_date, settings)
                if is_eligible:
                    # Check unlock status for Gen 2+
                    is_unlocked = await get_unlock_status(supabase, sponsor_id, closing_date, gen, settings)
                    if is_unlocked:
                        rate = float(settings[f"gen{gen}_rate"])
                        max_payout = float(settings[f"gen{gen}_max_payout"])
                        
                        raw_earning = company_split * rate
                        
                        # Calculate already earned this cap year from this contributor
                        already_earned = await calculate_running_earnings(
                            supabase, sponsor_id, contributor_id, gen, cap_year_start
                        )
                        
                        remaining_room = max(0.0, max_payout - already_earned)
                        payout_amount = min(raw_earning, remaining_room)
                        
                        if payout_amount > 0:
                            earning_attrs = {
                                "bm_commission_id": comm_id,
                                "contributing_user_id": contributor_id,
                                "recipient_user_id": sponsor_id,
                                "generation": gen,
                                "rate_applied": rate,
                                "amount": round(payout_amount, 2),
                                "cap_year_start": cap_year_start.isoformat(),
                                "created_at": datetime.now(timezone.utc).isoformat()
                            }
                            # Idempotent upsert by unique constraint (bm_commission_id, recipient_user_id)
                            supabase.table("revenue_share_earnings")\
                                .upsert(earning_attrs, on_conflict="bm_commission_id,recipient_user_id")\
                                .execute()
                                
                # Move to next node in the chain
                current_node_id = sponsor_id
                
            # 3. Check for Completion Bonus
            # Fetch all company splits for contributor in this cap cycle up to this transaction
            splits_res = supabase.table("bm_commissions")\
                .select("calculated_dollar_amount, bm_transactions!inner(closing_date)")\
                .eq("user_id", contributor_id)\
                .eq("item_type", "COMPANY_SPLIT")\
                .gte("bm_transactions.closing_date", cap_year_start.isoformat())\
                .lte("bm_transactions.closing_date", txn["closing_date"])\
                .execute()
                
            total_company_split = sum(float(s["calculated_dollar_amount"] or 0) for s in splits_res.data)
            
            # Fetch contributor's cap amount (checking overrides)
            contributor_override_res = supabase.table("agent_overrides").select("cap_override").eq("user_id", contributor_id).execute()
            contributor_cap = contributor_override_res.data[0].get("cap_override") if contributor_override_res.data else None
            if contributor_cap is None:
                contributor_cap = contributor.get("cap_amount")
                
            if contributor_cap is not None and total_company_split >= float(contributor_cap):
                # Trigger completion bonus walk
                current_node_id = contributor_id
                for gen in range(1, 6):
                    sponsor_override = sponsor_overrides.get(current_node_id)
                    u_node = users_by_id.get(current_node_id)
                    sponsor_id = sponsor_override or (u_node.get("sponsor_id") if u_node else None)
                    
                    if not sponsor_id or sponsor_id == current_node_id:
                        break
                        
                    is_eligible = await check_agent_eligibility(supabase, sponsor_id, closing_date, settings)
                    if is_eligible:
                        bonus_amount = float(settings[f"gen{gen}_completion_bonus"])
                        bonus_attrs = {
                            "contributing_user_id": contributor_id,
                            "recipient_user_id": sponsor_id,
                            "generation": gen,
                            "cap_year_start": cap_year_start.isoformat(),
                            "amount": bonus_amount,
                            "created_at": datetime.now(timezone.utc).isoformat()
                        }
                        # Upsert with unique constraint (contributing_user_id, recipient_user_id, generation, cap_year_start)
                        supabase.table("revenue_share_completion_bonuses")\
                            .upsert(bonus_attrs, on_conflict="contributing_user_id,recipient_user_id,generation,cap_year_start")\
                            .execute()
                            
                    current_node_id = sponsor_id
                    
        logger.info("Revenue Share Earnings Job completed successfully.")
    except Exception as e:
        logger.error("Error running revenue share earnings job: %s", e)


async def sync_agent_revenue_share_to_brokermint(supabase, user_id: str) -> None:
    """
    Computes 'RS Credit Toward Cap' and 'RS Cash Owed' for a given agent
    in their active cap cycle, and writes them to BrokerMint if they changed.
    """
    from services.brokermint_service import update_bm_user_custom_field
    
    # 1. Fetch user profile and check for cache columns compatibility
    has_cache_columns = False
    try:
        user_res = supabase.table("users")\
            .select("id, brokermint_id, cap_amount, cap_start_date, anniversary_date, last_synced_rs_credit, last_synced_rs_cash")\
            .eq("id", user_id)\
            .single()\
            .execute()
        u = user_res.data
        has_cache_columns = True
    except Exception:
        # Fallback if migration hasn't been run yet
        user_res = supabase.table("users")\
            .select("id, brokermint_id, cap_amount, cap_start_date, anniversary_date")\
            .eq("id", user_id)\
            .single()\
            .execute()
        u = user_res.data
        
    if not u or not u.get("brokermint_id"):
        return
        
    bm_id = u["brokermint_id"]
    cap_amount = u.get("cap_amount")
    cap_start_date = u.get("cap_start_date")
    anniversary_date = u.get("anniversary_date")
    
    if cap_amount is None or not cap_start_date:
        # Agent has no cap plan, skip
        return

    # Check for cap override
    override_res = supabase.table("agent_overrides").select("cap_override").eq("user_id", user_id).execute()
    cap_override = override_res.data[0].get("cap_override") if override_res.data else None
    effective_cap = float(cap_override) if cap_override is not None else float(cap_amount)
    
    # Compute active cycle start
    today = date.today()
    cycle_start = get_cap_cycle_start(anniversary_date, cap_start_date, today)
    cycle_start_str = cycle_start.isoformat()
    
    # 2. real_cap_progress = sum of COMPANY_DOLLAR_CONTRIBUTION since cycle_start
    comm_res = supabase.table("bm_commissions")\
        .select("calculated_dollar_amount, bm_transactions!inner(closed_at)")\
        .eq("user_id", user_id)\
        .eq("item_type", "COMPANY_DOLLAR_CONTRIBUTION")\
        .execute()
        
    real_cap_progress = 0.0
    for c in (comm_res.data or []):
        closed_at = c["bm_transactions"]["closed_at"]
        if closed_at and closed_at[:10] >= cycle_start_str:
            real_cap_progress += float(c["calculated_dollar_amount"] or 0.0)
            
    # 3. remaining_room = max(effective_cap - real_cap_progress, 0)
    remaining_room = max(effective_cap - real_cap_progress, 0.0)
    
    # 4. total_rs_earned = sum of earnings + bonuses in this cycle
    # Fetch all earnings for recipient, checking transaction closing date
    earnings_res = supabase.table("revenue_share_earnings")\
        .select("amount, bm_commissions(bm_transactions(closing_date))")\
        .eq("recipient_user_id", user_id)\
        .execute()
    total_earnings = 0.0
    for e in (earnings_res.data or []):
        try:
            closing_date = e["bm_commissions"]["bm_transactions"]["closing_date"]
            if closing_date >= cycle_start_str:
                total_earnings += float(e["amount"] or 0)
        except (KeyError, TypeError):
            pass
            
    bonuses_res = supabase.table("revenue_share_completion_bonuses")\
        .select("amount, created_at")\
        .eq("recipient_user_id", user_id)\
        .execute()
    total_bonuses = 0.0
    for b in (bonuses_res.data or []):
        created_at = b.get("created_at")
        if created_at and created_at[:10] >= cycle_start_str:
            total_bonuses += float(b["amount"] or 0)
            
    total_rs_earned = total_earnings + total_bonuses
    
    # 5. rs_credit_toward_cap = min(total_rs_earned, remaining_room)
    rs_credit_toward_cap = min(total_rs_earned, remaining_room)
    
    # 6. total_rs_paid_cash = sum of cash_amount paid in this cycle
    paid_cash_res = supabase.table("revenue_share_payments")\
        .select("cash_amount")\
        .eq("recipient_user_id", user_id)\
        .eq("status", "paid")\
        .gte("paid_at", cycle_start_str)\
        .execute()
    total_rs_paid_cash = sum(float(p["cash_amount"] or 0) for p in paid_cash_res.data) if paid_cash_res.data else 0.0
    
    # 7. rs_cash_owed = (total_rs_earned - rs_credit_toward_cap) - total_rs_paid_cash
    rs_cash_owed = max(0.0, (total_rs_earned - rs_credit_toward_cap) - total_rs_paid_cash)
    
    # Check if values changed compared to last sync
    target_credit = round(rs_credit_toward_cap, 2)
    target_cash = round(rs_cash_owed, 2)
    
    if has_cache_columns:
        last_credit = float(u.get("last_synced_rs_credit") or 0.0)
        last_cash = float(u.get("last_synced_rs_cash") or 0.0)
        if abs(last_credit - target_credit) < 0.01 and abs(last_cash - target_cash) < 0.01:
            logger.info("Skipping BrokerMint sync for user %s (%s): values unchanged (%s / %s)", user_id, bm_id, target_credit, target_cash)
            return

    # 8. Write both custom fields to BrokerMint
    try:
        from services.brokermint_service import update_bm_user_custom_fields
        fields = {
            "RS Credit Toward Cap": str(target_credit),
            "RS Cash Owed": str(target_cash)
        }
        await update_bm_user_custom_fields(bm_id, fields)
        logger.info(
            "Successfully synced BrokerMint custom fields for user %s (%s): Credit=%s, Cash=%s",
            user_id, bm_id, target_credit, target_cash
        )
        
        # Save to database cache
        if has_cache_columns:
            supabase.table("users")\
                .update({"last_synced_rs_credit": target_credit, "last_synced_rs_cash": target_cash})\
                .eq("id", user_id)\
                .execute()
    except Exception as e:
        logger.error("Error syncing custom fields to BrokerMint for user %s: %s", user_id, e)
        raise e
