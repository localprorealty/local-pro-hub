import sys
from pathlib import Path
import json

# Add backend directory to path
backend_dir = Path(__file__).resolve().parents[1]
if str(backend_dir) not in sys.path:
    sys.path.append(str(backend_dir))

from config import get_settings
from supabase import create_client

def main():
    settings = get_settings()
    supabase = create_client(*settings.require_supabase())
    
    print("=== Step 2: One-Time Migration to sellers Array ===")
    
    # 1. Fetch all listings
    res = supabase.table("listings").select("id, address_full, form_data").execute()
    listings = res.data or []
    
    print(f"\nTotal listings found in Supabase: {len(listings)}")
    
    before_with_old_fields = 0
    before_with_sellers_array = 0
    
    for l in listings:
        fd = l.get("form_data") or {}
        has_old = bool(fd.get("seller_name") or fd.get("seller_email") or fd.get("seller_phone"))
        has_new = "sellers" in fd and isinstance(fd.get("sellers"), list) and len(fd.get("sellers")) > 0
        if has_old:
            before_with_old_fields += 1
        if has_new:
            before_with_sellers_array += 1
            
    print(f"Before Migration Summary:")
    print(f"  Listings with legacy seller fields: {before_with_old_fields}")
    print(f"  Listings with sellers array: {before_with_sellers_array}")
    
    # 2. Perform Migration
    migrated_count = 0
    for l in listings:
        listing_id = l["id"]
        fd = l.get("form_data") or {}
        
        # Extract legacy fields
        seller_name = str(fd.get("seller_name") or "").strip()
        seller_email = str(fd.get("seller_email") or "").strip()
        seller_phone = str(fd.get("seller_phone") or "").strip()
        
        # Build sellers array
        sellers = [{
            "name": seller_name,
            "email": seller_email,
            "phone": seller_phone
        }]
        
        # Update form_data: add sellers array, keeping old fields as safety net
        updated_fd = dict(fd)
        updated_fd["sellers"] = sellers
        
        upd_res = supabase.table("listings").update({"form_data": updated_fd}).eq("id", listing_id).execute()
        if upd_res.data:
            migrated_count += 1
            print(f"  Migrated listing {listing_id} ({l.get('address_full')}): sellers[0] = {sellers[0]}")
            
    print(f"\nMigrated {migrated_count} of {len(listings)} listings.")
    
    # 3. Verify After Migration
    verify_res = supabase.table("listings").select("id, address_full, form_data").execute()
    after_listings = verify_res.data or []
    
    after_with_old_fields = 0
    after_with_sellers_array = 0
    
    print("\nAfter Migration Verification Query:")
    for l in after_listings:
        fd = l.get("form_data") or {}
        has_old = bool(fd.get("seller_name") or fd.get("seller_email") or fd.get("seller_phone"))
        has_new = "sellers" in fd and isinstance(fd.get("sellers"), list) and len(fd.get("sellers")) > 0
        if has_old:
            after_with_old_fields += 1
        if has_new:
            after_with_sellers_array += 1
        print(f"- ID: {l['id']} | Address: {l.get('address_full')}")
        print(f"    sellers: {json.dumps(fd.get('sellers'))}")
        print(f"    retained legacy fields: seller_name={fd.get('seller_name')!r}, seller_email={fd.get('seller_email')!r}, seller_phone={fd.get('seller_phone')!r}")
        
    print(f"\nAfter Migration Summary:")
    print(f"  Total listings: {len(after_listings)}")
    print(f"  Listings with sellers array populated: {after_with_sellers_array} (Expected: {len(after_listings)})")
    print(f"  Listings with legacy seller fields retained: {after_with_old_fields} (Expected: {before_with_old_fields})")
    
    assert after_with_sellers_array == len(after_listings), "Not all listings have sellers array populated!"
    print("\nSUCCESS: All listings now have the sellers array with legacy data retained.")

if __name__ == "__main__":
    main()
