-- Migration 025: Add agent branding columns to public.users and register storage bucket
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS brand_logo_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS brand_color_primary TEXT NULL,
  ADD COLUMN IF NOT EXISTS brand_color_secondary TEXT NULL;

-- Create public storage bucket for agent branding/logos if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('agent-branding', 'agent-branding', true)
ON CONFLICT (id) DO NOTHING;

-- RLS: Authenticated users can manage branding objects in their own folder
DROP POLICY IF EXISTS "Agents can manage own branding files" ON storage.objects;
CREATE POLICY "Agents can manage own branding files" ON storage.objects
  FOR ALL
  TO authenticated
  USING (bucket_id = 'agent-branding' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'agent-branding' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Public read access for agent branding
DROP POLICY IF EXISTS "Public read access for agent branding" ON storage.objects;
CREATE POLICY "Public read access for agent branding" ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'agent-branding');
