import os
import httpx
import logging
import asyncio
from datetime import datetime
from typing import Optional, AsyncGenerator
from config import get_settings

logger = logging.getLogger(__name__)

BASE_URL = "https://my.brokermint.com/api"


class BrokerMintError(Exception):
    pass


def _api_key() -> str:
    key = get_settings().brokermint_api_key
    if not key:
        raise BrokerMintError("BROKERMINT_API_KEY not set")
    return key


def parse_epoch_ms(value) -> Optional[datetime]:
    """BrokerMint dates are epoch milliseconds (13-digit int)."""
    if not value:
        return None
    try:
        return datetime.fromtimestamp(int(value) / 1000)
    except (ValueError, OSError, TypeError) as e:
        logger.warning("Could not parse BrokerMint date %r: %s", value, e)
        return None


def normalize_status(raw: Optional[str]) -> Optional[str]:
    """Normalize BrokerMint status. Hyphens to underscores, unknown = None."""
    if not raw:
        return None
    normalized = raw.lower().replace("-", "_")
    valid = {
        "pending", "active", "closed", "cancelled",
        "listing", "terminated", "withdrawn", "pre_listing"
    }
    if normalized not in valid:
        logger.warning("Unknown BrokerMint status: %r", raw)
        return None
    return normalized


async def get_all_bm_users() -> list[dict]:
    """Fetch all BrokerMint users. Used for email matching, with robust 429 retries."""
    retries = 5
    delay = 10.0
    while retries > 0:
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.get(
                    f"{BASE_URL}/v1/users",
                    params={"api_key": _api_key(), "full_info": 1}
                )
                if resp.status_code == 429:
                    retry_after = resp.headers.get("retry-after") or resp.headers.get("Retry-After")
                    try:
                        sleep_seconds = float(retry_after) if retry_after else delay
                    except ValueError:
                        sleep_seconds = delay
                    
                    logger.warning("Rate limited (429) fetching all users. Sleep duration: %ss...", sleep_seconds)
                    await asyncio.sleep(sleep_seconds)
                    retries -= 1
                    delay *= 1.5
                    continue
                
                if resp.status_code != 200:
                    raise BrokerMintError(f"Users fetch failed: {resp.status_code}")
                return resp.json() or []
        except Exception as e:
            if hasattr(e, 'response') and e.response.status_code == 429:
                retry_after = e.response.headers.get("retry-after") or e.response.headers.get("Retry-After")
                try:
                    sleep_seconds = float(retry_after) if retry_after else delay
                except ValueError:
                    sleep_seconds = delay
                
                logger.warning("Rate limited (429) fetching all users. Sleep duration: %ss...", sleep_seconds)
                await asyncio.sleep(sleep_seconds)
                retries -= 1
                delay *= 1.5
                continue
            else:
                raise e

    raise BrokerMintError("Failed to fetch all users after exhausting retries.")


async def get_transactions_for_agent(
    bm_user_id: str,
    page_size: int = 100
) -> AsyncGenerator[list[dict], None]:
    """
    Fetch all transactions for one agent using server-side filter.
    Uses confirmed working param: participated_by=User-{id}
    Uses cursor pagination with starting_from_id (never page=N).
    Includes commission items using confirmed param.
    """
    starting_from_id = None
    pages = 0

    async with httpx.AsyncClient(timeout=30) as client:
        while True:
            pages += 1
            if pages > 500:
                logger.error("Exceeded 500 pages for agent %s", bm_user_id)
                break

            params = {
                "api_key": _api_key(),
                "full_info": 1,
                "count": page_size,
                "participated_by": f"User-{bm_user_id}",
                "include": "participants,commission_items",
            }
            if starting_from_id:
                params["starting_from_id"] = starting_from_id

            resp = await client.get(
                f"{BASE_URL}/v2/transactions",
                params=params
            )

            if resp.status_code != 200:
                raise BrokerMintError(
                    f"Transactions fetch failed: {resp.status_code}"
                )

            batch = resp.json() or []
            if not batch:
                break

            yield batch

            if len(batch) < page_size:
                break

            last_id = batch[-1].get("id")
            if not last_id:
                logger.warning("Missing id on last record, stopping pagination")
                break
            starting_from_id = last_id


async def get_bm_user_detail(bm_user_id: str) -> dict:
    """Fetches user details from BrokerMint including relationship fields, with robust 429 retries."""
    retries = 5
    delay = 10.0
    while retries > 0:
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.get(
                    f"{BASE_URL}/v1/users/{bm_user_id}",
                    params={"api_key": _api_key()}
                )
                if resp.status_code == 429:
                    retry_after = resp.headers.get("retry-after") or resp.headers.get("Retry-After")
                    try:
                        sleep_seconds = float(retry_after) if retry_after else delay
                    except ValueError:
                        sleep_seconds = delay
                    
                    logger.warning(
                        "Rate limited (429) fetching user detail for user %s. Sleep duration: %ss...", 
                        bm_user_id, sleep_seconds
                    )
                    await asyncio.sleep(sleep_seconds)
                    retries -= 1
                    delay *= 1.5
                    continue
                
                if resp.status_code != 200:
                    raise BrokerMintError(f"User detail fetch failed: {resp.status_code}")
                return resp.json() or {}
        except Exception as e:
            if hasattr(e, 'response') and e.response.status_code == 429:
                retry_after = e.response.headers.get("retry-after") or e.response.headers.get("Retry-After")
                try:
                    sleep_seconds = float(retry_after) if retry_after else delay
                except ValueError:
                    sleep_seconds = delay
                
                logger.warning(
                    "Rate limited (429) fetching user detail for user %s. Sleep duration: %ss...", 
                    bm_user_id, sleep_seconds
                )
                await asyncio.sleep(sleep_seconds)
                retries -= 1
                delay *= 1.5
                continue
            else:
                raise e

    raise BrokerMintError(f"Failed to fetch user {bm_user_id} detail after exhausting retries.")


async def update_bm_user_custom_field(bm_user_id: str, field_name: str, value: str) -> dict:
    """Updates a single custom field for a user in BrokerMint, preserving team, Sponsor, and Office."""
    return await update_bm_user_custom_fields(bm_user_id, {field_name: value})


async def update_bm_user_custom_fields(bm_user_id: str, fields_dict: dict) -> dict:
    """Updates multiple custom fields for a user in BrokerMint, preserving team, Sponsor, and Office."""
    # Fetch current user details to prevent BrokerMint from clearing team, Sponsor, and Office
    detail = await get_bm_user_detail(bm_user_id)
    
    payload = {**fields_dict}
    for field in ["team", "Sponsor", "Office"]:
        if detail.get(field):
            payload[field] = detail[field]

    retries = 5
    delay = 10.0
    while retries > 0:
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.put(
                    f"{BASE_URL}/v1/users/{bm_user_id}",
                    params={"api_key": _api_key()},
                    json=payload
                )
                if resp.status_code == 429:
                    retry_after = resp.headers.get("retry-after") or resp.headers.get("Retry-After")
                    try:
                        sleep_seconds = float(retry_after) if retry_after else delay
                    except ValueError:
                        sleep_seconds = delay
                    
                    logger.warning(
                        "Rate limited (429) updating custom fields for user %s. Sleep duration: %ss...", 
                        bm_user_id, sleep_seconds
                    )
                    await asyncio.sleep(sleep_seconds)
                    retries -= 1
                    delay *= 1.5
                    continue
                
                if resp.status_code != 200:
                    raise BrokerMintError(f"User update failed: {resp.status_code} - {resp.text}")
                return resp.json() or {}
        except Exception as e:
            # If it's a transient 429 error, we continue the retry loop. For other errors, raise immediately.
            if hasattr(e, 'response') and e.response.status_code == 429:
                retry_after = e.response.headers.get("retry-after") or e.response.headers.get("Retry-After")
                try:
                    sleep_seconds = float(retry_after) if retry_after else delay
                except ValueError:
                    sleep_seconds = delay
                
                logger.warning(
                    "Rate limited (429) updating custom fields for user %s. Sleep duration: %ss...", 
                    bm_user_id, sleep_seconds
                )
                await asyncio.sleep(sleep_seconds)
                retries -= 1
                delay *= 1.5
                continue
            else:
                raise e

    raise BrokerMintError(f"Failed to update user {bm_user_id} custom fields after exhausting retries.")


async def create_bm_transaction(payload: dict) -> dict:
    """Creates a transaction in BrokerMint."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{BASE_URL}/v1/transactions",
            params={"api_key": _api_key()},
            json=payload
        )
        if resp.status_code >= 400:
            raise BrokerMintError(f"Failed to create transaction: {resp.status_code} - {resp.text}")
        return resp.json() or {}


async def create_bm_contact(payload: dict) -> dict:
    """Creates a contact in BrokerMint."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{BASE_URL}/v1/contacts",
            params={"api_key": _api_key()},
            json=payload
        )
        if resp.status_code >= 400:
            raise BrokerMintError(f"Failed to create contact: {resp.status_code} - {resp.text}")
        return resp.json() or {}


async def add_bm_user_participant(txn_id: int, user_id: int, role: str, owner: bool = False) -> dict:
    """Attaches a BrokerMint user participant to a transaction using id key."""
    payload = {"id": user_id, "role": role, "owner": owner}
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{BASE_URL}/v1/transactions/{txn_id}/participants/users",
            params={"api_key": _api_key()},
            json=payload
        )
        if resp.status_code >= 400:
            raise BrokerMintError(f"Failed to attach user participant {user_id}: {resp.status_code} - {resp.text}")
        return resp.json() or {}


async def add_bm_contact_participant(txn_id: int, contact_id: int, role: str) -> dict:
    """Attaches a BrokerMint contact participant to a transaction using id key."""
    payload = {"id": contact_id, "role": role}
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{BASE_URL}/v1/transactions/{txn_id}/participants/contacts",
            params={"api_key": _api_key()},
            json=payload
        )
        if resp.status_code >= 400:
            raise BrokerMintError(f"Failed to attach contact participant {contact_id}: {resp.status_code} - {resp.text}")
        return resp.json() or {}


async def apply_bm_checklist_template(txn_id: int, template_id: int) -> dict:
    """Applies a checklist template to a transaction using checklist_template_id key."""
    payload = {"checklist_template_id": template_id}
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{BASE_URL}/v1/transactions/{txn_id}/checklists",
            params={"api_key": _api_key()},
            json=payload
        )
        if resp.status_code >= 400:
            raise BrokerMintError(f"Failed to apply checklist template {template_id}: {resp.status_code} - {resp.text}")
        return resp.json() or {}

