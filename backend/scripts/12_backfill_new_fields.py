import os
import asyncio
import httpx
from datetime import date
from config import get_settings
from supabase import create_client
from services.revenue_share import get_cap_cycle_start
from services.brokermint_service import get_bm_user_detail, _api_key, BASE_URL

async def update_bm_user_custom_fields(bm_user_id: str, fields_dict: dict) -> dict:
    """Updates multiple custom fields for a user in BrokerMint, preserving team, Sponsor, and Office."""
    detail = await get_bm_user_detail(bm_user_id)
    
    payload = {**fields_dict}
    for field in ["team", "Sponsor", "Office"]:
        if detail.get(field):
            payload[field] = detail[field]

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.put(
            f"{BASE_URL}/v1/users/{bm_user_id}",
            params={"api_key": _api_key()},
            json=payload
        )
        resp.raise_for_status()
        return resp.json() or {}

async def safe_write_fields(bm_id: str, credit: float, cash: float):
    retries = 5
    delay = 10.0
    while retries > 0:
        try:
            fields = {
                "RS Credit Toward Cap": str(round(credit, 2)),
                "RS Cash Owed": str(round(cash, 2))
            }
            await update_bm_user_custom_fields(bm_id, fields)
            return True
        except Exception as e:
            err_str = str(e)
            if "429" in err_str:
                print(f"    Rate limited (429) updating {bm_id}. Sleeping {delay}s...")
                await asyncio.sleep(delay)
                retries -= 1
                delay *= 1.5  # exponential backoff
            else:
                print(f"    Error updating {bm_id}: {e}")
                return False
    print(f"    Failed to update {bm_id} after retries.")
    return False

async def main():
    settings = get_settings()
    supabase = create_client(*settings.require_supabase())
    
    # Dynamically find recipient IDs with active earnings or bonuses
    earnings_res = supabase.table("revenue_share_earnings").select("recipient_user_id").execute()
    bonuses_res = supabase.table("revenue_share_completion_bonuses").select("recipient_user_id").execute()
    recipients = set(e["recipient_user_id"] for e in (earnings_res.data or [])) | set(b["recipient_user_id"] for b in (bonuses_res.data or []))
    
    print(f"Found {len(recipients)} agents with active revenue share earnings/bonuses.")
    
    # Fetch profiles for these recipients
    users_res = supabase.table("users").select("id, full_name, brokermint_id, cap_amount, cap_start_date, anniversary_date").in_("id", list(recipients)).execute()
    agents = [u for u in users_res.data if u.get("brokermint_id")]
    print(f"Loaded {len(agents)} agents for custom field calculations.\n")
    
    for i, agent in enumerate(agents, start=1):
        uid = agent["id"]
        name = agent["full_name"]
        bm_id = agent["brokermint_id"]
        cap_amount = agent.get("cap_amount")
        cap_start_date = agent.get("cap_start_date")
        anniversary_date = agent.get("anniversary_date")
        
        if cap_amount is None or not cap_start_date:
            continue
            
        print(f"[{i}/{len(agents)}] Processing {name}...")
        
        retries = 3
        success = False
        while retries > 0:
            try:
                # Compute active cycle start
                today = date.today()
                cycle_start = get_cap_cycle_start(anniversary_date, cap_start_date, today)
                cycle_start_str = cycle_start.isoformat()
                
                # Check overrides
                override_res = supabase.table("agent_overrides").select("cap_override").eq("user_id", uid).execute()
                cap_override = override_res.data[0].get("cap_override") if override_res.data else None
                effective_cap = float(cap_override) if cap_override is not None else float(cap_amount)
                
                # Calculate real cap progress
                comm_res = supabase.table("bm_commissions")\
                    .select("calculated_dollar_amount, bm_transactions!inner(closed_at)")\
                    .eq("user_id", uid)\
                    .eq("item_type", "COMPANY_DOLLAR_CONTRIBUTION")\
                    .execute()
                    
                real_cap_progress = 0.0
                for c in (comm_res.data or []):
                    closed_at = c["bm_transactions"]["closed_at"]
                    if closed_at and closed_at[:10] >= cycle_start_str:
                        real_cap_progress += float(c["calculated_dollar_amount"] or 0.0)
                        
                remaining_room = max(effective_cap - real_cap_progress, 0.0)
                
                # Calculate total rs earned
                earnings_res = supabase.table("revenue_share_earnings")\
                    .select("amount, bm_commissions(bm_transactions(closing_date))")\
                    .eq("recipient_user_id", uid)\
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
                    .eq("recipient_user_id", uid)\
                    .execute()
                total_bonuses = 0.0
                for b in (bonuses_res.data or []):
                    created_at = b.get("created_at")
                    if created_at and created_at[:10] >= cycle_start_str:
                        total_bonuses += float(b["amount"] or 0)
                        
                total_rs_earned = total_earnings + total_bonuses
                rs_credit_toward_cap = min(total_rs_earned, remaining_room)
                
                # Calculate paid cash in this cycle
                paid_cash_res = supabase.table("revenue_share_payments")\
                    .select("cash_amount")\
                    .eq("recipient_user_id", uid)\
                    .eq("status", "paid")\
                    .gte("paid_at", cycle_start_str)\
                    .execute()
                total_rs_paid_cash = sum(float(p["cash_amount"] or 0) for p in paid_cash_res.data) if paid_cash_res.data else 0.0
                
                rs_cash_owed = max(0.0, (total_rs_earned - rs_credit_toward_cap) - total_rs_paid_cash)
                
                # Write to BrokerMint
                print(f"    Pushing {name}: Credit={rs_credit_toward_cap}, Cash={rs_cash_owed}")
                write_success = await safe_write_fields(bm_id, rs_credit_toward_cap, rs_cash_owed)
                if write_success:
                    success = True
                    break
                else:
                    retries -= 1
                    await asyncio.sleep(5.0)
            except Exception as e:
                print(f"    Error processing {name}: {e}. Retrying in 10s...")
                await asyncio.sleep(10.0)
                retries -= 1
                
        if not success:
            print(f"    Warning: Failed to update {name}")

if __name__ == "__main__":
    asyncio.run(main())
