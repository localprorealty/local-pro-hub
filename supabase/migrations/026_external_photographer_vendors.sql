-- Migration 026: External photographer vendors & email credentials
-- Backlog item #4: External photographer vendor flow

-- 1. Table for agent-managed external vendors (photographers, etc.)
CREATE TABLE IF NOT EXISTS public.agent_vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    vendor_type TEXT NOT NULL DEFAULT 'photographer',
    name TEXT NOT NULL,
    website_url TEXT NULL,
    email TEXT NULL,
    phone TEXT NULL,
    notes TEXT NULL,
    is_default BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_vendors_agent_id ON public.agent_vendors(agent_id);

ALTER TABLE public.agent_vendors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Agents can manage own vendors" ON public.agent_vendors;
CREATE POLICY "Agents can manage own vendors" ON public.agent_vendors
    FOR ALL
    TO authenticated
    USING (agent_id = auth.uid())
    WITH CHECK (agent_id = auth.uid());

-- 2. Table for isolated encrypted email credentials (Gmail App Password)
-- Strictly accessible ONLY by the backend service role.
-- Authenticated users cannot read or query this table directly via PostgREST.
CREATE TABLE IF NOT EXISTS public.agent_email_credentials (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL DEFAULT 'gmail',
    email TEXT NOT NULL,
    encrypted_secret TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.agent_email_credentials ENABLE ROW LEVEL SECURITY;
-- Notice: No policy is defined for authenticated or public roles.
-- PostgREST denies by default when RLS is enabled without matching policies.
-- Only the service_role key (which bypasses RLS) can read/write this table.

-- 3. Add vendor order metadata columns to public.listings
ALTER TABLE public.listings
    ADD COLUMN IF NOT EXISTS vendor_order_placed_at TIMESTAMP WITH TIME ZONE NULL,
    ADD COLUMN IF NOT EXISTS vendor_id UUID NULL REFERENCES public.agent_vendors(id) ON DELETE SET NULL;
