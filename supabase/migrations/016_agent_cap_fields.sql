-- Store cap and split info on users table
-- Populated automatically during BrokerMint sync
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS cap_amount        numeric,
  ADD COLUMN IF NOT EXISTS cap_start_date    date,
  ADD COLUMN IF NOT EXISTS anniversary_date  date,
  ADD COLUMN IF NOT EXISTS commission_split  text,
  ADD COLUMN IF NOT EXISTS monthly_fee       text;
