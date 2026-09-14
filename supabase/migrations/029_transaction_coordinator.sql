-- Migration 029: Transaction Coordinator (TC) Role, Attribution & RLS Policies
-- Backlog item #18: Adds 'transaction_coordinator' role, cross-agent listing access,
-- agent-picker listing creation, and full audit attribution.

-- 1. Update public.users.role check constraint
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('agent', 'admin', 'photographer', 'marketing', 'transaction_coordinator'));

-- 2. Update public.handle_new_user() to accept transaction_coordinator in requested_role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested text;
BEGIN
  requested := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'requested_role'), ''),
    'agent'
  );

  IF requested NOT IN ('agent', 'admin', 'photographer', 'marketing', 'transaction_coordinator') THEN
    requested := 'agent';
  END IF;

  INSERT INTO public.users (
    id,
    email,
    full_name,
    phone,
    mls_id,
    brokermint_id,
    photographer_tier,
    role,
    status
  )
  VALUES (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    ),
    new.raw_user_meta_data ->> 'phone',
    nullif(trim(new.raw_user_meta_data ->> 'mls_id'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'brokermint_id'), ''),
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'photographer_tier'), ''),
      'standard'
    ),
    requested,
    'pending'
  );
  RETURN new;
END;
$$;

-- 3. Add attribution columns to public.listings
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_listings_created_by ON public.listings(created_by);
CREATE INDEX IF NOT EXISTS idx_listings_updated_by ON public.listings(updated_by);

-- 4. Create listing_activity_logs table for audit attribution
CREATE TABLE IF NOT EXISTS public.listing_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_listing_activity_listing_id ON public.listing_activity_logs(listing_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listing_activity_actor ON public.listing_activity_logs(actor_id);

ALTER TABLE public.listing_activity_logs ENABLE ROW LEVEL SECURITY;

-- 5. Helper functions for role authorization
CREATE OR REPLACE FUNCTION public.is_admin_or_tc()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('admin', 'transaction_coordinator')
      AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_tc()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role = 'transaction_coordinator'
      AND status = 'active'
  );
$$;

-- 6. Additive RLS Policies for listings
-- Note: Existing agent policies (listings_select_own, listings_insert_own, listings_update_own, listings_delete_own_draft)
-- remain untouched, preserving strict agent-to-agent isolation.

DROP POLICY IF EXISTS "listings_select_tc" ON public.listings;
CREATE POLICY "listings_select_tc"
ON public.listings FOR SELECT
USING (public.is_admin_or_tc());

DROP POLICY IF EXISTS "listings_insert_admin_or_tc" ON public.listings;
CREATE POLICY "listings_insert_admin_or_tc"
ON public.listings FOR INSERT
WITH CHECK (public.is_admin_or_tc());

DROP POLICY IF EXISTS "listings_update_tc" ON public.listings;
CREATE POLICY "listings_update_tc"
ON public.listings FOR UPDATE
USING (public.is_admin_or_tc());

-- Option A: TC can delete any brokerage draft (stage = 'draft')
DROP POLICY IF EXISTS "listings_delete_admin_or_tc" ON public.listings;
CREATE POLICY "listings_delete_admin_or_tc"
ON public.listings FOR DELETE
USING (public.is_admin_or_tc() AND stage = 'draft');

-- 7. RLS on public.users: Allow TC to query active agents, and allow agents to view coordinators and listing creators
DROP POLICY IF EXISTS "users_select_tc_roster" ON public.users;
CREATE POLICY "users_select_tc_roster"
ON public.users FOR SELECT
USING (
  public.is_admin_or_tc()
  OR role IN ('admin', 'transaction_coordinator')
  OR EXISTS (
    SELECT 1 FROM public.listings l
    WHERE l.agent_id = auth.uid()
      AND (l.created_by = users.id OR l.updated_by = users.id)
  )
);

-- 8. RLS on listing_activity_logs
DROP POLICY IF EXISTS "listing_activity_logs_select" ON public.listing_activity_logs;
CREATE POLICY "listing_activity_logs_select"
ON public.listing_activity_logs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.listings l
    WHERE l.id = listing_id AND (l.agent_id = auth.uid() OR public.is_admin_or_tc())
  )
);

DROP POLICY IF EXISTS "listing_activity_logs_insert" ON public.listing_activity_logs;
CREATE POLICY "listing_activity_logs_insert"
ON public.listing_activity_logs FOR INSERT
WITH CHECK (
  auth.uid() = actor_id AND (
    EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = listing_id AND (l.agent_id = auth.uid() OR public.is_admin_or_tc())
    )
  )
);

-- 9. Additive RLS Policies on associated listing tables for TC
-- documents
DROP POLICY IF EXISTS "documents_tc_access" ON public.documents;
CREATE POLICY "documents_tc_access"
ON public.documents FOR ALL
USING (public.is_admin_or_tc());

-- bookings
DROP POLICY IF EXISTS "bookings_tc_select" ON public.bookings;
CREATE POLICY "bookings_tc_select"
ON public.bookings FOR SELECT
USING (public.is_admin_or_tc());

DROP POLICY IF EXISTS "bookings_tc_insert" ON public.bookings;
CREATE POLICY "bookings_tc_insert"
ON public.bookings FOR INSERT
WITH CHECK (public.is_admin_or_tc());

DROP POLICY IF EXISTS "bookings_tc_update" ON public.bookings;
CREATE POLICY "bookings_tc_update"
ON public.bookings FOR UPDATE
USING (public.is_admin_or_tc());

-- marketing_requests
DROP POLICY IF EXISTS "marketing_requests_tc" ON public.marketing_requests;
CREATE POLICY "marketing_requests_tc"
ON public.marketing_requests FOR ALL
USING (public.is_admin_or_tc());

-- marketing_drafts
DROP POLICY IF EXISTS "marketing_drafts_tc" ON public.marketing_drafts;
CREATE POLICY "marketing_drafts_tc"
ON public.marketing_drafts FOR ALL
USING (public.is_admin_or_tc());

-- listing_images
DROP POLICY IF EXISTS "listing_images_tc" ON public.listing_images;
CREATE POLICY "listing_images_tc"
ON public.listing_images FOR ALL
USING (public.is_admin_or_tc());

-- listing_comments
DROP POLICY IF EXISTS "listing_comments_tc_select" ON public.listing_comments;
CREATE POLICY "listing_comments_tc_select"
ON public.listing_comments FOR SELECT
USING (public.is_admin_or_tc());

DROP POLICY IF EXISTS "listing_comments_tc_delete" ON public.listing_comments;
CREATE POLICY "listing_comments_tc_delete"
ON public.listing_comments FOR DELETE
USING (public.is_admin_or_tc());
