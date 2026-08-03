# LocalPRO Hub — Frontend

React 18 + Vite + TypeScript app for Local Pro Realty's internal hub (Mission Control).

## Setup

```bash
cd frontend
npm install
cp .env.example .env
# Set VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_API_BASE_URL
npm run dev
```

App: http://localhost:5173

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server with HMR |
| `npm run build` | Production build |
| `npm run lint` | ESLint |

## Environment

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_BASE_URL=http://localhost:8000
```

Never put the Supabase **service role** key or NTREIS RETS credentials in the frontend.

## Key routes

| Path | Who | Purpose |
|------|-----|---------|
| `/login`, `/signup` | Public | Auth |
| `/signup/pending` | Pending users | Awaiting approval |
| `/dashboard` | Agent, marketing, photographer | Listing overview |
| `/market-yourself` | Agent | HeyGen avatar + GROQ script + marketing video (`?step=` URL state) |
| `/listing/new` | Agent | Choose listing type |
| `/listing/:id/form` | Agent | **Step 0:** NTREIS search → 22-section form |
| `/listing/:id/photography` | Agent | Book photography (request shoot) |
| `/listing/:id/marketing` | Agent | Marketing asset grid + summary (`marketing` stage) |
| `/listing/:id/marketing-assets` | Agent | Marketing Asset Generator — photos, templates, AI refine, PNG/PDF (`marketing` stage) |
| `/listing/:id/mls` | Agent | Finalize NTREIS submission + section checklist (`marketing` stage) |
| `/listing/:id` | All roles | Listing hub (back → dashboard; shoot negotiation when active) |
| `/listing/:id/go-live` | Agent | Step 11 go-live — description, date, mark live (`mls_submitted`) |
| `/photographer/calendar` | Photographer | Bookings calendar, accept/suggest/block dates |
| `/profile` | Active users | Self-service profile |
| `/admin/pipeline` | Admin | All listings overview |
| `/admin/approvals` | Admin | Access approvals |
| `/admin/agents`, `/photographers`, `/marketing` | Admin | User rosters |
| `/admin/automations` | Admin | Milestone email templates, preview, run now, sent today |

## Structure

```
src/
├── pages/          auth, agent, admin, listing, photographer, profile
├── components/     admin, auth, booking, form, voice, listing, listings, marketing, layout, profile
├── hooks/          useAuth, useVoice
└── lib/            supabase, api, auth, users, listings, bookings, marketing, rets, milestones, voice-*, notify-signup
```

## Photography booking (Phase 19)

| Route | Who | Purpose |
|-------|-----|---------|
| `/listing/:id/photography` | Agent | Pick photographer, date, time; send shoot request |
| `/listing/:id` | Agent | **Shoot request** panel — see photographer alternates, counter-offer, notes |
| `/photographer/calendar` | Photographer | Accept / suggest alternate / block dates / mark complete |

**Stage rule:** Listing moves to `shoot_booked` only when the photographer **accepts** the final date (not when the agent sends the request).

**Key files:** `PhotographyPage.tsx`, `PhotographerCalendar.tsx`, `BookingNegotiationPanel.tsx`, `lib/bookings.ts`.

**API:** All booking calls go through FastAPI (`VITE_API_BASE_URL`) with Bearer token — see [`backend/README.md`](../backend/README.md).

## Marketing & MLS (Phase 21)

| Route | Who | Stage | Purpose |
|-------|-----|-------|---------|
| `/listing/:id/marketing` | Agent | `marketing` | Asset grid, select items, notify marketing team (UI stub) |
| `/listing/:id/mls` | Agent | `marketing` | LP Fill status, 22-section checklist, NTREIS submit checkbox → advances to `mls_submitted` |

**Key files:** `MarketingPage.tsx`, `MlsSubmissionPage.tsx`, `lib/marketing-assets.ts`, `SubmissionPortalSidebar.tsx`.

Pipeline after photography: Listing Hub → **Move to marketing** → Marketing → MLS → Go Live.

## Marketing Asset Generator (Phase 22)

| Route | Who | Stage | Purpose |
|-------|-----|-------|---------|
| `/listing/:id/marketing-assets` | Agent | `marketing` | Upload photos → payment stub → Just Sold / Flyer / Listing Book + AI refine + download |

**Flow:** Photo upload (25 max, categorized) → $80 payment UI (stub) → generate tabbed assets → AI refinement panel → download PNG/PDF.

| Asset | Download |
|-------|----------|
| Just Sold | PNG 1080×1080 |
| Listing Flyer | PNG + PDF (8.5×11) |
| Listing Book | Full multi-page PDF |

**AI refine:** Flyer description, flyer footer contact (`Name | Phone | Email`), listing book sections (neighborhood, property, bio). Agent phone/email from login profile.

**Key files:** `MarketingAssetsPage.tsx`, `components/marketing/*`, `lib/marketing.ts`, `lib/marketing-data.ts`, `lib/export-text-styles.ts`.

**Export:** `modern-screenshot` captures hidden full-size DOM; preview uses `MarketingPreviewFrame` scale only.

**Backend:** `POST /listings/{id}/marketing/refine`, `POST /listings/{id}/marketing/neighborhood-guide` — see [`backend/README.md`](../backend/README.md).

## Market Yourself Video Generator (Phase 23 — HeyGen)

| Route | Who | Flow |
|-------|-----|------|
| `/market-yourself` | Agent | Record avatar → options → script → HeyGen video |

**Steps:** `AvatarStep` → `OptionsStep` → `ScriptReviewStep` → `VideoDeliveryStep`

**URL params:** `step`, `avatar_job_id`, `video_id` — progress survives refresh.

**Key files:** `MarketYourselfPage.tsx`, `components/market-yourself/*`, `lib/marketing-video.ts`.

**Backend:** `GET /marketing/avatar`, `POST /marketing/upload-avatar-video`, `GET /marketing/avatar-status/{id}`, `POST /marketing/generate-script`, `GET /marketing/heygen-voices`, `POST /marketing/generate-video`, `GET /marketing/heygen-video-status/{id}` — requires `HEYGEN_API_KEY` + `GROQ_API_KEY`. See [`backend/README.md`](../backend/README.md).

**Setup:** Run migration `011_agent_avatar.sql`; create public Supabase Storage bucket `agent-avatars`.

## Go Live (Phase 20 + 21 redesign)

| Route | Who | Purpose |
|-------|-----|---------|
| `/listing/:id/go-live` | Agent | Step 11 UI — GROQ description, date picker, mark live (`mls_submitted` only) |

**Key files:** `GoLivePage.tsx`, `ListingMissionHeader.tsx`, `generateListingDescription()` / `markListingLive()` in `lib/listings.ts`.

After success, dashboard shows a gold **Listing is LIVE** banner (`?live=listingId`, auto-dismiss 8s).

All pipeline pages (`photography`, `marketing`, `mls`, `go-live`) use a sticky header with **back arrow → `/listing/:id`**.

## NTREIS property search (Step 0)

On `/listing/:id/form`, agents see **Find the property** — one input for MLS# or address (optional mic).

| Component | Role |
|-----------|------|
| `PropertySearchStep.tsx` | Hero search UI, multi-match picker, skip/manual fallback |
| `lib/rets.ts` | `searchRetsProperty()` → `POST /rets/search` on backend |

**When found:** form opens with fields pre-filled; gold **from NTREIS** badges on mapped fields.

**When not found:** "Property not in MLS yet" → open empty form.

**Test MLS#:** `20439821` (13128 Northhaven Way, Aubrey — 64 fields pre-filled).

Backend proxies live Matrix MLS RETS — not local mock data.

## Admin automations (Phase 17)

- **Agents roster** — edit user → Personal milestones (`AgentMilestonesEditor`)
- **Automations** — per-type HTML templates, iframe preview, trigger n8n run, view sends today
- API helpers in `src/lib/milestones.ts`; backend proxies n8n webhooks (no browser → n8n CORS issues)

## Related docs

- Supabase setup: [`supabase/README.md`](../supabase/README.md)
- Backend API (including `/rets/search`): [`backend/README.md`](../backend/README.md)
- n8n workflows: [`n8n/README.md`](../n8n/README.md)
- Feature log: [`FeaturesDone.md`](../FeaturesDone.md)
