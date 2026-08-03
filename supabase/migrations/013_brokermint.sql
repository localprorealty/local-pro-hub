-- Rename license_number to brokermint_id on users table
-- and add sync tracking fields
ALTER TABLE users
  RENAME COLUMN license_number TO brokermint_id;

-- brokermint_id stores the BrokerMint integer user ID as text
-- populated automatically during sync by email matching
-- visible to agent in their profile (read-only, admin can edit)

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS brokermint_synced_at timestamptz;

-- Redefine public.handle_new_user() to use the new column name
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested text;
begin
  requested := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'requested_role'), ''),
    'agent'
  );

  if requested not in ('agent', 'admin', 'photographer', 'marketing') then
    requested := 'agent';
  end if;

  insert into public.users (
    id,
    email,
    full_name,
    phone,
    mls_id,
    brokermint_id,
    photographer_tier,
    role,
    status
  )
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    ),
    new.raw_user_meta_data ->> 'phone',
    nullif(trim(new.raw_user_meta_data ->> 'mls_id'), ''),
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'brokermint_id'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'license_number'), '')
    ),
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'photographer_tier'), ''),
      'standard'
    ),
    requested,
    'pending'
  );
  return new;
end;
$$;

-- Transactions synced from BrokerMint
CREATE TABLE IF NOT EXISTS bm_transactions (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bm_id                   text UNIQUE NOT NULL,
  address                 text,
  city                    text,
  state                   text,
  zip                     text,
  mls_number              text,
  price                   numeric,
  status                  text,
  representing            text,
  closing_date            date,
  closed_at               timestamptz,
  raw                     jsonb,
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now()
);

-- Commission line items per transaction per agent
CREATE TABLE IF NOT EXISTS bm_commissions (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id          uuid NOT NULL 
                            REFERENCES bm_transactions(id) ON DELETE CASCADE,
  user_id                 uuid REFERENCES users(id),
  bm_payee_id             text NOT NULL,
  item_type               text,
  award_allocation        numeric,
  split                   numeric,
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now(),
  
  UNIQUE(transaction_id, bm_payee_id, item_type)
);

CREATE INDEX IF NOT EXISTS idx_bm_commissions_user_id
  ON bm_commissions(user_id);
CREATE INDEX IF NOT EXISTS idx_bm_transactions_status
  ON bm_transactions(status);
CREATE INDEX IF NOT EXISTS idx_bm_transactions_closing_date
  ON bm_transactions(closing_date);

-- Sync run log
CREATE TABLE IF NOT EXISTS bm_sync_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at      timestamptz DEFAULT now(),
  finished_at     timestamptz,
  agents_synced   int DEFAULT 0,
  agents_failed   int DEFAULT 0,
  txns_synced     int DEFAULT 0,
  errors          jsonb DEFAULT '[]'::jsonb,
  status          text DEFAULT 'running'
);

-- RLS
ALTER TABLE bm_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bm_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bm_sync_log ENABLE ROW LEVEL SECURITY;

-- Agent sees only their own transactions
CREATE POLICY "agent_own_transactions" ON bm_transactions
  FOR SELECT USING (
    id IN (
      SELECT transaction_id FROM bm_commissions
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "agent_own_commissions" ON bm_commissions
  FOR SELECT USING (user_id = auth.uid());

-- Admin sees everything
CREATE POLICY "admin_all_transactions" ON bm_transactions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role = 'admin'
      AND status = 'active'
    )
  );

CREATE POLICY "admin_all_commissions" ON bm_commissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role = 'admin'
      AND status = 'active'
    )
  );

CREATE POLICY "admin_sync_log" ON bm_sync_log
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role = 'admin'
      AND status = 'active'
    )
  );
