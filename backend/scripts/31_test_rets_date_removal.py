# backend/scripts/31_test_rets_date_removal.py
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from services.rets_service import map_rets_to_form

def test_mapping():
    print("=== Testing RETS Date Removal ===")
    
    raw_record = {
        "ListingId": "20439821",
        "PropertySubType": "Single Family Residence",
        "ListPrice": "350000.00",
        "ListingContractDate": "2026-07-01",
        "ExpirationDate": "2026-12-31",
        "YearBuilt": "2015",
        "LivingArea": "2500"
    }
    
    mapped = map_rets_to_form(raw_record)
    print("Mapped Result keys and values:")
    for k, v in sorted(mapped.items()):
        print(f"  {k}: {v}")
        
    # Asserts
    assert "list_date" not in mapped, "ERROR: list_date should NOT be in mapped output"
    assert "expire_date" not in mapped, "ERROR: expire_date should NOT be in mapped output"
    assert mapped.get("list_price") == "350000", "ERROR: list_price mapped incorrectly"
    assert mapped.get("year_built") == "2015", "ERROR: year_built mapped incorrectly"
    
    print("\nSUCCESS! Contract date and Expiration date have been successfully excluded from mapped RETS form data.")

if __name__ == "__main__":
    test_mapping()
