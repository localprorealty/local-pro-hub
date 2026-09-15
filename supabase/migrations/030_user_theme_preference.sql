-- Migration 030: User theme preference
-- Adds theme_preference ('dark' | 'light') defaulting to 'dark'

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS theme_preference TEXT NOT NULL DEFAULT 'dark'
  CHECK (theme_preference IN ('dark', 'light'));

COMMENT ON COLUMN public.users.theme_preference IS 'User theme preference: dark (default) or light';
