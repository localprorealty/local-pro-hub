-- Migration: Create listing_images table and listing-images storage bucket
CREATE TABLE IF NOT EXISTS public.listing_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    public_url TEXT NOT NULL,
    image_type TEXT NOT NULL DEFAULT 'gallery',  -- 'gallery' | 'headshot' | 'floorplan'
    category TEXT NOT NULL DEFAULT 'other',      -- 'hero' | 'living_room' | 'kitchen' | 'dining' | 'master_bedroom' | 'pool' | 'agent_headshot' | etc.
    caption TEXT NULL,                          -- Per-photo description / room caption
    is_hero BOOLEAN NOT NULL DEFAULT false,     -- Indicates primary listing cover photo
    sort_order INTEGER NOT NULL DEFAULT 0,      -- Custom display ordering
    file_size_bytes BIGINT NULL,
    width INTEGER NULL,
    height INTEGER NULL,
    mime_type TEXT NOT NULL DEFAULT 'image/webp',
    uploaded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Rapid lookup and sorting indexes
CREATE INDEX IF NOT EXISTS idx_listing_images_listing_id ON public.listing_images(listing_id);
CREATE INDEX IF NOT EXISTS idx_listing_images_sort ON public.listing_images(listing_id, sort_order ASC);
CREATE INDEX IF NOT EXISTS idx_listing_images_type ON public.listing_images(listing_id, image_type);

-- Partial unique index: guarantees at most ONE hero image per listing at the database level
CREATE UNIQUE INDEX IF NOT EXISTS idx_listing_images_single_hero
ON public.listing_images (listing_id)
WHERE (is_hero = true);

-- Row Level Security
ALTER TABLE public.listing_images ENABLE ROW LEVEL SECURITY;

-- Scoped to authenticated users only (prevents unauthenticated scraping of image metadata)
DROP POLICY IF EXISTS "Authenticated users can view listing images" ON public.listing_images;
CREATE POLICY "Authenticated users can view listing images" ON public.listing_images
    FOR SELECT
    TO authenticated
    USING (true);

-- Agents can manage images on their own listings; admins have full access
DROP POLICY IF EXISTS "Agents can manage their own listing images" ON public.listing_images;
CREATE POLICY "Agents can manage their own listing images" ON public.listing_images
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.listings l
            WHERE l.id = listing_id AND (l.agent_id = auth.uid() OR auth.jwt() ->> 'role' = 'service_role')
        )
    );

-- Create public storage bucket for listing images
INSERT INTO storage.buckets (id, name, public)
VALUES ('listing-images', 'listing-images', true)
ON CONFLICT (id) DO NOTHING;
