-- 017_revenue_share.sql
-- Migration to introduce Revenue Share (Sponsor Tree) tables and fields

-- 1. Alter users table to support the sponsor relationship
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS sponsor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sponsor_raw text;

-- 2. Create revenue_share_settings table
CREATE TABLE IF NOT EXISTS revenue_share_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  min_cap_amount numeric NOT NULL DEFAULT 16000,
  grace_period_months int NOT NULL DEFAULT 6,
  production_min_transactions int NOT NULL DEFAULT 1,
  production_window_months int NOT NULL DEFAULT 6,
  
  -- Rates are % of the company split commission amount
  gen1_rate numeric NOT NULL DEFAULT 0.1375,
  gen2_rate numeric NOT NULL DEFAULT 0.0531,
  gen3_rate numeric NOT NULL DEFAULT 0.01875,
  gen4_rate numeric NOT NULL DEFAULT 0.01565,
  gen5_rate numeric NOT NULL DEFAULT 0.025,
  
  -- Completion bonuses
  gen1_completion_bonus numeric NOT NULL DEFAULT 1000,
  gen2_completion_bonus numeric NOT NULL DEFAULT 750,
  gen3_completion_bonus numeric NOT NULL DEFAULT 500,
  gen4_completion_bonus numeric NOT NULL DEFAULT 750,
  gen5_completion_bonus numeric NOT NULL DEFAULT 1000,
  
  -- Maximum payout caps
  gen1_max_payout numeric NOT NULL DEFAULT 3200,
  gen2_max_payout numeric NOT NULL DEFAULT 1600,
  gen3_max_payout numeric NOT NULL DEFAULT 800,
  gen4_max_payout numeric NOT NULL DEFAULT 1000,
  gen5_max_payout numeric NOT NULL DEFAULT 1400,
  
  -- Generation unlocks
  gen2_unlock_count int NOT NULL DEFAULT 10,
  gen3_unlock_count int NOT NULL DEFAULT 15,
  gen4_unlock_count int NOT NULL DEFAULT 20,
  gen5_unlock_count int NOT NULL DEFAULT 25,
  
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed exactly one row with defaults
INSERT INTO revenue_share_settings (
  min_cap_amount, grace_period_months, production_min_transactions, production_window_months,
  gen1_rate, gen2_rate, gen3_rate, gen4_rate, gen5_rate,
  gen1_completion_bonus, gen2_completion_bonus, gen3_completion_bonus, gen4_completion_bonus, gen5_completion_bonus,
  gen1_max_payout, gen2_max_payout, gen3_max_payout, gen4_max_payout, gen5_max_payout,
  gen2_unlock_count, gen3_unlock_count, gen4_unlock_count, gen5_unlock_count
) VALUES (
  16000, 6, 1, 6,
  0.1375, 0.0531, 0.01875, 0.01565, 0.025,
  1000, 750, 500, 750, 1000,
  3200, 1600, 800, 1000, 1400,
  10, 15, 20, 25
) ON CONFLICT DO NOTHING;

-- 3. Create agent_overrides table
CREATE TABLE IF NOT EXISTS agent_overrides (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  cap_override numeric,               -- null = use BrokerMint's Goal amount
  eligibility_override boolean,       -- null = use computed rules; true/false forces it
  cash_override boolean NOT NULL DEFAULT false,  -- own field, not tied to can_view_revenue
  sponsor_override uuid REFERENCES users(id) ON DELETE SET NULL,     -- null = use resolved BrokerMint sponsor
  notes text,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Create sponsor_resolution_log table
CREATE TABLE IF NOT EXISTS sponsor_resolution_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  raw_sponsor_text text,
  resolution_status text NOT NULL CHECK (resolution_status in ('unmatched','ambiguous','resolved_to_deana','resolved_manually')),
  resolved_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  candidate_matches jsonb,            -- list of {user_id, name} when ambiguous
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES users(id) ON DELETE SET NULL
);

-- Create unique constraint or index so we don't log duplicate rows for same user
CREATE UNIQUE INDEX IF NOT EXISTS idx_sponsor_res_log_user_id ON sponsor_resolution_log(user_id);

-- 5. Create revenue_share_earnings table
CREATE TABLE IF NOT EXISTS revenue_share_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bm_commission_id uuid NOT NULL REFERENCES bm_commissions(id) ON DELETE CASCADE,
  contributing_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  generation int NOT NULL CHECK (generation between 1 and 5),
  rate_applied numeric NOT NULL,
  amount numeric NOT NULL,
  cap_year_start date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bm_commission_id, recipient_user_id)
);

-- Indexes for calculation lookups
CREATE INDEX IF NOT EXISTS idx_earnings_recipient_user_id ON revenue_share_earnings(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_earnings_contributing_user_id ON revenue_share_earnings(contributing_user_id);
CREATE INDEX IF NOT EXISTS idx_earnings_cap_year_start ON revenue_share_earnings(cap_year_start);

-- 6. Create revenue_share_completion_bonuses table
CREATE TABLE IF NOT EXISTS revenue_share_completion_bonuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contributing_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  generation int NOT NULL CHECK (generation between 1 and 5),
  cap_year_start date NOT NULL,
  amount numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contributing_user_id, recipient_user_id, generation, cap_year_start)
);

-- Indexes for lookup
CREATE INDEX IF NOT EXISTS idx_bonuses_recipient_user_id ON revenue_share_completion_bonuses(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_bonuses_contributing_user_id ON revenue_share_completion_bonuses(contributing_user_id);

-- 7. Create revenue_share_payments table
CREATE TABLE IF NOT EXISTS revenue_share_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_label text NOT NULL,          -- e.g. "Q3 2026"
  cash_amount numeric NOT NULL DEFAULT 0,
  credit_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status in ('pending','paid')),
  paid_at timestamptz,
  paid_by uuid REFERENCES users(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for payment recipients
CREATE INDEX IF NOT EXISTS idx_payments_recipient_user_id ON revenue_share_payments(recipient_user_id);

-- 8. Create revenue_share_payment_contributions table
CREATE TABLE IF NOT EXISTS revenue_share_payment_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES revenue_share_payments(id) ON DELETE CASCADE,
  earning_id uuid REFERENCES revenue_share_earnings(id) ON DELETE CASCADE,
  bonus_id uuid REFERENCES revenue_share_completion_bonuses(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  CHECK (
    (earning_id IS NOT NULL AND bonus_id IS NULL) OR
    (earning_id IS NULL AND bonus_id IS NOT NULL)
  )
);

-- Index
CREATE INDEX IF NOT EXISTS idx_contrib_payment_id ON revenue_share_payment_contributions(payment_id);
CREATE INDEX IF NOT EXISTS idx_contrib_earning_id ON revenue_share_payment_contributions(earning_id);
CREATE INDEX IF NOT EXISTS idx_contrib_bonus_id ON revenue_share_payment_contributions(bonus_id);

-- 9. Row Level Security policies
ALTER TABLE revenue_share_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsor_resolution_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_share_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_share_completion_bonuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_share_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_share_payment_contributions ENABLE ROW LEVEL SECURITY;

-- Admins see everything for all tables
CREATE POLICY "admin_all_settings" ON revenue_share_settings FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin' AND status = 'active')
);
CREATE POLICY "admin_all_overrides" ON agent_overrides FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin' AND status = 'active')
);
CREATE POLICY "admin_all_res_log" ON sponsor_resolution_log FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin' AND status = 'active')
);
CREATE POLICY "admin_all_earnings" ON revenue_share_earnings FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin' AND status = 'active')
);
CREATE POLICY "admin_all_bonuses" ON revenue_share_completion_bonuses FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin' AND status = 'active')
);
CREATE POLICY "admin_all_payments" ON revenue_share_payments FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin' AND status = 'active')
);
CREATE POLICY "admin_all_contributions" ON revenue_share_payment_contributions FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin' AND status = 'active')
);

-- Agents view policies
CREATE POLICY "agent_select_settings" ON revenue_share_settings FOR SELECT USING (true);

-- Agents view own overrides
CREATE POLICY "agent_select_own_overrides" ON agent_overrides FOR SELECT USING (user_id = auth.uid());

-- Agents view own earnings
CREATE POLICY "agent_select_own_earnings" ON revenue_share_earnings FOR SELECT USING (recipient_user_id = auth.uid());

-- Agents view own bonuses
CREATE POLICY "agent_select_own_bonuses" ON revenue_share_completion_bonuses FOR SELECT USING (recipient_user_id = auth.uid());

-- Agents view own payments
CREATE POLICY "agent_select_own_payments" ON revenue_share_payments FOR SELECT USING (recipient_user_id = auth.uid());

-- Agents view own payment contributions
CREATE POLICY "agent_select_own_contributions" ON revenue_share_payment_contributions FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM revenue_share_payments p
    WHERE p.id = payment_id AND p.recipient_user_id = auth.uid()
  )
);
