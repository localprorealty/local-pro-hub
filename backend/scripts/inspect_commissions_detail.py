import os
import json
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

def main():
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    res = supabase.table("bm_commissions")\
        .select("id, transaction_id, user_id, bm_payee_id, item_type, calculated_dollar_amount")\
        .eq("item_type", "COMPANY_SPLIT")\
        .limit(5)\
        .execute()
        
    print("=== Sample COMPANY_SPLIT commission items ===")
    print(json.dumps(res.data, indent=2))

if __name__ == "__main__":
    main()
