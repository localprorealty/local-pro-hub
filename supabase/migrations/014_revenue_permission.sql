ALTER TABLE users
  ADD COLUMN IF NOT EXISTS can_view_revenue boolean DEFAULT false;
