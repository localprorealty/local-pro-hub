-- Migration 028: Add read_at timestamp to listing_comments and RLS update policy for agents
-- Backlog item #13: Notification indicator for visitor comments on public listing shares

-- 1. Add read_at column to public.listing_comments
ALTER TABLE public.listing_comments
    ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE NULL;

-- 2. Create index on unread comments per listing
CREATE INDEX IF NOT EXISTS idx_listing_comments_unread
ON public.listing_comments(listing_id, created_at DESC)
WHERE read_at IS NULL;

-- 3. RLS policy to allow agents to mark comments as read on their own listings
DROP POLICY IF EXISTS "Agents can mark comments read on own listings" ON public.listing_comments;
CREATE POLICY "Agents can mark comments read on own listings" ON public.listing_comments
    FOR UPDATE
    TO authenticated
    USING (
        listing_id IN (
            SELECT id FROM public.listings WHERE agent_id = auth.uid()
        )
    )
    WITH CHECK (
        listing_id IN (
            SELECT id FROM public.listings WHERE agent_id = auth.uid()
        )
    );
