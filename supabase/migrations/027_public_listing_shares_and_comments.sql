-- Migration 027: Public Read-Only Listing Share Links & Feedback Comments
-- Backlog item #9: Public, read-only listing share link (no login required for viewers)

-- 1. Add share token and sharing status columns to public.listings
ALTER TABLE public.listings
    ADD COLUMN IF NOT EXISTS public_share_token TEXT UNIQUE NULL,
    ADD COLUMN IF NOT EXISTS is_publicly_shared BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS public_share_created_at TIMESTAMP WITH TIME ZONE NULL;

-- Index for fast lookup on active shared tokens
CREATE INDEX IF NOT EXISTS idx_listings_public_share_token
ON public.listings(public_share_token)
WHERE is_publicly_shared = true;

-- 2. Create public.listing_comments table for client and visitor feedback
CREATE TABLE IF NOT EXISTS public.listing_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
    commenter_name TEXT NOT NULL,
    comment_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_listing_comments_listing_id
ON public.listing_comments(listing_id, created_at DESC);

-- 3. Row Level Security for listing_comments
ALTER TABLE public.listing_comments ENABLE ROW LEVEL SECURITY;

-- Agents can view comments on their own listings
DROP POLICY IF EXISTS "Agents can view comments on own listings" ON public.listing_comments;
CREATE POLICY "Agents can view comments on own listings" ON public.listing_comments
    FOR SELECT
    TO authenticated
    USING (
        listing_id IN (
            SELECT id FROM public.listings WHERE agent_id = auth.uid()
        )
    );

-- Agents can delete comments on their own listings (moderation)
DROP POLICY IF EXISTS "Agents can delete comments on own listings" ON public.listing_comments;
CREATE POLICY "Agents can delete comments on own listings" ON public.listing_comments
    FOR DELETE
    TO authenticated
    USING (
        listing_id IN (
            SELECT id FROM public.listings WHERE agent_id = auth.uid()
        )
    );

-- CRITICAL SECURITY: Strictly NO INSERT policy for anon or authenticated roles.
-- All comment creation MUST pass through the backend FastAPI endpoint
-- which enforces honeypot checks, IP rate limiting, and string sanitization
-- before persisting via the service-role client.
