-- Migration 022: BrokerMint Webhooks & Sync Health
-- 1. Webhook events audit log for idempotency and debugging
CREATE TABLE IF NOT EXISTS bm_webhook_events_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        text UNIQUE NOT NULL,
  event_type      text NOT NULL,
  transaction_id  text,
  payload         jsonb NOT NULL,
  status          text DEFAULT 'processing', -- 'processed', 'skipped', 'failed'
  error_message   text,
  received_at     timestamptz DEFAULT now(),
  processed_at    timestamptz
);

CREATE INDEX IF NOT EXISTS idx_bm_webhook_events_event_id ON bm_webhook_events_log(event_id);
CREATE INDEX IF NOT EXISTS idx_bm_webhook_events_received_at ON bm_webhook_events_log(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_bm_webhook_events_transaction_id ON bm_webhook_events_log(transaction_id);

ALTER TABLE bm_webhook_events_log ENABLE ROW LEVEL SECURITY;

-- Admin can view webhook event logs
CREATE POLICY "admin_webhook_events_log" ON bm_webhook_events_log
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role = 'admin'
      AND status = 'active'
    )
  );

-- 2. Add triggered_by to bm_sync_log ('manual' vs 'cron')
ALTER TABLE bm_sync_log 
  ADD COLUMN IF NOT EXISTS triggered_by text DEFAULT 'manual';

-- 3. Add deleted_at to bm_transactions for soft deletion on transaction.deleted
ALTER TABLE bm_transactions 
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_bm_transactions_deleted_at 
  ON bm_transactions(deleted_at);
