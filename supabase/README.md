# Supabase setup — LocalPRO Hub

## 1. Create project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**
2. Name: `localpro-hub` (or your choice)
3. Save the **Project URL** and **anon key** (frontend) and **service role key** (backend only)

## 2. Enable Google OAuth

1. **Authentication** → **Providers** → **Google** → Enable
2. Add authorized redirect URL: `http://localhost:5173` (and your Netlify URL later)
3. Use your Google Cloud OAuth client ID/secret

## 3. Run schema

1. Open **SQL Editor** → **New query**
2. Paste and run `migrations/001_initial_schema.sql`
3. Paste and run `migrations/002_signup_profile_metadata.sql`
4. Paste and run `migrations/002_listings_delete_draft.sql` (agents can delete own drafts)
5. Paste and run `migrations/003_admin_role_controls.sql`
6. Paste and run `migrations/004_prevent_admin_self_demotion.sql`
7. Paste and run `migrations/005_admin_delete_user.sql`
8. Paste and run `migrations/006_admin_delete_auth_orphan.sql`
9. Paste and run `migrations/007_signup_requested_role.sql` (role chosen at signup while pending)
10. Paste and run `migrations/008_agent_milestones.sql` (agent personal dates + email templates)
11. Paste and run `migrations/009_email_templates_and_sends_rpc.sql` (richer templates + sends log RPC)
12. Paste and run `migrations/010_photography_booking.sql` (`alt_suggested` status, `suggested_alternate` jsonb, photographer seed, agent update policy)

## 4. Environment files

**`backend/.env`** (copy from `backend/.env.example`):

```env
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
GROQ_API_KEY=your-groq-key
N8N_SIGNUP_WEBHOOK_URL=http://localhost:5678/webhook/localpro-signup-pending
N8N_MILESTONE_WEBHOOK_URL=http://localhost:5678/webhook/localpro-run-milestones
N8N_BOOKING_WEBHOOK_URL=http://localhost:5678/webhook/localpro-photography-booked
NTREIS_RETS_URL=https://ntrdd.mlsmatrix.com/rets/Login.ashx
NTREIS_RETS_USERNAME=your-rets-username
NTREIS_RETS_PASSWORD=your-rets-password
```

**`frontend/.env`** (copy from `frontend/.env.example`):

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_BASE_URL=http://localhost:8000
```

Never commit `.env` files. Never put the service role key in the frontend.

## 5. Verify

- Table Editor shows: `users`, `listings`, `bookings`, `documents`, `marketing_requests`, `photographers`, `marketing_team_members`, `canva_templates`, `agent_milestones`, `milestone_email_log`, `automation_email_templates`
- RLS is enabled on all tables

## 6. Mock listing data (optional)

After `test@localprorealty.com` and `test2@localprorealty.com` exist in **Authentication** and **public.users** (approved agents):

1. SQL Editor → run `seeds/mock_listings.sql`
2. Re-run anytime to reset test listings (deletes only rows for those two agents)

**Per agent (5 listings each):**

| Agent | Stage | What to test |
|-------|--------|----------------|
| test@ | `draft` (empty) | New listing, address step |
| test@ | `draft` (partial form) | Continue form / Voice Fill |
| test@ | `docs_pending` | Listing hub → Mark docs signed |
| test@ | `docs_signed` | Hub → Book photography / negotiate shoot |
| test@ | `shoot_booked` | Hub → Move to marketing |
| test2@ | `draft` (address only) | Address step, not form yet |
| test2@ | `draft` (buyer partial) | Buyer rep + partial form |
| test2@ | `docs_pending` | Active pipeline |
| test2@ | `marketing` | Later-stage hub actions |
| test2@ | `closed` | **Archived** tab on dashboard |

Log in as `admin@localprorealty.com` → **Admin Pipeline** to see all 10 listings.

## 7. Agent milestone seed (optional)

After migrations `008` + `009` and `test@localprorealty.com` exists:

1. SQL Editor → run `seeds/agent_milestones_seed.sql` (adds a test milestone for today's month-day)
2. Edit milestones in **Admin → Agents → Edit user → Personal milestones**
3. Edit email templates in **Admin → Automations** (preview, run now, sent today)
4. n8n: import `n8n/workflows/localpro-automations.json`, wire Gmail + Supabase headers — see [`n8n/README.md`](../n8n/README.md)
