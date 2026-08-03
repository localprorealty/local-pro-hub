# LocalPRO Hub — Features & Work Completed

**Project:** Internal real estate platform for Local Pro Realty (Dallas, TX)  
**Timeline:** ~2–3 days of active build (this chat session)  
**Stack:** React 18 + Vite + TypeScript · Tailwind CSS v4 · Framer Motion · shadcn/ui · Supabase Auth + Postgres · FastAPI (skeleton)

This document lists everything built from scratch through the latest session, in chronological order.

---

## Phase 1 — Project bootstrap & foundation

### 1.1 Repository & project kickoff
- Read project laws from `instructions.md` and `projectSpec.md` (brand, stack, architecture rules).
- Established non‑negotiables: TypeScript only (no `any`), black/gold/white brand, Mont + Glacial Indifference fonts, left-biased layouts, Framer Motion transitions, shadcn/ui base components, secrets in `.env` only.

### 1.2 Frontend scaffold (`frontend/`)
- Created **Vite + React 18 + TypeScript** app.
- Installed core dependencies:
  - Tailwind CSS v4 (`@tailwindcss/vite`)
  - Framer Motion
  - Lucide React icons
  - `@supabase/supabase-js`
  - React Router DOM
  - shadcn/ui (Radix primitives, CVA, clsx, tailwind-merge)
- Initialized **shadcn/ui** with path aliases (`@/`).
- Created folder structure: `pages/`, `components/`, `hooks/`, `lib/`, `styles/`.
- Added **Hallmark** design skill for UI reference.

### 1.3 Brand & design system
- Copied branding assets from `assests/` → `frontend/src/assets/branding/` (LP monogram, BLACK/GOLD logos).
- Built **`src/styles/globals.css`** with LocalPRO design tokens:
  - Colors: `#000000`, `#CFB87C`, `#FFFFFF`, surface layers, borders
  - Fonts: Mont (display), Glacial Indifference (body)
  - shadcn CSS variable mapping for dark theme
- Custom favicon from brand assets (`favicon.svg` / icons).

### 1.4 Core frontend libraries
- **`lib/supabase.ts`** — singleton Supabase browser client (env-validated).
- **`lib/api.ts`** — authenticated fetch wrapper for future FastAPI calls.
- **`lib/auth.ts`** — auth types, roles, signup payload types, documented security model.
- **`lib/format.ts`** — US phone formatting, MLS ID validation (`7` digits).
- **`hooks/useAuth.ts`** — sign in, sign up, sign out, profile fetch.
- **`components/ErrorBoundary.tsx`** — error boundary wrapper for every page.

### 1.5 shadcn/ui components installed
- Button, Input, Label
- Dropdown Menu, Avatar (for profile menu later)

---

## Phase 2 — Backend & database (structure first)

### 2.1 FastAPI backend (`backend/`)
- Python 3.11 **virtualenv** + `requirements.txt`.
- **`config.py`** — Pydantic settings for all env vars (Supabase, NTREIS, Dotloop, GROQ, Stripe, Resend, Twilio, n8n, CORS).
- **`main.py`** — FastAPI app, CORS for `localhost:5173`, **`GET /health`** endpoint.
- **`backend/.env.example`** — all backend env variables documented.
- **`backend/.gitignore`** — venv, `.env`, caches.

> **Note:** Full router/service scaffold was created, then **trimmed** per “one page at a time” directive. Backend is intentionally minimal (health only) until features need it.

### 2.2 Supabase schema & migrations (`supabase/migrations/`)

#### `001_initial_schema.sql`
- **Tables:** `users`, `listings`, `bookings`, `documents`, `marketing_requests`, `photographers`, `marketing_team_members`, `canva_templates`
- **Listing pipeline stages:** draft → docs_pending → docs_signed → shoot_booked → marketing → mls_submitted → live → closed
- **Listing types:** listing, buyer, lease
- **User statuses:** pending, active, suspended
- **User roles (initial):** agent, admin, photographer
- `updated_at` triggers on listings
- **`handle_new_user()`** trigger — auto-creates `public.users` row on Supabase Auth signup
- **Row Level Security (RLS)** on all tables:
  - Agents see/edit **own** listings
  - **`is_admin()`** helper — admins see/update all listings and related data
  - Photographers can see bookings assigned to them
- Indexes on email, role, status, agent_id, stage

#### `002_signup_profile_metadata.sql`
- Extended `handle_new_user()` to persist signup metadata:
  - full_name, phone, mls_id, license_number, photographer_tier
  - Default role: `agent`, status: `pending`

#### `003_admin_role_controls.sql`
- Added **`marketing`** role to allowed roles
- Normalized active users with null role → `agent`
- Documented one-time admin bootstrap SQL pattern

#### `004_prevent_admin_self_demotion.sql`
- DB trigger: admin **cannot demote themselves** or **suspend themselves**
- Belt-and-suspenders protection alongside UI guards

### 2.3 Supabase setup docs
- **`supabase/README.md`** — step-by-step:
  - Create Supabase project
  - Run migrations 001 → 004
  - Configure `frontend/.env` and `backend/.env`
  - Verify tables and RLS

### 2.4 Environment files
- **`frontend/.env.example`** — `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL`
- User configured live **`frontend/.env`** with real Supabase project credentials

---

## Phase 3 — Git, cleanup & focus

### 3.1 Root `.gitignore`
- Ignored: `.agents/`, `assests/`, demos, local docs/prompts (`instructions.md`, `projectSpec.md`, etc.), secrets, `node_modules`, `dist`, `backend/venv`
- Kept `.env.example` files trackable

### 3.2 Scope reduction (“one page at a time”)
- Removed premature page stubs, unused component folders, backend router/service stubs
- Kept: core setup, libs, minimal backend health server
- Fixed all **ESLint** issues; verified **`npm run lint`** and **`npm run build`** pass

---

## Phase 4 — Authentication UI (3 signup surfaces + login)

### 4.1 Login page (`/login`)
- Email + password form (no Google OAuth for now)
- Left brand panel + right form layout (Hallmark / reference design)
- Framer Motion entrance animations
- Loading state on submit, inline error messages
- **`SecureAuthNote`** component explaining auth security
- **`AuthBrandPanel`** reusable brand column
- Post-login routing by role/status (admin → pipeline, agent → dashboard, pending → pending page)
- Password **show/hide toggle** (eye icon in field)

### 4.2 Auth security clarification
- Documented in **`lib/auth.ts`**: credentials go **directly to Supabase over HTTPS (TLS)** — never to FastAPI, never stored in frontend code
- Passwords hashed by Supabase; production intended for Netlify HTTPS

### 4.3 Signup page (`/signup`) — 2-step wizard
**Step 1 — Account details**
- Full name, email, password, confirm password
- Phone (formatted), MLS ID (7-digit validation), license number
- Password show/hide toggles

**Step 2 — Photographer tier selection**
- Basic / Standard / Elite cards with icons
- Tier stored in Supabase user metadata → `public.users.photographer_tier`

- On submit: Supabase Auth signup + metadata; user lands on pending confirmation flow
- Sign-out after signup so pending users cannot access app routes

### 4.4 Signup pending page (`/signup/pending`) — 3rd signup surface
- “Awaiting admin approval” confirmation screen
- **Centered layout** fix (flex column, vertically centered)
- “Pending review” full-width; “Return to sign-in” on its own line below
- **Return to sign-in** link fixed → navigates to `/login`

---

## Phase 5 — Routing, session & access control

### 5.1 App router (`App.tsx`)
- React Router with protected/public/pending route guards
- Session sync via `supabase.auth.onAuthStateChange`
- Profile loaded from `public.users` on every auth change

### 5.2 Role-based home routes
| Role | Home |
|------|------|
| admin | `/admin/pipeline` |
| agent / marketing / photographer | `/dashboard` |
| pending | `/signup/pending` |
| suspended | `/login` |

### 5.3 Route guards
- **Protected routes** — must be logged in + active profile + correct role
- **Public-only routes** (`/login`, `/signup`) — logged-in users redirect to home
- **Pending route** — only for pending-status users
- Wrong role → redirect to that user’s home (agent cannot open admin URLs and vice versa)
- Logged-in user visiting `/login` or `/signup` → auto-redirect home

### 5.4 Profile menu (top-right)
- Avatar + dropdown on authenticated app pages
- **Profile** (placeholder) and **Log out**
- Matches brand styling; hidden on auth pages

---

## Phase 6 — Admin panel (user approvals)

### 6.1 Initial admin pipeline page (later split — see Phase 8)
- Left admin nav shell (LocalPRO Hub branding)
- **Agent Approvals** workflow:
  - Stats cards: awaiting approvals, active users, suspended users
  - Tabs: Pending / Approved / Suspended
  - Per-user cards: name, email, MLS ID, submitted date
  - **Approve** (sets active + role), **Reject** (suspend), **Save Role**
  - Role selector: agent, marketing, photographer, admin
  - Bulk select + **Approve Selected**
  - Summary table of all users
- Disabled placeholder nav items (Agents, Photographers, Marketing Team, Templates, etc.)

### 6.2 Admin role & marketing role (Supabase)
- Migration `003` — marketing role support
- User bootstrapped admin accounts (`admin@localprorealty.com`, `admin2@localprorealty.com`)
- Approved users with assigned roles unlock correct dashboards on next login

### 6.3 Admin self-protection (Phase 6b)
- **Frontend:** logged-in admin’s own row shows “You” badge; role locked to admin; approve/reject/save/bulk-select disabled for self
- **`assertCanModifyUser`** guard on all update paths
- **Database trigger (`004`):** blocks self-demotion and self-suspension even if UI bypassed
- Other admins can still manage each other (demote, suspend, etc.)

---

## Phase 7 — Agent dashboard & listing detail

### 7.1 Mock listing seed data
- Idempotent seed script: [`supabase/seeds/mock_listings.sql`](supabase/seeds/mock_listings.sql)
  - **5 listings each** for `test@localprorealty.com` and `test2@localprorealty.com`
  - Stages: draft (empty + partial form), docs_pending, docs_signed, shoot_booked, marketing, closed
  - NTREIS-style **`form_data`** JSON (addresses, beds/baths, agent MLS IDs)
- RLS verified: each test user sees **only their listings**; admin sees **all**

### 7.2 Agent Mission Control dashboard (`/dashboard`)
- Loads listings from Supabase (RLS-scoped)
- **Overview layout** inspired by Mission Control reference:
  - LP / Mission Control sidebar (no pipeline stage rail)
  - Tabs: Active / Drafts / Archived
  - Filter chips: All Listings, Needs Action, Pending Photo
  - Search by address or MLS
- **Pipeline listing cards** with:
  - Address, bed/bath/sqft from `form_data`
  - Stage badge + progress dots
  - Go-live date
  - Continue → listing detail

### 7.3 Listing hub — editable (`/listing/:listingId`)
- **Shareable URL** — reload keeps you on the listing
- Renamed from “Listing Details” to **Listing Hub** with stage-aware next steps
- **Stage advancement** — manual buttons per phase (Mark docs signed, Mark shoot booked, etc.) until Dotloop/photo integrations ship
- **Smart routing from dashboard:**
  - `draft` → `/listing/:id/form` (resume NTREIS form)
  - All other stages → Listing Hub
- Drafts auto-redirect from hub URL to form when agent opens their own draft
- **Delete draft** — hub + dashboard draft cards + form header (migration `002_listings_delete_draft.sql`)
- Displays: type, MLS, list price, AI description, collapsible raw form_data editor, pipeline sidebar
- **Save to Supabase** — persists description + form_data
- Back navigation: agents → `/dashboard`, admins → `/admin/pipeline`

### 7.4 Shared listing modules (refactor)
- **`lib/listings.ts`** — types, stage labels, pipeline stages, helpers
- **`lib/listing-form.ts`** — flatten/unflatten nested form JSON
- **`components/listings/PipelineListingCard.tsx`**
- **`components/listings/ListingDetailsPanel.tsx`**
- **`pages/listing/ListingDetailPage.tsx`**

### 7.5 Multi-role dashboard access
- `/dashboard` allowed for **agent, marketing, photographer** (shared route; role label in UI)
- `/listing/:listingId` allowed for all four roles including **admin**

---

## Phase 8 — Admin Mission Control split (latest)

### 8.1 Route restructure
| URL | Purpose |
|-----|---------|
| `/admin/pipeline` | **Overview** — all listings across all agents |
| `/admin/approvals` | **User approvals** (moved from old pipeline page) |
| `/admin/approval` | Redirect → `/admin/approvals` |
| `/admin/automations` | **Milestone email templates** — preview, run now, sent today |
| `/listing/:listingId` | Listing detail (shareable) |

### 8.2 Admin shell (`components/admin/AdminShell.tsx`)
- Sidebar matches Mission Control reference:
  - LP branding + “Mission Control” header
  - **Overview** nav → `/admin/pipeline`
  - **Approvals** nav → `/admin/approvals`
  - No “Pipeline” item in left nav
  - Disabled placeholders for future sections
  - **Quick Links:** Canva, Dot Loop, NTREIS
- Profile menu top-right on all admin pages

### 8.3 Admin pipeline overview (`AdminPipeline.tsx`)
- Fetches **all listings** (admin RLS)
- Same card grid, tabs, chips, and search as agent dashboard
- Cards link to `/listing/:id`

### 8.4 Admin approvals page (`AdminApprovals.tsx`)
- Full approvals UI moved here from old pipeline route
- Uses shared `AdminShell`
- All self-protection rules retained

---

## Phase 10 — n8n signup email + admin user lifecycle

### 10.1 n8n workflow (signup → admin email)
- Importable workflow: `n8n/workflows/localpro-automations.json` (signup branch; see Phase 17 for full unified flow)
- Setup guide: `n8n/README.md` (Gmail App Password, ngrok, webhook URL vs editor URL)
- On pending signup: HTML email to admin with login + approvals links
- Gmail via n8n **SMTP** credential (not a browser API key)

### 10.2 Signup notification path (CORS-safe)
- Browser **cannot** POST to ngrok/n8n directly (CORS / OPTIONS 500)
- **`POST /internal/notify-signup-pending`** on FastAPI forwards to n8n server-side
- Config: `N8N_SIGNUP_WEBHOOK_URL` in `backend/.env` (exact URL from n8n Webhook node → Production tab)
- n8n Docker needs `WEBHOOK_URL=https://your-ngrok.ngrok-free.dev/` then workflow toggled **off/on**
- Signup still succeeds if n8n is down (API returns `ok: false`, not 502)
- **`frontend/src/lib/notify-signup.ts`** calls FastAPI proxy after signup

### 10.3 Admin approvals — Rejected tab & permanent delete
- **Rejected** tab (status `suspended`) — was labeled Suspended
- **Re-approve** on rejected users (restore to active + role)
- **Bulk approve** works on Pending and Rejected tabs
- **Delete** — permanently removes `auth.users` (frees email for re-signup)
- Migration **`005_admin_delete_user.sql`** — `admin_delete_user()` RPC
- Migration **`006_admin_delete_auth_orphan.sql`** — delete works even if profile was removed manually

### 10.4 Auth cleanup lesson (documented)
- Signup checks **`auth.users`**; admin panel shows **`public.users`**
- Deleting only `public.users` leaves “User already registered”
- Fix: Admin **Delete** (after migration 005/006) or SQL: `delete from auth.users where email = '...'`

### 10.5 Verified working (end of sprint)
- Signup → FastAPI → ngrok → n8n → Gmail admin notification
- Admin approve / reject / re-approve / permanent delete
- Shareable listing URLs, Mission Control overview, role guards

---

## Phase 11 — Profile page and admin user roster

### 11.1 Self-service profile (`/profile`)
- Route for **agent, marketing, photographer, admin** (active users)
- [`ProfilePage.tsx`](frontend/src/pages/profile/ProfilePage.tsx) — loads full `public.users` row
- Editable: full name, phone, MLS ID, license number, photographer tier (photographers only)
- **Email read-only** with helper text
- Role and status shown as read-only badges (self mode)
- **Confirm save dialog** before writing to Supabase ([`ConfirmSaveDialog.tsx`](frontend/src/components/profile/ConfirmSaveDialog.tsx))
- [`ProfileMenu`](frontend/src/components/profile/ProfileMenu.tsx) navigates to `/profile` (was broken `#profile` hash)
- Admin profile uses `AdminShell`; others use [`MissionShell`](frontend/src/components/layout/MissionShell.tsx)

### 11.2 Data layer
- [`frontend/src/lib/users.ts`](frontend/src/lib/users.ts) — fetch/update helpers, diff for confirm dialog
- [`useAuth.getFullProfile`](frontend/src/hooks/useAuth.ts) for full profile fetch

### 11.3 Admin roster pages
| Route | Purpose |
|-------|---------|
| `/admin/agents` | Manage agents |
| `/admin/photographers` | Manage photographers |
| `/admin/marketing` | Manage marketing team |

- Shared [`AdminUserRoster.tsx`](frontend/src/pages/admin/AdminUserRoster.tsx):
  - Search, per-user **Edit** (admin form + confirm dialog)
  - **Add user** (email, temp password, profile fields, role, status)
  - **Bulk activate**, **bulk reject**, **bulk delete**
  - **Delete** permanent (auth + profile via `admin_delete_user`)
  - Self-admin protection (cannot demote/suspend/delete self)
- [`AdminShell`](frontend/src/components/admin/AdminShell.tsx) nav enabled for Agents / Photographers / Marketing

### 11.4 Backend admin create user
- [`POST /admin/users`](backend/routers/admin.py) — requires active admin JWT + `SUPABASE_SERVICE_KEY`
- Creates `auth.users` + patches `public.users` with intended role/status
- Documented in [`backend/README.md`](backend/README.md)

### 11.5 UI components added
- shadcn `dialog`, `alert-dialog`
- [`UserProfileForm.tsx`](frontend/src/components/profile/UserProfileForm.tsx) — shared self/admin form

### 11.6 Admin email + bulk add (post–Phase 11)
- Admins can **edit any user’s email** in roster (and **their own** on `/profile`) via `PATCH /admin/users/{id}` — syncs Auth + `public.users`
- Non-admins: email stays read-only on `/profile`
- **Bulk add** on roster (CSV-style lines) + single **Add user**
- [`backend/.env.example`](backend/.env.example) documented for required vars

---

## Phase 12 — Role-based signup, UI polish, and global grid

### 12.1 Signup — request access by role
- Page 1: choose **Agent**, **Marketing**, **Photographer**, or **Admin** before filling the form
- **Role-specific fields** on page 1 (agent: MLS + license; others: optional notes)
- **Page 2** only for **agents** (default photographer tier); marketing/admin/photographer submit from page 1
- Migration [`007_signup_requested_role.sql`](supabase/migrations/007_signup_requested_role.sql) — `handle_new_user` stores `requested_role` in `public.users.role` while `pending`
- Signup notify payload includes actual **role** (not hardcoded agent)

### 12.2 Admin approvals — requested role as default
- Renamed console to **Access approvals**
- Role dropdown **defaults to the user’s requested role** on load; admin can change before approve
- Row shows **Requested · {role}**

### 12.3 Global grid background (Mission Control aesthetic)
- [`GridBackground.tsx`](frontend/src/components/layout/GridBackground.tsx) — 40px grid (login-style white lines on black)
- Fixed grid on **all routes** via [`App.tsx`](frontend/src/App.tsx)
- Light grid variant on auth form panels (login/signup white side)
- Shell sidebars use translucent panels so grid shows through

### 12.4 Auth layout — fixed left, scroll right
- Login and signup: **left brand panel** fixed full viewport height, no scroll
- **Right form panel** only scrolls (`overflow-y-auto`)
- Login right panel aligned with signup padding/layout (`max-w-xl`, centered column)

---

## Phase 13 — New Listing + NTREIS 22-section form

### 13.1 New listing flow
| Route | Purpose |
|-------|---------|
| `/listing/new` | Listing type selection |
| `/listing/:id/form` | Step 0: NTREIS search (MLS/address) → 22-section NTREIS form |
| `/listing/new/:id` | Redirect → form |

- **Start New Listing** on agent dashboard
- `createListing()` — inserts `listings` row (`stage: draft`, empty `form_data`)
- **Listing (seller)** type enabled; **Buyer** and **Lease** shown as “Coming soon” (disabled)
- **Step 0:** single search — MLS# or address → live NTREIS RETS auto-fill (or skip to manual form)
- Auto-save `form_data` to Supabase (debounced)
- Section 22 review → advances listing to **`docs_pending`** → navigates to Listing Hub

### 13.2 NTREIS form engine
- [`ntreis-sections.ts`](frontend/src/lib/ntreis-sections.ts) — all 22 sections, conditional visibility (condo §20, farm §21)
- Field components: text, select, radio, multiselect, date, currency, yes/no, room rows
- Section nav, progress, review block, footer save indicator
- [`NtreisFormBody.tsx`](frontend/src/components/form/NtreisFormBody.tsx) — form shell + Voice Fill integration

### 13.3 Listings data layer
- [`lib/listings.ts`](frontend/src/lib/listings.ts) — `createListing`, `getListing`, `updateListingFormData`, `updateListingStage`, `advanceListingStage`, `deleteListing`, `getListingContinuePath`, `STAGE_GUIDANCE`

---

## Phase 14 — Voice Fill Q&A

### 14.1 Backend (`POST /voice/*`)
- [`backend/routers/voice.py`](backend/routers/voice.py) registered in `main.py`
- **`/voice/transcribe`** — GROQ Whisper Large v3
- **`/voice/extract`** — GROQ Llama 3.3 70B structured field extraction
- **`/voice/tts`** — edge-tts (`en-US-JennyNeural`), streams `audio/mpeg` (no API key)
- `GROQ_API_KEY` documented in `backend/.env.example`

### 14.2 Frontend voice system
| File | Role |
|------|------|
| `lib/voice-questions.ts` | 70+ hand-crafted questions, voice queue builder, `getDisplayOptions()` |
| `lib/voice-api.ts` | Transcribe + extract API client |
| `lib/tts.ts` | Fetch and play edge-tts audio |
| `lib/vad.ts` | Energy-based VAD for hands-free mode |
| `hooks/useVoice.ts` | Session state machine |
| `components/voice/VoicePanel.tsx` | Sliding panel, option pills, hold-to-talk |
| `components/voice/VoiceButton.tsx` | Floating gold mic |

### 14.3 Voice Fill UX
- **Push-to-talk (default):** TTS asks question → agent holds mic button → release → transcribe → extract → fill field
- **Hands-free toggle:** auto-listen after TTS with VAD silence detection (~1.5s)
- **Option pills:** Yes/No for `yes_no`; multiselect with Done button; tap-to-fill for select/radio
- **Per-section Voice Fill** button on each `SectionBlock` (section-scoped queue)
- **Global Voice Fill** via floating mic (all unfilled required fields)
- **← Back** to revisit previous question in session
- Renamed from placeholder “Voice review” → **Voice Fill**

---

## Phase 15 — Agent shell, sidebar & profile polish

### 15.1 Agent sidebar (`AgentSidebar.tsx`)
- Shared nav for dashboard, new listing, profile pages
- **Pipeline** stage legend in sidebar
- **Quick Links** (Canva, Dot Loop, NTREIS) — same as admin shell
- **`sticky top-0 h-svh`** — fixed viewport height; Quick Links always visible at bottom; middle section scrolls if needed

### 15.2 Admin sidebar fix
- Same fixed-height layout applied to [`AdminShell.tsx`](frontend/src/components/admin/AdminShell.tsx)
- Quick Links extracted to shared [`QuickLinks.tsx`](frontend/src/components/layout/QuickLinks.tsx)

### 15.3 Profile menu initials
- [`getDisplayInitials()`](frontend/src/lib/users.ts) in `lib/users.ts`
- **Agents:** two letters from full name (e.g. Adarsh Gella → **AG**)
- **Admins:** single letter (e.g. **A**)
- ProfileMenu loads `full_name` from Supabase; dropdown shows display name

### 15.4 Sheet a11y fix
- `sheet.tsx` — `forwardRef` on overlay/content; `SheetDescription` for mobile section nav

### 15.5 Supabase migration
- [`002_listings_delete_draft.sql`](supabase/migrations/002_listings_delete_draft.sql) — agents can delete own draft listings (RLS)

---

## Phase 17 — Agent milestones + unified n8n automations

### 17.1 Admin-only personal dates
- Migration [`008_agent_milestones.sql`](supabase/migrations/008_agent_milestones.sql):
  - `milestone_type` enum (8 types)
  - `agent_milestones` — month-day dates per agent (admin-only RLS)
  - `milestone_email_log` — dedupe sends per day
  - `automation_email_templates` — subject + HTML per type
  - `get_milestones_due_on()` RPC for n8n daily run
- Milestone types: agent birthday, work anniversary, wedding anniversary, spouse birthday, child birthday, home purchase anniversary, license renewal, custom
- Admin edits per agent: **Admin → Agents → Edit user → Personal milestones** ([`AgentMilestonesEditor.tsx`](frontend/src/components/admin/AgentMilestonesEditor.tsx))
- Agents **cannot** see or edit these dates
- Roster shows milestone count per user ([`GET /admin/milestone-counts`](backend/routers/admin.py))
- Optional seed: [`supabase/seeds/agent_milestones_seed.sql`](supabase/seeds/agent_milestones_seed.sql)

### 17.2 Backend API
| Endpoint | Purpose |
|----------|---------|
| `GET/PUT /admin/users/{id}/milestones` | List/replace milestones for one agent |
| `GET /admin/milestone-counts` | Counts for roster badges |
| `GET /admin/automation-templates` | All email templates |
| `PATCH /admin/automation-templates/{milestone_type}` | Update subject, HTML, enabled flag |
| `GET /admin/automations/sends-today` | Today's `milestone_email_log` rows for UI |
| `POST /admin/automations/run-milestones` | Proxy to n8n production webhook (`force: true` for same-day re-run) |

- Config: `N8N_MILESTONE_WEBHOOK_URL` in [`backend/config.py`](backend/config.py) / [`backend/.env.example`](backend/.env.example)
- Rejects `/webhook-test/` URLs; returns **502** when n8n fails (not misleading 200)

### 17.3 Admin Automations page (`/admin/automations`)
- [`AdminAutomations.tsx`](frontend/src/pages/admin/AdminAutomations.tsx) — enabled in [`AdminShell`](frontend/src/components/admin/AdminShell.tsx) nav
- Per-type template editor: subject, HTML body, enabled toggle
- **Preview** — [`EmailTemplatePreviewDialog.tsx`](frontend/src/components/admin/EmailTemplatePreviewDialog.tsx) renders HTML in iframe with sample vars
- **Run now** — triggers n8n milestone branch immediately (for testing)
- **Sent today** — table from `get_milestone_sends_for_date()` (no admin summary email; UI log only)
- [`frontend/src/lib/milestones.ts`](frontend/src/lib/milestones.ts) — types, API helpers, `renderEmailTemplate()`
- Template placeholders: `{{agent_name}}`, `{{person_name}}`, `{{custom_label}}`, `{{years}}`

### 17.4 Single n8n workflow
- **`n8n/workflows/localpro-automations.json`** — one import, three branches (one Active toggle):
  - **Webhook** `localpro-signup-pending` → admin email on signup (FastAPI proxy)
  - **Webhook** `localpro-run-milestones` → manual trigger from **Run now**
  - **Schedule** daily 8am → fetch due milestones → render → Gmail → log to Supabase
- Deleted legacy `signup-pending-admin-email.json` (merged into unified workflow)
- Supabase HTTP nodes need `apikey` + `Authorization: Bearer <service_role>` headers
- **Prepare log payload** Code node fixes Gmail output overwriting `$json` before log insert
- **No admin summary email** — daily run only emails agents; admins review **Sent today** in the app
- Migration [`009_email_templates_and_sends_rpc.sql`](supabase/migrations/009_email_templates_and_sends_rpc.sql):
  - Festive HTML templates per milestone type
  - `get_milestone_sends_for_date()` RPC for Admin UI
  - `p_force` on `get_milestones_due_on()` for manual re-run same day
- Setup: [`n8n/README.md`](n8n/README.md)

---

## Phase 18 — NTREIS RETS property search + auto-fill

### 18.1 Backend RETS proxy
- [`backend/services/rets_service.py`](backend/services/rets_service.py) — live NTREIS Matrix MLS RETS (not local mock data):
  - HTTP **digest auth** to `https://ntrdd.mlsmatrix.com/rets/Login.ashx`
  - Search via `Search.ashx` — class `Property`, DMQL2 queries
  - Parse COMPACT-DECODED XML → map RESO field names → NTREIS form keys
- [`backend/routers/rets.py`](backend/routers/rets.py):
  - `POST /rets/search` — MLS number or address (active agent JWT required)
  - `GET /rets/discover-fields` — sample record + field list for mapping refinement
- Config: `NTREIS_RETS_URL`, `NTREIS_RETS_USERNAME`, `NTREIS_RETS_PASSWORD` in [`backend/.env.example`](backend/.env.example)
- Frontend calls `localhost:8000/rets/search`; Python proxies to NTREIS server-side (credentials never in browser)

### 18.2 Step 0 — Find the property (simplified prefetch)
- Replaced 12-field manual address grid with single search screen ([`PropertySearchStep.tsx`](frontend/src/components/listing/PropertySearchStep.tsx))
- Agent enters **MLS#** or **address** (or uses mic → browser speech-to-text)
- **Found** → auto-advance to 22-section form with ~60+ fields pre-filled
- **Not found** → "Property not in MLS yet" + open empty form
- **Skip search** → manual form without RETS
- [`frontend/src/lib/rets.ts`](frontend/src/lib/rets.ts) — `parsePropertySearchQuery`, `searchRetsProperty`
- Gold **from NTREIS** badges on pre-filled fields (`_rets_prefilled_keys` in `form_data`)

### 18.3 Verified test MLS numbers (live RETS)
| MLS# | Property |
|------|----------|
| `20439821` | 13128 Northhaven Way, Aubrey (best — 64 fields) |
| `11787856` | 5014 Ross Avenue, Dallas |
| `9199922` | 12229 Rendon Road, Fort Worth |

---

## Phase 19 — Photography booking & shoot negotiation

### 19.1 Database (`010_photography_booking.sql`)
- Booking status extended: `alt_suggested` + `suggested_alternate` jsonb column
- Seeds `photographers` rows from active photographer users (mirrors `users.photographer_tier`)
- RLS: agents can update bookings on their own listings (`bookings_agent_update`)

### 19.2 Backend (`backend/routers/bookings.py`, `backend/deps/auth.py`)
- JWT auth helpers: `require_agent`, `require_photographer`, `require_active_user`
- Safe Supabase `maybe_single()` handling (supabase-py 2.30 returns `None` when no row)
- Auto-create `photographers` profile row if missing (`_ensure_photographer_profile`)
- **Endpoints:**
  - `POST /bookings/create` — agent requests shoot (`pending`); **does not** advance listing stage
  - `GET /bookings/listing/{id}` — active booking for listing hub
  - `POST /bookings/{id}/agent-respond` — accept photographer alternate or counter-offer
  - `GET /bookings/photographers`, `GET /bookings/photographer/{id}/availability`
  - `GET /bookings/my-shoots` — photographer calendar data
  - `PUT /bookings/{id}/confirm` — photographer accepts → `confirmed` → listing → `shoot_booked`
  - `POST /bookings/{id}/suggest-alternate` — photographer suggests up to 3 dates
  - `PUT /bookings/{id}/complete` — after shoot (`confirmed` only)
  - `PUT /bookings/photographer/blocked-dates`
- n8n webhook on create: `N8N_BOOKING_WEBHOOK_URL` → `localpro-photography-booked`

### 19.3 Agent UI
- **`/listing/:id/photography`** — [`PhotographyPage.tsx`](frontend/src/pages/listing/PhotographyPage.tsx): photographer cards (tier badges), week/month calendar, time slots 8am–5pm, access notes, **Request Shoot**
- **Listing Hub** — [`BookingNegotiationPanel.tsx`](frontend/src/components/booking/BookingNegotiationPanel.tsx): status, photographer alternates, accept/counter, two-way notes
- Dashboard CTA `docs_signed` → listing hub; photography link inside negotiation panel when no booking yet
- Stage guidance updated: shoot booked only after photographer acceptance

### 19.4 Photographer UI
- **`/photographer/calendar`** — [`PhotographerCalendar.tsx`](frontend/src/pages/photographer/PhotographerCalendar.tsx): month/week calendar, booking sidebar, block date range, upcoming shoots table
- Actions by status: **Accept shoot date** (pending), **Suggest alternate**, **Mark complete** (confirmed)
- Photographer home route → `/photographer/calendar`; sidebar **My Bookings** link

### 19.5 Two-way notes
- [`getBookingMessages()`](frontend/src/lib/bookings.ts) + [`BookingMessagesList.tsx`](frontend/src/components/booking/BookingMessagesList.tsx)
- Agent initial message → `access_notes`; negotiation notes → `suggested_alternate.note` with `proposed_by`
- Visible on both agent listing hub and photographer calendar sidebar

### 19.6 n8n
- [`n8n/workflows/photography-booked-notification.json`](n8n/workflows/photography-booked-notification.json)
- Webhook `localpro-photography-booked` → Gmail email + Twilio SMS to photographer

### 19.7 Shoot negotiation flow (correct behavior)
1. Agent requests date → `pending`, listing stays **`docs_signed`**
2. Photographer accepts → `confirmed`, listing → **`shoot_booked`**
3. Photographer suggests alternates → `alt_suggested` → agent responds on listing hub
4. Agent accepts alternate or counters → `pending` → photographer must accept again
5. Repeat until photographer confirms final date

---

## Phase 20 — Go Live (GROQ description + n8n fan-out)

### 20.1 Backend (`backend/routers/listings.py`)
- `POST /listings/{id}/generate-description` — GROQ Llama 3.3 70B from `form_data` (agent, `mls_submitted` only)
- `POST /listings/{id}/go-live` — advances to `live`, sets `go_live_date`, fires `N8N_GO_LIVE_WEBHOOK_URL`
- Config: `N8N_GO_LIVE_WEBHOOK_URL`, `LOFTY_WEBHOOK_URL`, `FRONTEND_URL`

### 20.2 Agent UI (initial)
- **`/listing/:id/go-live`** — GROQ generate, editable 1000-char textarea, pre-flight checklist, Mark as Live
- Listing hub + dashboard CTA when `mls_submitted`
- Dashboard gold celebration banner (`?live=listingId`, auto-dismiss 8s)

### 20.3 n8n
- [`n8n/workflows/listing-go-live.json`](n8n/workflows/listing-go-live.json) — webhook `localpro-listing-live` → admin email, marketing brief, Lofty HTTP stub

### 20.4 Pipeline
- `mls_submitted` → **`live`** only via Go Live page (manual stage advance removed for this step)

---

## Phase 21 — Marketing, MLS submission & mission UI redesign

### 21.1 Shared mission chrome
- [`ListingMissionHeader.tsx`](frontend/src/components/listing/ListingMissionHeader.tsx) — sticky header with back arrow → `/listing/:id`, title, address subtitle, profile menu
- [`ListingMissionLayout.tsx`](frontend/src/components/listing/ListingMissionLayout.tsx) — wraps `MissionShell` + shared header
- [`SubmissionPortalSidebar.tsx`](frontend/src/components/listing/SubmissionPortalSidebar.tsx) — submission portal nav (overview → property → marketing → MLS → go live), pipeline dot nav, synced badges
- **Listing Hub** (`ListingDetailPage`) — back arrow to dashboard / admin pipeline

### 21.2 Marketing page (`/listing/:id/marketing`)
- [`MarketingPage.tsx`](frontend/src/pages/listing/MarketingPage.tsx) — `marketing` stage only
- 2×3 asset grid: Social Pack, Flyer, Postcard ($5), Open House Kit ($15), Video Script, Yard Sign (external portal)
- Per-card status (not started / in progress / done), select/deselect, Canva/script links (UI stubs)
- Right sidebar: marketing summary, processing fee ($0.45 when paid items), **Notify marketing team** (client-side stub), **Continue to MLS submission**
- [`lib/marketing-assets.ts`](frontend/src/lib/marketing-assets.ts) — asset definitions and pricing

### 21.3 MLS submission page (`/listing/:id/mls`)
- [`MlsSubmissionPage.tsx`](frontend/src/pages/listing/MlsSubmissionPage.tsx) — `marketing` stage only
- Submission portal sidebar + **Finalize Submission** layout per design mockup
- LP Fill extension status indicator (connected / not installed)
- **Open NTREIS Matrix** external link
- 22-section sync checklist from `form_data` via `getVisibleSections` + `getSectionStatus`
- Checkbox: “I have reviewed and submitted this listing on NTREIS”
- **Continue to go live →** advances `marketing` → `mls_submitted`, navigates to go-live page

### 21.4 Go Live redesign (`/listing/:id/go-live`)
- Centered step-11 layout: progress bar, **Ready to go live** badge, milestone pills (docs, photos, marketing, MLS)
- Listing description card with regenerate + copy-to-clipboard
- **When should this go live?** date picker
- Large **Mark as live →** CTA
- Backend accepts optional `go_live_date` in `POST /listings/{id}/go-live` body

### 21.5 Pipeline wiring
- Routes in [`App.tsx`](frontend/src/App.tsx): `/listing/:id/marketing`, `/listing/:id/mls`
- [`lib/listings.ts`](frontend/src/lib/listings.ts): `getMarketingPath`, `getMlsPath`, updated `getListingContinuePath` / `STAGE_GUIDANCE` / CTA labels
- [`ListingDetailsPanel`](frontend/src/components/listings/ListingDetailsPanel.tsx): CTAs for marketing assets, MLS finalize, go live, book photography
- [`PhotographyPage`](frontend/src/pages/listing/PhotographyPage.tsx): back arrow → listing hub (not form)

### 21.6 Not built yet (marketing page stubs)
- Stripe checkout for paid assets on marketing grid page
- Real Canva deep-links and GROQ video script editor on marketing grid
- n8n notify on marketing asset selection (grid page)
- Chrome extension sync for LP Fill / real extension detection

---

## Phase 22 — Marketing Asset Generator

### 22.1 Route & flow
| Route | Who | Stage | Purpose |
|-------|-----|-------|---------|
| `/listing/:id/marketing-assets` | Agent | `marketing` | Photo upload → payment stub → generate Just Sold, Flyer, Listing Book |

- Linked from `/listing/:id/marketing` → **Create marketing assets →**
- Three-step wizard: **upload** (up to 25 photos, categories, hero required) → **payment** ($80 Stripe UI stub) → **generate** (preview + AI refine + download)

### 22.2 Templates & export
| Asset | Export size | Format |
|-------|-------------|--------|
| Just Sold | 1080×1080 | PNG |
| Listing Flyer | 816×1056 (8.5×11 @ 96dpi) | PNG + PDF |
| Listing Book | 900×1200 portrait, 1200×900 landscape collages | Multi-page PDF |

- **`MarketingPreviewFrame`** — scaled on-screen preview + hidden full-size export node (capture targets export node, not scaled preview)
- **`modern-screenshot`** for DOM → canvas (replaces html2canvas; handles Tailwind v4 / oklab without stripping styles)
- **`export-text-styles.ts`** — export-safe typography (normal letter/word spacing)
- Agent contact on assets: name, phone, email from login profile; footer email editable via AI refine section

### 22.3 AI refinement (GROQ)
- Backend: `POST /listings/{id}/marketing/refine`, `POST /listings/{id}/marketing/neighborhood-guide`
- Flyer sections: **Property description**, **Footer contact info** (`flyer_footer` page type — updates black footer bar only)
- Listing book: 11 refinement sections (neighborhood guide fields, property details, agent bio) via `book-refinement-pages.ts`
- Undo history (last 3 instructions per section)

### 22.4 Key files
```
frontend/src/pages/listing/MarketingAssetsPage.tsx
frontend/src/components/marketing/
  JustSoldTemplate.tsx, ListingFlyerTemplate.tsx, ListingBookTemplate.tsx
  PhotoUploadStep.tsx, PaymentStep.tsx, AiRefinementPanel.tsx
  MarketingPreviewFrame.tsx, book-refinement-pages.ts
  listing-book/  (BookCoverPage, BookNeighborhoodPage, BookPropertyDetailsPage,
                  BookAgentBioPage, PhotoCollagePage, BookPagePreviewFrame)
frontend/src/lib/marketing.ts, marketing-data.ts, marketing-types.ts, export-text-styles.ts
```

### 22.5 Not built yet
- Real Stripe charge on payment step
- Persist generated assets / photo uploads to Supabase storage
- Canva API integration

---

## Phase 23 — Market Yourself Video Generator (HeyGen)

### 23.1 Route & flow
| Route | Who | Purpose |
|-------|-----|---------|
| `/market-yourself` | Agent | Record avatar → script options → HeyGen marketing video |

- Sidebar nav: **Market Yourself** (agent only), between New Listing and Profile
- **4-step wizard:** avatar recording/training → content options → script review → video delivery
- **URL state:** `?step=1|2|3|4`, `avatar_job_id`, `video_id` — survives page refresh
- **Avatar:** 30s browser recording (MediaRecorder) → Supabase Storage `agent-avatars` → HeyGen `POST /v3/avatars` (`digital_twin`) → `heygen_avatar_id` on `public.users`
- Returning agents with avatar see **Use this avatar** or **Record new**

### 23.2 Backend (`/marketing/*`) — HeyGen v3
| Endpoint | Purpose |
|----------|---------|
| `GET /marketing/avatar` | Agent's saved HeyGen avatar from `users` |
| `POST /marketing/upload-avatar-video` | Training video → Supabase → HeyGen digital twin → `{ job_id }` |
| `GET /marketing/avatar-status/{job_id}` | Poll look training; saves `heygen_avatar_id` when `completed` |
| `POST /marketing/generate-script` | GROQ script (topic, audience, style, tone, pacing, CTA) |
| `GET /marketing/heygen-voices` | HeyGen voice list + default (Rachel if available) |
| `POST /marketing/generate-video` | `POST /v3/videos` with avatar + script + voice + background |
| `GET /marketing/heygen-video-status/{video_id}` | Poll until `completed` → `video_url` |

Requires `GROQ_API_KEY` + `HEYGEN_API_KEY`. Supabase Storage bucket `agent-avatars` (public) required for training uploads.

**Pricing reference:** [HeyGen API pricing](https://developers.heygen.com/docs/pricing) — Photo Avatar ~$0.05/sec at 720p/1080p; Digital Twin creation $1/call.

### 23.3 Script options (Step 2)
- 10 topics + conditional fields (unchanged)
- **Audience:** first-time buyers, move-up buyers, sellers, investors
- **Content style:** talking head, story time, Q&A hook, data drop, announcement, quick tip
- **Tone, pacing, background** (6 swatches), aspect ratio, CTA
- Optional 200-char context

### 23.4 Key files
```
supabase/migrations/011_agent_avatar.sql
backend/routers/marketing_video.py
frontend/src/pages/agent/MarketYourselfPage.tsx
frontend/src/components/market-yourself/
  AvatarStep.tsx, OptionsStep.tsx, ScriptReviewStep.tsx,
  VideoDeliveryStep.tsx, StepProgress.tsx
frontend/src/lib/marketing-video.ts
```

### 23.5 Not built yet
- Supabase table for saved marketing videos / history
- Stripe billing for HeyGen usage
- Auto-post to Instagram/Facebook APIs
- Voice preview before generate

---

## Phase 9 — Quality & verification

- **ESLint** clean across frontend
- **TypeScript build** (`tsc -b`) passes
- **Vite production build** passes
- Error boundaries on: Login, Signup, Signup Pending, Dashboard, Admin Pipeline, Admin Approvals, Listing Detail
- Loading states on: auth actions, listing fetch, user fetch, listing save, admin mutations

---

## Accounts & test data (configured by you in Supabase)

| Account | Purpose |
|---------|---------|
| `admin@localprorealty.com` | Primary admin |
| `admin2@localprorealty.com` | Secondary admin |
| `test@localprorealty.com` | Agent test user + mock listings |
| `test2@localprorealty.com` | Second agent test user + separate listings |

---

## What is intentionally NOT built yet (next phases)

These were scoped out or left as stubs for later:

- **Dotloop** document sync + automatic stage advancement on signature
- **Marketing** backend (Stripe checkout on marketing grid, Canva deep-links, n8n notify on asset select — **asset generator UI is live** at `/listing/:id/marketing-assets`)
- Buyer and **Lease** listing flows (type cards disabled on `/listing/new`)
- Marketing dedicated dashboard (beyond shared Mission Control overview)
- Admin nav placeholders: Templates, Resources (**Automations** page is live at `/admin/automations`)
- Google OAuth (documented in Supabase README, not wired in UI)
- Netlify deployment wiring
- Stripe / Resend / Twilio integrations (beyond n8n Gmail signup alert)
- Supabase Database Webhook → n8n (optional; app uses FastAPI proxy today)
- Chrome extension / Plasmo workflow

---

## File map (key deliverables)

```
LocalPro/
├── FeaturesDone.md          ← this file
├── .gitignore
├── frontend/
│   ├── src/
│   │   ├── App.tsx          ← routing + guards
│   │   ├── pages/
│   │   │   ├── auth/        Login, Signup, SignupPending
│   │   │   ├── agent/       Dashboard, OverviewPage (history + earnings)
│   │   │   ├── admin/       AdminPipeline, AdminApprovals, AdminAutomations, AdminUserRoster, Agents, Photographers, Marketing, AdminBrokerMintPage, RevenueOverviewPage
│   │   │   ├── profile/     ProfilePage
│   │   │   └── listing/     NewListingPage, ListingFormPage, ListingDetailPage, PhotographyPage, MarketingPage, MarketingAssetsPage, MlsSubmissionPage, GoLivePage
│   │   │   └── photographer/ PhotographerCalendar
│   │   ├── components/
│   │   │   ├── marketing/   JustSold, Flyer, ListingBook templates, PhotoUpload, Payment, AiRefinement
│   │   │   ├── booking/     BookingNegotiationPanel, BookingMessagesList, ShootWeekCalendar
│   │   │   ├── admin/       AdminShell, AgentMilestonesEditor, EmailTemplatePreviewDialog
│   │   │   ├── auth/        AuthBrandPanel, SecureAuthNote
│   │   │   ├── listing/     PropertySearchStep, ListingMissionHeader, ListingMissionLayout, SubmissionPortalSidebar
│   │   │   ├── form/        NTREIS form (NtreisFormBody, SectionBlock, fields…)
│   │   │   ├── voice/       VoiceButton, VoicePanel, Waveform
│   │   │   ├── listings/    PipelineListingCard, ListingDetailsPanel, DeleteDraftButton
│   │   │   ├── profile/     ProfileMenu, UserProfileForm, ConfirmSaveDialog
│   │   │   ├── overview/    CapProgressCard (recharts donut chart)
│   │   │   └── layout/      MissionShell, AgentSidebar, QuickLinks, GridBackground
│   │   ├── hooks/           useAuth, useVoice
│   │   └── lib/             auth, api, supabase, users, milestones, listings, bookings, marketing-*, rets, ntreis-sections, voice-*, notify-signup, format, brokermint
│   └── .env.example
├── backend/
│   ├── main.py              health + notify-signup + admin + bookings + rets + voice routers + brokermint router
│   ├── deps/auth.py         JWT role guards + can_view_revenue profile check
│   ├── routers/bookings.py  photography booking + shoot negotiation API
│   ├── routers/listings.py  GROQ description + go-live + optional go_live_date
│   ├── routers/admin.py     users CRUD + milestones + automation templates
│   ├── routers/rets.py      NTREIS RETS property search proxy
│   ├── routers/brokermint.py BrokerMint sync triggers, history details, and payment tracking APIs
│   ├── services/rets_service.py  RETS login, search, field mapping
│   ├── services/brokermint_service.py BrokerMint REST client (users list & user details)
│   ├── services/brokermint_sync.py BrokerMint database sync orchestrator (cap fields parsing)
│   ├── routers/voice.py     transcribe, extract, tts (edge-tts)
│   ├── config.py
│   └── .env.example
├── n8n/
│   ├── README.md
│   ├── workflows/localpro-automations.json
│   └── workflows/photography-booked-notification.json
│   └── workflows/listing-go-live.json
└── supabase/
    ├── README.md
    ├── seeds/mock_listings.sql, agent_milestones_seed.sql
    └── migrations/          001–010 (+ draft delete RLS, agent milestones, photography booking, BrokerMint schemas, revenue permission, payment tracking, agent cap columns)
```

---

## Summary for leadership (elevator pitch)

In ~2–3 days we went from **zero** to a **working internal hub** with:

1. **Full-stack project foundation** — React/Vite/TS frontend, FastAPI skeleton, Supabase Postgres with RLS  
2. **Secure auth** — login, 2-step signup, pending approval gate, role-based routing  
3. **Admin operations** — approve/reject users, assign roles (agent/marketing/photographer/admin), bulk approve, self-protection for admins  
4. **Agent Mission Control** — searchable listing overview with pipeline stage visibility  
5. **Listing workspace** — shareable URLs, editable descriptions and NTREIS form data saved to Supabase  
6. **Admin Mission Control** — org-wide listing overview + separate approvals console  
7. **Brand-faithful UI** — black/gold/white, Mont/Glacial, Framer Motion, shadcn components  
8. **Automations** — unified n8n workflow (signup alert + daily milestone emails + manual run); Admin → Automations with template editor, preview, run now, sent-today log  
9. **Signup notification** — FastAPI → n8n webhook → Gmail (CORS-safe proxy)  
10. **Full user lifecycle** — reject, re-approve, and permanently delete users (auth + profile)  
11. **Profile & roster management** — `/profile` self-edit with confirm dialog; admin Agents/Photographers/Marketing rosters with bulk ops, personal milestones, create-user API  
12. **Role-based signup** — multi-role access requests; admin approves with requested role as default  
13. **Unified grid UI** — classic Mission Control grid on every page; auth split layout (fixed brand / scrolling form)  
14. **New Listing + NTREIS form** — address capture, 22-section data entry, auto-save, review → docs_pending  
15. **Voice Fill** — edge-tts prompts, GROQ transcribe/extract, push-to-talk + hands-free, per-section or global queue  
16. **Listing Hub** — stage guidance, manual advancement, draft resume/delete, smart dashboard routing  
17. **Agent Mission Control shell** — rich sidebar (nav, pipeline legend, quick links), profile initials from name  
18. **Agent milestone automations** — admin-only personal dates, per-type HTML emails, daily n8n schedule + manual run, send log in UI  
19. **NTREIS RETS auto-fill** — single search step (MLS or address), live Matrix RETS proxy, 22-section form pre-fill with gold badges  
20. **Photography booking** — agent request flow, photographer calendar, two-way date negotiation, stage advances only on photographer accept, n8n notify  
21. **Go Live** — GROQ MLS description, agent review, `mls_submitted` → `live`, n8n admin + marketing fan-out, dashboard celebration banner  
22. **Marketing & MLS mission UI** — asset selection page, NTREIS finalize checklist, redesigned go-live step, shared back navigation across pipeline pages  
23. **Marketing Asset Generator** — photo upload, Just Sold / Flyer / Listing Book templates, GROQ AI refinement, PNG/PDF export via modern-screenshot  
24. **Market Yourself Video Generator** — HeyGen digital twin avatar (browser recording), expanded script options, GROQ + v3 video API, URL state persistence  
25. **BrokerMint Revenue Sync & Payment Tracking** — automated email-matched User sync, transaction commission ingest, Tricia's broker dashboard showing agent cards, date-range picker, drawers, bulk payment tools, and 5s Undo  
26. **Agent Cap Progress Visualizer** — recharts gold donut chart, automatic anniversary cycle boundary checks (handling leap years), split/monthly fee details, and capped-out celebration banner  
27. **Feature 3: Revenue Share (Completed: July 15, 2026)** — Full downline calculations (Gen 1–5), unlock thresholds, completion bonuses, active cap cycle boundaries, 98.8% skip-if-unchanged database caching optimization, and BrokerMint synchronization.

The platform is ready for the next increment: Dotloop documents, Marketing payments (Stripe on grid page), buyer/lease flows, and Chrome extension.
