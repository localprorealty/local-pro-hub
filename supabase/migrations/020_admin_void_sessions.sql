-- Create security definer function to allow admins to invalidate all active sessions for a target user
CREATE OR REPLACE FUNCTION public.admin_void_user_sessions(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  DELETE FROM auth.sessions WHERE user_id = target_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_void_user_sessions(uuid) FROM public;
