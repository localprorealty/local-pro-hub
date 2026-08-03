-- Add hybrid avatar columns to public.users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS heygen_avatar_type text DEFAULT 'digital_twin',
  ADD COLUMN IF NOT EXISTS heygen_voice_id text,
  ADD COLUMN IF NOT EXISTS heygen_talking_photo_id text;

COMMENT ON COLUMN public.users.heygen_avatar_type IS
  'Type of avatar: digital_twin or talking_photo';
COMMENT ON COLUMN public.users.heygen_voice_id IS
  'HeyGen / ElevenLabs voice id used for rendering';
COMMENT ON COLUMN public.users.heygen_talking_photo_id IS
  'HeyGen talking photo id registered from agent headshot';
