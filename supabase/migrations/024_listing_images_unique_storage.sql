-- Migration 024: Add unique index on (listing_id, storage_path)
-- Ensures no duplicate records for the same storage file within a listing,
-- and allows ON CONFLICT (listing_id, storage_path) specifications.

CREATE UNIQUE INDEX IF NOT EXISTS idx_listing_images_listing_storage
ON public.listing_images (listing_id, storage_path);
