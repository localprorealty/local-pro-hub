import os
import json
import asyncio
from pathlib import Path
from config import get_settings
from supabase import create_client
from services.brokermint_service import update_bm_user_custom_fields

BASELINE_PATH = Path(__file__).parent / "bm_dumps" / "all_users_raw.json"

async def restore_notes():
    settings = get_settings()
    supabase = create_client(*settings.require_supabase())
    
    if not BASELINE_PATH.exists():
        print(f"ERROR: Baseline file not found at {BASELINE_PATH}")
        return
        
    baseline = json.loads(BASELINE_PATH.read_text())
    
    # Filter agents with notes
    agents_to_restore = []
    for u in baseline:
        notes = u.get("Other Notes")
        if notes and notes.strip():
            agents_to_restore.append((u["id"], f"{u.get('first_name','')} {u.get('last_name','')}".strip(), notes))
            
    print(f"Found {len(agents_to_restore)} agents to restore in baseline.\n")
    
    for i, (uid, name, notes) in enumerate(agents_to_restore, start=1):
        print(f"[{i}/{len(agents_to_restore)}] Restoring {name} (ID: {uid}) -> {notes!r}")
        
        retries = 5
        delay = 10.0
        success = False
        while retries > 0:
            try:
                # Update Other Notes while preserving team/Sponsor/Office
                await update_bm_user_custom_fields(str(uid), {"Other Notes": notes})
                success = True
                await asyncio.sleep(0.3)
                break
            except Exception as e:
                err_str = str(e)
                if "429" in err_str:
                    print(f"    Rate limited (429) updating {uid}. Sleeping {delay}s...")
                    await asyncio.sleep(delay)
                    retries -= 1
                    delay *= 1.5
                else:
                    print(f"    Error updating {uid}: {e}")
                    break
        if success:
            print("    Success!")
        else:
            print(f"    Warning: Failed to restore {name}")

if __name__ == "__main__":
    asyncio.run(restore_notes())
