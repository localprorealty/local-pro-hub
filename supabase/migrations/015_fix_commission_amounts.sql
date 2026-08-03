-- Add the correct column name matching BrokerMint's actual field
ALTER TABLE bm_commissions
  ADD COLUMN IF NOT EXISTS calculated_dollar_amount numeric;

-- Add payment tracking for Tricia's monthly payment workflow
ALTER TABLE bm_commissions
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_by uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS payment_note text;

-- Index for payment queries
CREATE INDEX IF NOT EXISTS idx_bm_commissions_paid_at
  ON bm_commissions(paid_at);
CREATE INDEX IF NOT EXISTS idx_bm_commissions_item_type
  ON bm_commissions(item_type);

-- Clear existing null commission data so re-sync starts clean
TRUNCATE bm_commissions;
TRUNCATE bm_transactions CASCADE;
-- CASCADE truncates bm_commissions too since it references bm_transactions
