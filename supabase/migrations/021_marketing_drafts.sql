-- Migration to introduce Marketing Asset drafts persistence
CREATE TABLE IF NOT EXISTS public.marketing_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE UNIQUE,
    agent_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    state JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Indexing for lookup speed
CREATE INDEX IF NOT EXISTS idx_marketing_drafts_listing_id ON public.marketing_drafts(listing_id);
CREATE INDEX IF NOT EXISTS idx_marketing_drafts_agent_id ON public.marketing_drafts(agent_id);

-- Enable RLS
ALTER TABLE public.marketing_drafts ENABLE ROW LEVEL SECURITY;

-- Setup RLS policy
CREATE POLICY "Agents can manage their own marketing drafts" ON public.marketing_drafts
    FOR ALL
    USING (auth.uid() = agent_id);

-- Create private storage bucket for marketing draft photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('marketing-drafts', 'marketing-drafts', false)
ON CONFLICT (id) DO NOTHING;
