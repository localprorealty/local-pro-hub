import logging
import asyncio
import httpx
from datetime import datetime, timezone
from services.brokermint_service import (
    get_all_bm_users,
    get_bm_user_detail,
    get_transactions_for_agent,
    parse_epoch_ms,
    normalize_status,
    BrokerMintError,
)
from services.revenue_share import revenue_share_earnings_job
from config import get_settings

logger = logging.getLogger(__name__)


def parse_cap_fields(bm_user: dict) -> dict:
    """
    Parse cap-related fields from BrokerMint user record.
    All date fields are epoch milliseconds.
    """
    cap_amount = bm_user.get("Goal amount")
    cap_start_raw = bm_user.get("Cap Start Date")
    anniversary_raw = bm_user.get("anniversary_date")
    commission_split_raw = bm_user.get("Commission Split", "")
    monthly_fee_raw = bm_user.get("Monthly Fee", "$0")

    # Parse cap start date
    cap_start_date = None
    if cap_start_raw:
        dt = parse_epoch_ms(cap_start_raw)
        cap_start_date = dt.date().isoformat() if dt else None

    # Parse anniversary date
    anniversary_date = None
    if anniversary_raw:
        dt = parse_epoch_ms(anniversary_raw)
        anniversary_date = dt.date().isoformat() if dt else None

    # Parse commission split — format: "16000 80/20" or just "80/20"
    # We want the "80/20" portion stored as-is for display
    commission_split = None
    if commission_split_raw:
        parts = str(commission_split_raw).strip().split()
        if parts:
            commission_split = parts[-1]  # "80/20"

    # Clean monthly fee — store as-is ("$150" or "$0")
    monthly_fee = str(monthly_fee_raw).strip() if monthly_fee_raw else "$0"

    return {
        "cap_amount": float(cap_amount) if cap_amount else None,
        "cap_start_date": cap_start_date,
        "anniversary_date": anniversary_date,
        "commission_split": commission_split,
        "monthly_fee": monthly_fee,
    }


async def match_users_by_email(supabase) -> dict:
    """
    Pull all BrokerMint users, match to our users by email,
    update brokermint_id field on each matched user.
    Returns mapping of {email: bm_id} for matched users.
    """
    bm_users = await get_all_bm_users()
    matched = {}
    unmatched = []

    # Fetch all current users from public.users
    res_users = supabase.table("users").select("id, email, brokermint_id, sponsor_raw").execute()
    db_users_by_email = {u["email"].strip().lower(): u for u in res_users.data or [] if u.get("email")}

    for bm_user in bm_users:
        email = (bm_user.get("email") or "").strip().lower()
        bm_id = str(bm_user.get("id") or "")
        if not email or not bm_id:
            continue

        db_user = db_users_by_email.get(email)
        if db_user:
            # If the brokermint_id is already correct, we don't need to do any DB write!
            if str(db_user.get("brokermint_id")) == bm_id:
                matched[email] = bm_id
                continue

        cap_fields = parse_cap_fields(bm_user)

        result = supabase.table("users") \
            .update({
                "brokermint_id": bm_id,
                "brokermint_synced_at": datetime.now(timezone.utc).isoformat(),
                "sponsor_raw": bm_user.get("Sponsor"),
                **cap_fields,
            }) \
            .eq("email", email) \
            .execute()

        if result.data:
            matched[email] = bm_id
            logger.info("Matched %s → BrokerMint ID %s (with cap fields)", email, bm_id)
        else:
            unmatched.append(email)
            logger.warning("No LP Hub user for BrokerMint email: %s", email)

    return {"matched": matched, "unmatched": unmatched}


async def resolve_sponsors(supabase):
    """
    Resolves raw sponsor names from BrokerMint to matched user records.
    Runs after user sync.
    """
    logger.info("Starting sponsor resolution pass...")
    
    try:
        # 1. Fetch all synced users (including current sponsor_id)
        users_resp = supabase.table("users").select("id, full_name, email, sponsor_raw, sponsor_id").execute()
        users = users_resp.data or []
        
        # 2. Fetch all overrides
        overrides_resp = supabase.table("agent_overrides").select("user_id, sponsor_override").execute()
        overrides = {o["user_id"]: o["sponsor_override"] for o in overrides_resp.data} if overrides_resp.data else {}
        
        # Fetch existing resolution logs to avoid redundant writes/deletes
        logs_resp = supabase.table("sponsor_resolution_log").select("user_id, raw_sponsor_text, resolution_status").execute()
        existing_logs = {l["user_id"]: l for l in logs_resp.data or []}
        
        # 3. Build a name map for exact matching (case-insensitive)
        name_map = {}
        for u in users:
            name = (u.get("full_name") or "").strip().lower()
            if name:
                if name not in name_map:
                    name_map[name] = []
                name_map[name].append(u["id"])
                
        # 4. Find Deana Custer's user ID as the fallback default
        deana_id = None
        for u in users:
            if (u.get("email") or "").strip().lower() == "deana@localprorealty.com":
                deana_id = u["id"]
                break
                
        # 5. Resolve sponsor for each user
        for u in users:
            user_id = u["id"]
            raw_sponsor = u.get("sponsor_raw")
            current_sponsor_id = u.get("sponsor_id")
            
            if not raw_sponsor:
                # No sponsor text -> clear resolved sponsor if not already None
                if current_sponsor_id is not None:
                    supabase.table("users").update({"sponsor_id": None}).eq("id", user_id).execute()
                # Clear any unresolved log for this user if exists
                if user_id in existing_logs:
                    supabase.table("sponsor_resolution_log").delete().eq("user_id", user_id).execute()
                continue
                
            sponsor_name = raw_sponsor.strip().lower()
            candidates = name_map.get(sponsor_name, [])
            
            resolved_sponsor_id = None
            status = None
            
            if len(candidates) == 1:
                resolved_sponsor_id = candidates[0]
                # Clean resolution -> delete log if exists
                if user_id in existing_logs:
                    supabase.table("sponsor_resolution_log").delete().eq("user_id", user_id).execute()
            else:
                # Ambiguous (2+) or unmatched (0)
                resolved_sponsor_id = deana_id
                status = "ambiguous" if len(candidates) > 1 else "unmatched"
                
                # Prepare candidates list for logging if ambiguous
                candidate_list = []
                if status == "ambiguous":
                    for cid in candidates:
                        cand_user = next((x for x in users if x["id"] == cid), None)
                        if cand_user:
                            candidate_list.append({"user_id": cid, "name": cand_user["full_name"]})
                    
                # Log resolution issue if changed or new
                existing_log = existing_logs.get(user_id)
                if not existing_log or existing_log.get("raw_sponsor_text") != raw_sponsor or existing_log.get("resolution_status") != status:
                    log_data = {
                        "user_id": user_id,
                        "raw_sponsor_text": raw_sponsor,
                        "resolution_status": status,
                        "resolved_user_id": deana_id,
                        "candidate_matches": candidate_list,
                        "created_at": datetime.now(timezone.utc).isoformat()
                    }
                    supabase.table("sponsor_resolution_log").upsert(log_data, on_conflict="user_id").execute()
                
            # Update users table with resolved sponsor_id (if not overridden and changed)
            if current_sponsor_id != resolved_sponsor_id:
                supabase.table("users").update({"sponsor_id": resolved_sponsor_id}).eq("id", user_id).execute()
                
        logger.info("Sponsor resolution completed.")
    except Exception as e:
        logger.error("Error during sponsor resolution: %s", e)



async def sync_agent(supabase, user_id: str, bm_id: str, email: str) -> dict:
    """
    Sync all transactions + commissions for one agent.
    Called per-agent so failures are isolated.
    """
    txns_synced = 0
    errors = []

    try:
        async for batch in get_transactions_for_agent(bm_id):
            for txn in batch:
                try:
                    await upsert_transaction(supabase, txn, user_id, bm_id)
                    txns_synced += 1
                except Exception as e:
                    errors.append({
                        "bm_transaction_id": txn.get("id"),
                        "address": txn.get("address"),
                        "error": str(e),
                    })
                    logger.error(
                        "Failed to sync txn %s for agent %s: %s",
                        txn.get("id"), email, e
                    )
    except Exception as e:
        errors.append({"error": str(e)})
        logger.error("Failed to sync transactions/commissions for agent %s: %s", email, e)

    return {"txns_synced": txns_synced, "errors": errors}


async def upsert_transaction(
    supabase,
    txn: dict,
    user_id: str,
    bm_id: str
):
    """Upsert one transaction and its commission items for this agent."""
    bm_txn_id = str(txn.get("id") or "")
    if not bm_txn_id:
        raise ValueError("Transaction missing id")

    closing_dt = parse_epoch_ms(txn.get("closing_date"))
    closed_dt = parse_epoch_ms(txn.get("closed_at"))

    txn_attrs = {
        "bm_id": bm_txn_id,
        "address": txn.get("address"),
        "city": txn.get("city"),
        "state": txn.get("state"),
        "zip": txn.get("zip"),
        "mls_number": txn.get("MLS #") or txn.get("mls_id"),
        "price": txn.get("price"),
        "status": normalize_status(txn.get("status")),
        "representing": txn.get("representing"),
        "closing_date": closing_dt.date().isoformat() if closing_dt else None,
        "closed_at": closed_dt.isoformat() if closed_dt else None,
        "raw": txn,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    # Upsert transaction (insert or update by bm_id)
    existing = supabase.table("bm_transactions") \
        .select("id") \
        .eq("bm_id", bm_txn_id) \
        .execute()

    if existing.data:
        txn_row_id = existing.data[0]["id"]
        supabase.table("bm_transactions") \
            .update(txn_attrs) \
            .eq("id", txn_row_id) \
            .execute()
    else:
        result = supabase.table("bm_transactions") \
            .insert(txn_attrs) \
            .execute()
        txn_row_id = result.data[0]["id"]

    # Upsert commission items for this agent only
    commission_items = txn.get("commission_items") or []
    bm_id_str = str(bm_id)

    for item in commission_items:
        payee_id = str(item.get("payee_id") or "")
        payee_type = item.get("payee_type", "")

        # Only store commission items for this specific agent
        # Skip account-level items (payee_type = "Account")
        if payee_id != bm_id_str or payee_type != "User":
            continue

        item_attrs = {
            "transaction_id": txn_row_id,
            "user_id": user_id,
            "bm_payee_id": payee_id,
            "item_type": item.get("item_type"),
            "calculated_dollar_amount": item.get("calculated_dollar_amount"),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

        # Upsert by unique constraint (transaction_id, bm_payee_id, item_type)
        supabase.table("bm_commissions") \
            .upsert(item_attrs, on_conflict="transaction_id,bm_payee_id,item_type") \
            .execute()


async def run_full_sync(supabase) -> dict:
    """
    Optimized company-wide sync:
    1. Match all users by email → populate brokermint_id
    2. Build mapping of {brokermint_id: user_uuid}
    3. Fetch all company transactions (paginated, 100/page)
    4. Upsert transactions and user commission items in batches
    5. Resolve sponsors
    6. Run revenue share calculations
    """
    log_id = None
    agents_synced = 0
    agents_failed = 0
    total_txns = 0
    all_errors = []
    final_status = "failed"

    def update_progress(step_text: str, txns: int = 0, agents: int = 0, failed: int = 0):
        progress_dict = {"progress": step_text}
        filtered_errors = [e for e in all_errors if not isinstance(e, dict) or "progress" not in e]
        updated_errors = [progress_dict] + filtered_errors
        if log_id:
            try:
                supabase.table("bm_sync_log") \
                    .update({
                        "agents_synced": agents,
                        "agents_failed": failed,
                        "txns_synced": txns,
                        "errors": updated_errors[:50],
                    }) \
                    .eq("id", log_id) \
                    .execute()
            except Exception as err:
                logger.error("Failed to update progress: %s", err)

    try:
        log = supabase.table("bm_sync_log") \
            .insert({"status": "running", "errors": [{"progress": "Initializing sync..."}]}) \
            .execute()
        log_id = log.data[0]["id"]

        # Step 1: match users
        update_progress("Step 1/4: Matching user profiles...")
        match_result = await match_users_by_email(supabase)
        matched = match_result["matched"]  # {email: bm_id}

        # Build mapping of BrokerMint ID to public.users.id
        res_users = supabase.table("users").select("id, brokermint_id").neq("brokermint_id", "null").execute()
        bm_id_to_user_uuid = {str(r["brokermint_id"]): r["id"] for r in res_users.data or []}

        # Count matched agents
        agents_synced = len(bm_id_to_user_uuid)

        # Step 2: Fetch and upsert all company transactions
        update_progress("Step 2/4: Fetching transaction list from BrokerMint...", txns=0, agents=agents_synced)

        api_key = get_settings().brokermint_api_key
        if not api_key:
            raise ValueError("BROKERMINT_API_KEY is not configured")

        starting_from_id = None
        pages = 0
        page_size = 100

        while True:
            pages += 1
            update_progress(f"Step 2/4: Downloading transactions (page {pages})...", txns=total_txns, agents=agents_synced)

            params = {
                "api_key": api_key,
                "full_info": 1,
                "count": page_size,
                "include": "participants,commission_items",
            }
            if starting_from_id:
                params["starting_from_id"] = starting_from_id

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.get(
                    "https://my.brokermint.com/api/v2/transactions",
                    params=params
                )

            if resp.status_code != 200:
                raise BrokerMintError(f"BrokerMint transactions API failed with status {resp.status_code}")

            batch = resp.json() or []
            if not batch:
                break

            # Process batch of transactions
            txn_batch_attrs = []
            for txn in batch:
                bm_txn_id = str(txn.get("id") or "")
                if not bm_txn_id:
                    continue
                closing_dt = parse_epoch_ms(txn.get("closing_date"))
                closed_dt = parse_epoch_ms(txn.get("closed_at"))

                # Sanity ceiling check: check for fat-finger values > $10M
                price_val = 0.0
                try:
                    price_val = float(txn.get("price") or 0.0)
                except Exception:
                    pass

                if price_val > 10000000.0:
                    logger.warning(
                        "Sanity check triggered: Transaction %s has price $%s exceeding ceiling of $10M. Skipping commission parsing.",
                        bm_txn_id, price_val
                    )
                    txn["commission_items"] = []

                txn_batch_attrs.append({
                    "bm_id": bm_txn_id,
                    "address": txn.get("address"),
                    "city": txn.get("city"),
                    "state": txn.get("state"),
                    "zip": txn.get("zip"),
                    "mls_number": txn.get("MLS #") or txn.get("mls_id"),
                    "price": txn.get("price"),
                    "status": normalize_status(txn.get("status")),
                    "representing": txn.get("representing"),
                    "closing_date": closing_dt.date().isoformat() if closing_dt else None,
                    "closed_at": closed_dt.isoformat() if closed_dt else None,
                    "raw": txn,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                })

            # Upsert transaction records
            if txn_batch_attrs:
                res_txns = supabase.table("bm_transactions").upsert(txn_batch_attrs, on_conflict="bm_id").execute()
                bm_txn_id_to_uuid = {r["bm_id"]: r["id"] for r in res_txns.data or []}

                # Check for listings associated with these BrokerMint transactions
                batch_bm_ids = [txn["bm_id"] for txn in txn_batch_attrs]
                listings_res = supabase.table("listings") \
                    .select("id, stage, brokermint_transaction_id") \
                    .in_("brokermint_transaction_id", batch_bm_ids) \
                    .execute()
                    
                for listing in (listings_res.data or []):
                    bm_txn_id = listing.get("brokermint_transaction_id")
                    txn_data = next((t for t in txn_batch_attrs if t["bm_id"] == bm_txn_id), None)
                    if txn_data and txn_data["status"] == "closed" and listing["stage"] != "closed":
                        logger.info("Auto-advancing listing %s to 'closed' stage due to closed BrokerMint transaction %s", listing["id"], bm_txn_id)
                        supabase.table("listings").update({"stage": "closed"}).eq("id", listing["id"]).execute()

                # Construct commission items (deduplicated by key)
                comm_map = {}
                for txn in batch:
                    txn_uuid = bm_txn_id_to_uuid.get(str(txn.get("id")))
                    if not txn_uuid:
                        continue

                    for item in txn.get("commission_items") or []:
                        payee_id = str(item.get("payee_id") or "")
                        payee_type = item.get("payee_type", "")
                        if payee_type != "User":
                            continue

                        user_uuid = bm_id_to_user_uuid.get(payee_id)
                        if not user_uuid:
                            continue

                        item_type = item.get("item_type")
                        key = (txn_uuid, payee_id, item_type)
                        amount = float(item.get("calculated_dollar_amount") or 0.0)

                        if amount > 10000000.0:
                            logger.warning(
                                "Sanity check triggered: Commission item in txn %s has amount $%s exceeding ceiling of $10M. Skipping item.",
                                txn.get("id"), amount
                            )
                            continue

                        if key in comm_map:
                            comm_map[key]["calculated_dollar_amount"] += amount
                        else:
                            comm_map[key] = {
                                "transaction_id": txn_uuid,
                                "user_id": user_uuid,
                                "bm_payee_id": payee_id,
                                "item_type": item_type,
                                "calculated_dollar_amount": amount,
                                "updated_at": datetime.now(timezone.utc).isoformat(),
                            }

                comm_batch_attrs = list(comm_map.values())

                # Upsert commissions
                if comm_batch_attrs:
                    supabase.table("bm_commissions").upsert(comm_batch_attrs, on_conflict="transaction_id,bm_payee_id,item_type").execute()

            total_txns += len(batch)

            if len(batch) < page_size:
                break

            starting_from_id = batch[-1]["id"]
            # Small delay between pages to be gentle on BrokerMint
            await asyncio.sleep(0.3)

        # Step 3: Resolve sponsors
        update_progress("Step 3/4: Resolving sponsor network relationships...", txns=total_txns, agents=agents_synced)
        await resolve_sponsors(supabase)

        # Step 4: Run Revenue Share Earnings Job & sync back to BrokerMint
        update_progress("Step 4/4: Calculating revenue share earnings and syncing to BrokerMint...", txns=total_txns, agents=agents_synced)
        try:
            await revenue_share_earnings_job(supabase)
            
            # Sync new custom fields to BrokerMint for all agents
            logger.info("Syncing new Revenue Share custom fields to BrokerMint for all agents...")
            from services.revenue_share import sync_agent_revenue_share_to_brokermint
            user_ids_res = supabase.table("users").select("id").execute()
            for row in (user_ids_res.data or []):
                try:
                    await sync_agent_revenue_share_to_brokermint(supabase, row["id"])
                except Exception as e:
                    logger.error("Failed to sync custom fields to BrokerMint for user %s: %s", row["id"], e)
                    all_errors.append({"error": f"Failed to sync custom fields for user {row['id']}: {str(e)}"})
                await asyncio.sleep(0.1) # Be gentle on rate limits
        except Exception as e:
            logger.error("Failed to run revenue share earnings job after sync: %s", e)
            all_errors.append({"error": f"Revenue Share Job failed: {str(e)}"})

        final_status = "success" if agents_failed == 0 and not any("Revenue Share Job failed" in str(err.get("error", "")) for err in all_errors) else "completed_with_errors"

    except Exception as e:
        final_status = "failed"
        all_errors.append({"error": str(e)})
        logger.error("Full sync failed: %s", e)
    finally:
        # Clear progress dict on finish
        filtered_errors = [e for e in all_errors if not isinstance(e, dict) or "progress" not in e]
        if log_id:
            try:
                supabase.table("bm_sync_log") \
                    .update({
                        "finished_at": datetime.now(timezone.utc).isoformat(),
                        "agents_synced": agents_synced,
                        "agents_failed": agents_failed,
                        "txns_synced": total_txns,
                        "errors": filtered_errors[:50],
                        "status": final_status,
                    }) \
                    .eq("id", log_id) \
                    .execute()
            except Exception as update_err:
                logger.error("Failed to update bm_sync_log status: %s", update_err)

    return {
        "agents_synced": agents_synced,
        "agents_failed": agents_failed,
        "txns_synced": total_txns,
        "errors": all_errors,
        "status": final_status,
    }
