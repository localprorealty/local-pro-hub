-- Agent HeyGen avatar fields (Market Yourself)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS heygen_avatar_id text,
  ADD COLUMN IF NOT EXISTS heygen_avatar_group_id text,
  ADD COLUMN IF NOT EXISTS heygen_avatar_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS heygen_avatar_thumbnail_url text;

COMMENT ON COLUMN public.users.heygen_avatar_id IS
  'HeyGen avatar look id — pass as avatar_id to POST /v3/videos';
COMMENT ON COLUMN public.users.heygen_avatar_group_id IS
  'HeyGen avatar group id for training status polling';

-- Storage bucket for avatar training videos (create in dashboard if not exists):
--   Name: agent-avatars
--   Public: true (HeyGen must fetch the training video URL)
