# LocalPRO Hub — Backend (FastAPI)

## Setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env — see comments in .env.example for what each variable does
```

## Run

```bash
source venv/bin/activate
uvicorn main:app --reload --port 8000
```

- Health: http://localhost:8000/health
- Docs: http://localhost:8000/docs

## Environment

Required for admin user management:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`

Recommended for local dev:

- `GROQ_API_KEY` — Voice Fill, marketing copy, Market Yourself scripts
- `HEYGEN_API_KEY` — Market Yourself avatar training + video generation (`/marketing/*`)
- `N8N_SIGNUP_WEBHOOK_URL` — signup → admin email via n8n
- `N8N_MILESTONE_WEBHOOK_URL` — manual milestone run from Admin → Automations
- `N8N_BOOKING_WEBHOOK_URL` — photography shoot request → photographer email + SMS via n8n
- `NTREIS_RETS_URL`, `NTREIS_RETS_USERNAME`, `NTREIS_RETS_PASSWORD` — live NTREIS property search

## Auth pattern

- **Admin routes** — `Authorization: Bearer <access_token>` from a signed-in **active admin**
- **Bookings routes** — Bearer token from **active agent** (create/respond) or **active photographer** (confirm/suggest/complete/block dates)
- **RETS routes** — same Bearer token from any **active** user (agent, admin, etc.)
- Credentials for NTREIS RETS stay server-side only; the browser never calls Matrix MLS directly

## Endpoints

### Health

| Method | Path | Auth |
|--------|------|------|
| GET | `/health` | None |

### Signup notification (CORS-safe n8n proxy)

| Method | Path | Auth |
|--------|------|------|
| POST | `/internal/notify-signup-pending` | None (server-side from frontend after signup) |

Forwards signup payload to `N8N_SIGNUP_WEBHOOK_URL`. Returns `{"ok": true/false}` — signup still succeeds if n8n is down.

### NTREIS RETS — property search

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/rets/search` | Search by MLS# or address; returns mapped form fields + raw RETS row |
| GET | `/rets/discover-fields` | Sample listing + all field names (for mapping debugging) |

**Flow:** Frontend → `POST /rets/search` → Python `RETSService` → `https://ntrdd.mlsmatrix.com/rets/` (digest login + Search.ashx) → XML parse → JSON. **Not local mock data.**

Request body examples:

```json
{ "query_type": "mls_number", "mls_number": "20439821" }
```

```json
{
  "query_type": "address",
  "street_number": "13128",
  "street_name": "Northhaven",
  "city": "Aubrey"
}
```

Test MLS numbers (verified live): `20439821`, `11787856`, `9199922`.

### Admin — users

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/admin/users` | Create user (auth + profile) |
| PATCH | `/admin/users/{id}` | Update profile; sync email to Auth |

Used by roster **Add user**, **Bulk add**, and email edits.

### Admin — agent milestones

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/admin/users/{id}/milestones` | List milestones for one agent |
| PUT | `/admin/users/{id}/milestones` | Replace all milestones for one agent |
| GET | `/admin/milestone-counts` | Per-user counts for roster badges |

### Admin — automation templates & runs

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/admin/automation-templates` | All `automation_email_templates` rows |
| PATCH | `/admin/automation-templates/{milestone_type}` | Update subject, HTML, enabled |
| GET | `/admin/automations/sends-today` | Today's `milestone_email_log` for UI |
| POST | `/admin/automations/run-milestones` | POST to n8n `localpro-run-milestones` webhook |

`run-milestones` sends `{"force": true}` so admins can re-run same day for testing. Returns **502** if n8n fails. Rejects `/webhook-test/` URLs.

### Voice Fill

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/voice/transcribe` | GROQ Whisper |
| POST | `/voice/extract` | GROQ structured field extraction |
| POST | `/voice/tts` | edge-tts audio stream |

Requires `GROQ_API_KEY` for transcribe/extract.

### Photography bookings

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/bookings/photographers` | Active user | List active photographers (optional `?tier=`) |
| GET | `/bookings/photographer/{id}/availability?month=YYYY-MM` | Active user | Blocked + booked dates |
| POST | `/bookings/create` | Agent | Request shoot (`pending`); does **not** advance listing stage |
| GET | `/bookings/listing/{listing_id}` | Agent | Active booking for listing hub negotiation UI |
| POST | `/bookings/{id}/agent-respond` | Agent | Accept photographer alternate or counter-offer |
| GET | `/bookings/my-shoots` | Photographer | Enriched shoot list for calendar |
| PUT | `/bookings/photographer/blocked-dates` | Photographer | Update `photographers.blocked_dates` |
| PUT | `/bookings/{id}/confirm` | Photographer | Accept date → `confirmed` → listing → `shoot_booked` |
| PUT | `/bookings/{id}/complete` | Photographer | Mark shoot done (`confirmed` only) |
| POST | `/bookings/{id}/suggest-alternate` | Photographer | Suggest up to 3 alternate dates |

On create, FastAPI POSTs to `N8N_BOOKING_WEBHOOK_URL` (non-blocking if unset).

### Go Live

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/listings/{id}/generate-description` | Agent | GROQ Llama MLS description from `form_data` |
| POST | `/listings/{id}/go-live` | Agent | `mls_submitted` → `live`, n8n fan-out; optional body `{ "go_live_date": "YYYY-MM-DD" }` |
| POST | `/listings/{id}/marketing/refine` | Agent | GROQ rewrite of marketing copy (`marketing` stage) |
| POST | `/listings/{id}/marketing/neighborhood-guide` | Agent | GROQ JSON neighborhood guide for listing book |

Requires `GROQ_API_KEY` for description generation. Set `N8N_GO_LIVE_WEBHOOK_URL`, `LOFTY_WEBHOOK_URL`, and `FRONTEND_URL` for go-live notifications.

### Market Yourself Video (HeyGen v3)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/marketing/avatar` | Agent | Saved HeyGen avatar + consent status from `users` |
| POST | `/marketing/upload-avatar-video` | Agent | Training video → Supabase `agent-avatars` → HeyGen digital twin (~$1) |
| GET | `/marketing/avatar-status/{job_id}` | Agent | Poll look training; persists avatar on `completed` |
| GET | `/marketing/avatar-consent` | Agent | Poll HeyGen `consent_status` for agent's avatar group |
| POST | `/marketing/avatar-consent` | Agent | Start HeyGen identity verification; returns `consent_url` |
| POST | `/marketing/generate-teleprompter` | Agent | GROQ fresh ~20s read-aloud script for avatar recording |
| POST | `/marketing/generate-script` | Agent | GROQ script (topic, audience, style, tone, pacing, CTA) |
| GET | `/marketing/heygen-voices` | Agent | List HeyGen voices |
| POST | `/marketing/generate-video` | Agent | `POST /v3/videos` with image backgrounds + consent gate (~$2/30s) |
| GET | `/marketing/heygen-video-status/{video_id}` | Agent | Poll until `completed` → `video_url` |

Requires `HEYGEN_API_KEY` + `GROQ_API_KEY` + Supabase Storage bucket `agent-avatars` (public). Router: [`marketing_video.py`](routers/marketing_video.py).

**Cost model:** ~$1 one-time per digital twin + identity verification ($0); ~$2 per 30s marketing video.

**HeyGen API:** [Quick start](https://developers.heygen.com/docs/quick-start) · [Pricing](https://developers.heygen.com/docs/pricing) · Avatar: `POST /v3/avatars` (`digital_twin`) · Video: `POST /v3/videos` · Status: `GET /v3/videos/{id}`

Auth helpers: [`backend/deps/auth.py`](deps/auth.py). Routers: [`bookings.py`](routers/bookings.py), [`listings.py`](routers/listings.py), [`marketing_video.py`](routers/marketing_video.py).

## Related docs

- Milestone schema + seeds: [`supabase/README.md`](../supabase/README.md)
- n8n workflow setup: [`n8n/README.md`](../n8n/README.md)
- Feature log: [`FeaturesDone.md`](../FeaturesDone.md)
