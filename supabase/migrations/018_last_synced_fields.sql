-- 018_last_synced_fields.sql
-- Add columns to cache the last synced custom fields to optimize BrokerMint write counts
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS last_synced_rs_credit numeric DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS last_synced_rs_cash numeric DEFAULT 0.0;
