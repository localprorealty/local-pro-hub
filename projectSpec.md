# LocalPRO Hub — Project Specification
**Local Pro Real Estate · Dallas, TX · 110+ Agents**
Version 1.0 — May 2026

---

## 1. Product Vision

LocalPRO Hub is an internal web platform that replaces the fragmented 5-tool workflow agents currently use (Lofty, BrokerMint, ShowingTime, scattered Canva links, manual NTREIS entry) with a single, voice-capable, AI-powered listing command center.

**One-line pitch:**
> "Walk through the property talking. By the time you leave, the listing is ready to go live."

**Core problem:** Agents spend 4–5 hours per listing on data re-entry across disconnected tools. Every piece of information is typed multiple times into different systems. LP Hub eliminates that entirely.

---

## 2. Users & Roles

| Role | Count | Primary job in LP Hub |
|---|---|---|
| Agent | 110+ | Start listings, fill forms via voice, book photographers, manage marketing |
| Admin | 1–3 | Approve agents, manage team roster, control automations, view global pipeline |
| Photographer | 3 | View calendar, manage bookings, suggest alternate dates |

Auth: Supabase Auth with Google OAuth (Gmail login). Role assigned by admin post-approval. No self-serve role selection.

---

## 3. Design Decisions

### 3.1 Brand & Visual Language

**Colors (LocalPRO brand)**
```
--black:      #000000   (primary background, nav, headers)
--white:      #FFFFFF   (cards, content surfaces)
--gold:       #CFB87C   (primary accent — all CTAs, highlights, active states)
--gold-dim:   #CFB87C22 (subtle gold fills)
--gray-dark:  #434343   (secondary text, icons)
--gray-light: #F4F3F2   (page background, secondary surfaces)
```

**Typography**
- Display: Mont (imported via Google Fonts or local)
- Body: Glacial Indifference or Inter as fallback
- Mono: JetBrains Mono (code, IDs)

**Design philosophy (Hallmark anti-slop rules applied):**
- No purple-gradient heroes — solid black with gold accent only
- No Inter as display — Mont for all headings
- No centered-everything layouts — left-biased with intentional asymmetry
- No gradient pill CTAs — solid gold fill, sharp or minimal radius
- No rounded-icon-in-colored-square cards — use editorial layout instead
- Framer Motion for transitions, not CSS animations hacked together
- Every interactive element has a visible focus ring (accessibility)

### 3.2 Dashboard UX — NOT a standard Kanban

The pipeline is presented as a **Mission Control** aesthetic, not a traditional Kanban board:

- **Vertical timeline rail** on the left showing pipeline stages as a connected node graph
- **Listing cards are horizontal, full-width panels** — not small sticky notes
- Each card shows: address, listing type badge, photographer date, doc status, go-live countdown
- Stage nodes pulse gold when a listing is in that stage
- Framer Motion: cards animate in with a horizontal slide, stage transitions use a flowing reveal
- Dark surface for the pipeline area (near-black `#0a0a0a`) with gold node connectors
- Feels like mission control / Bloomberg terminal / Vercel dashboard — premium, data-dense, not toy-like

### 3.3 Voice UX

- Mic button is always visible (floating, bottom-right, gold ring)
- Active listening: animated gold ring pulses around the mic
- Transcription appears live as the agent speaks (word by word)
- AI response plays via Kokoro TTS — warm, professional female voice
- No button needed to submit — VAD (voice activity detection) handles pauses
- Visual: waveform bar appears when agent is speaking, collapses when AI responds

### 3.4 Tech Stack (FINAL, confirmed)

| Layer | Technology | Reason |
|---|---|---|
| Frontend | React + Vite | Fast build, great ecosystem |
| Styling | Tailwind CSS v4 | Utility-first, consistent spacing |
| Animations | Framer Motion | Professional motion, not CSS hacks |
| UI Components | shadcn/ui | Free, accessible, Tailwind-native |
| Backend | Python + FastAPI | Async, clean, perfect for AI/API work |
| Database | Supabase (PostgreSQL) | Auth + DB + real-time in one |
| Auth | Supabase Auth + Google OAuth | No Clerk needed — free at this scale |
| MLS Data | NTREIS RESO Web API ($20/mo) | Interim: Bridge Interactive |
| Transactions | Dot Loop REST API v2 | Official API — no DOM injection |
| Automation | n8n self-hosted on Railway | Free, unlimited, configurable |
| AI LLM | GROQ — Llama 3.3 70B | Fastest, cheapest, great JSON output |
| Voice STT | GROQ Whisper Large v3 | Best speed/accuracy available |
| Voice TTS | Kokoro TTS (Apache 2.0) | Free ElevenLabs alternative |
| Voice VAD | silero-vad-onnx (browser) | Hands-free detection |
| Extension | Plasmo (React-based) | Modern Chrome extension framework |
| Email A | Gmail SMTP (Workspace) | Official, high-trust emails |
| Email B | Resend API | Transactional, 3000/mo free |
| SMS | Twilio | $0.008/SMS |
| Payments | Stripe | Marketing add-ons |
| Frontend host | Netlify | Free tier sufficient |
| Backend host | Railway ($5/mo) | FastAPI + n8n on same instance |
| PWA | vite-plugin-pwa | Future mobile app base |

### 3.5 Email Strategy (Dual)

```
Gmail SMTP → official@localpro.com
  - Agent approval
  - Listing go-live confirmation
  - Contract signed notification
  - Admin alerts

Resend API → notifications@localpro.com
  - Photographer booking
  - Marketing team briefs
  - Booking changes
  - Reminders, nudges
```

Gmail Workspace: 2,000 recipients/day
Resend free tier: 3,000 emails/month
Combined: effectively unlimited for 110 agents

### 3.6 Photo Delivery Strategy

Phase 1: Photographer emails photos directly to agent. Zero storage cost, full quality. Agent ticks "Photos received" in LP Hub.
Phase 2: Photographer pastes Google Drive link into listing record. Platform stores the link, not the files.

---

## 4. Application Structure

```
localpro-hub/
├── frontend/                    # React + Vite
│   ├── src/
│   │   ├── pages/
│   │   │   ├── auth/
│   │   │   │   ├── Login.tsx
│   │   │   │   └── Signup.tsx
│   │   │   ├── agent/
│   │   │   │   ├── Dashboard.tsx        # Mission Control pipeline
│   │   │   │   ├── NewListing.tsx       # Type selection
│   │   │   │   ├── PropertySearch.tsx   # Address/MLS# + RESO fetch
│   │   │   │   ├── DataReview.tsx       # 22-section form review
│   │   │   │   ├── Documents.tsx        # Dot Loop integration
│   │   │   │   ├── Photography.tsx      # Photographer booking calendar
│   │   │   │   ├── Marketing.tsx        # Canva + marketing packages
│   │   │   │   ├── MlsSubmit.tsx        # Extension prompt + status
│   │   │   │   ├── GoLive.tsx           # Final step + AI description
│   │   │   │   └── Profile.tsx
│   │   │   ├── admin/
│   │   │   │   ├── AdminDashboard.tsx
│   │   │   │   ├── Approvals.tsx
│   │   │   │   ├── AgentManagement.tsx
│   │   │   │   ├── Photographers.tsx
│   │   │   │   ├── MarketingTeam.tsx
│   │   │   │   ├── Templates.tsx
│   │   │   │   ├── AutomationConfig.tsx
│   │   │   │   └── Resources.tsx
│   │   │   └── photographer/
│   │   │       ├── PhotoCalendar.tsx
│   │   │       └── BookingDetail.tsx
│   │   ├── components/
│   │   │   ├── ui/                      # shadcn/ui components
│   │   │   ├── pipeline/
│   │   │   │   ├── MissionRail.tsx      # Left timeline rail
│   │   │   │   ├── ListingCard.tsx      # Horizontal full-width card
│   │   │   │   └── StageNode.tsx        # Pulsing stage indicator
│   │   │   ├── voice/
│   │   │   │   ├── VoiceButton.tsx      # Floating mic
│   │   │   │   ├── Waveform.tsx         # Speaking animation
│   │   │   │   └── VoiceProvider.tsx    # Context + VAD logic
│   │   │   ├── form/
│   │   │   │   ├── PropertySection.tsx  # Accordion section for NTREIS fields
│   │   │   │   └── FieldInput.tsx
│   │   │   └── layout/
│   │   │       ├── AppShell.tsx
│   │   │       ├── Sidebar.tsx
│   │   │       └── Header.tsx
│   │   ├── hooks/
│   │   │   ├── useVoice.ts
│   │   │   ├── useRESO.ts
│   │   │   ├── useListing.ts
│   │   │   └── useAuth.ts
│   │   ├── lib/
│   │   │   ├── supabase.ts
│   │   │   ├── groq.ts
│   │   │   └── api.ts
│   │   └── styles/
│   │       └── globals.css              # Brand tokens as CSS vars
├── backend/                     # FastAPI (Python)
│   ├── main.py
│   ├── routers/
│   │   ├── auth.py
│   │   ├── listings.py
│   │   ├── reso.py              # NTREIS RESO API proxy
│   │   ├── dotloop.py           # Dot Loop API integration
│   │   ├── photographers.py
│   │   ├── marketing.py
│   │   ├── admin.py
│   │   ├── brokermint.py        # BrokerMint sync + revenue + cap APIs
│   │   └── webhooks.py          # Dot Loop + Stripe webhooks
│   ├── services/
│   │   ├── groq_service.py      # LLM + Whisper calls
│   │   ├── email_service.py     # Gmail + Resend dual setup
│   │   ├── sms_service.py       # Twilio
│   │   ├── n8n_service.py       # n8n webhook triggers
│   │   ├── brokermint_service.py # BrokerMint API client
│   │   ├── brokermint_sync.py   # User and transaction sync coordinator
│   │   └── tts_service.py       # Kokoro TTS
│   ├── models/
│   │   ├── listing.py
│   │   ├── user.py
│   │   └── booking.py
│   └── config.py
├── extension/                   # Plasmo Chrome extension
│   ├── src/
│   │   ├── popup.tsx
│   │   ├── sidebar.tsx          # 22-page NTREIS checklist
│   │   ├── content/
│   │   │   └── ntreis.ts        # Content script for Matrix
│   │   └── background.ts
│   └── package.json
└── docs/
    ├── projectSpec.md           # This file
    ├── instructions.md
    └── field-mapping.json       # NTREIS Matrix field → data keys
```

---

## 5. Page-by-Page Specification

### 5.1 Login / Signup

**URL:** `/login`, `/signup`
**Layout:** Split — left half black with LocalPRO logo + gold tagline, right half clean white form
**Login:** "Continue with Google" button (gold, full width). Below: "Don't have an account? Sign up"
**Signup:** Name, phone, MLS ID (7-digit, validated), license number, photographer tier select (Elite/Standard/Basic). Google OAuth still handles identity.
**Post-signup:** "Awaiting approval" screen — black page, gold LP logo, "Your account is pending broker approval. You'll receive an email at [email] when approved."

### 5.2 Agent Dashboard (Mission Control)

**URL:** `/dashboard`
**Layout:** Left rail (220px, dark) = stage nodes + quick links. Main area = listing cards by stage.

**Left rail:**
- LP logo top
- Stage nodes connected by vertical gold line: New Listing → Draft → Docs Pending → Docs Signed → Shoot Booked → Marketing → MLS Submitted → Live → Closed
- Each node is a circle — empty = no listings, gold fill = has listings, pulsing = has overdue listings
- Below nodes: Quick Links section (Canva, Dot Loop, NTREIS, Sellers Shield, Markful, Training, Revenue Share)

**Main area:**
- Filter bar: All / By Me / Overdue — plus date picker
- Listing cards: full-width horizontal, dark card (`#111`), gold accent on left border for current stage
- Each card shows: address (large, white), listing type badge, photographer date (if booked), doc status pills, days in stage, go-live countdown, quick-action buttons (Continue, View, Share)
- "Start New Listing" button: top right, gold, rounded

**Motion:** Cards slide in from right on load (Framer Motion, staggered). Stage transitions are animated flows.

### 5.3 New Listing — Type Selection

**URL:** `/listing/new`
**Layout:** 3 large selection cards, centered
**Cards:**
1. Listing (Selling) — "Represent the seller, list the property on NTREIS"
2. Buyer Representation — "Represent the buyer, manage their purchase"
3. Lease — "List a rental property or represent a tenant"
Each card: icon (simple line), title, subtitle, "What documents you'll need" expandable. Clicking a card sets the listing type and routes to property search.

### 5.4 Property Search

**URL:** `/listing/[id]/form` (Step 0)

**Implemented:** Single-screen **Find the property** — MLS# or address (+ optional mic). Backend proxies live **NTREIS Matrix RETS** (`POST /rets/search`); not local mock data. On match, auto-advance to 22-section form with gold **from NTREIS** badges.

**Layout:** Centered, clean. Large search input with gold focus ring. Mic icon right side of input.

**States:**
1. Empty: "Enter property address or MLS number" with example placeholder
2. Listening: mic captures speech into search field (browser SpeechRecognition)
3. Searching: spinner — backend queries NTREIS RETS
4. Found: auto-open form with pre-filled fields (~60+ keys from live RETS)
5. Not found: "Property not in MLS yet. Let's fill it together." → open manual form
6. Skip: "Skip search — fill manually" bypasses RETS

**Future (not yet):** Property card preview with photo thumbnail; RESO OData as alternate data path.

### 5.5 Data Review (22-Section Form)

**URL:** `/listing/[id]/review`
**Layout:** Progress bar at top (sections completed). Left: section list nav. Right: active section fields.
**Sections** (matching NTREIS 22-page form, grouped logically):
1. Property Info (type, sub-type, listing agreement)
2. Transaction Details (price, dates, status)
3. Location & Address
4. School District
5. Room Details — Bedrooms
6. Room Details — Bathrooms
7. Room Details — Kitchen & Utility
8. Room Details — Additional
9. Interior Features
10. Security & Appliances
11. Parking & Garage
12. Pool & Outdoor
13. Lot Information
14. Utilities & Heating/Cooling
15. Environmental
16. Financial Info
17. HOA Info
18. Showing Instructions
19. Remarks & Description
20. Agent & Office Info
21. Accessibility & Special Notes
22. Condo/Farm Details (conditional)

**Each section:** Accordion-style, expandable. Pre-filled fields shown in gold if from NTREIS (RETS). Empty required fields highlighted. Voice mode button per section: "Review this section with me" → AI reads values, agent confirms or corrects verbally. Auto-save every 30 seconds. Progress persists between sessions.

### 5.6 Documents (Dot Loop)

**URL:** `/listing/[id]/documents`
**Layout:** Split — left shows required doc list, right shows status.
**Required docs by type:**
- Listing: Listing Agreement, Seller's Disclosure, IABS, Lead Paint Disclosure (if pre-1978), HOA docs
- Buyer: Buyer Representation Agreement, IABS
- Lease: Residential Lease, Pet Addendum (if applicable), IABS

**Flow:**
1. "Create in Dot Loop" button → calls Dot Loop Facade API → creates pre-filled loop → shows "Loop created" with direct link
2. Per-doc status badges: Draft / Sent / Viewed / Signed / Expired
3. Dot Loop webhook updates statuses automatically
4. IABS and Sellers Shield tracked as separate checklist items with redirect buttons

### 5.7 Sign Delivery

**URL:** `/listing/[id]/signs`
**Layout:** Simple step card. "LP Sign Delivery" service info, "Request Installation" button → opens LP Sign Delivery in new tab. Notes field. "Mark as Requested" checkbox.

### 5.8 Photography Booking

**URL:** `/listing/[id]/photography` (agent only)  
**Photographer dashboard:** `/photographer/calendar`

**Layout:** Left — photographer picker + week/month calendar. Right — booking summary panel.

**Booking flow:**
1. Agent selects photographer (preferred tier shown first), date, time, optional access notes
2. **Request Shoot** → creates `bookings` row (`status: pending`), notifies photographer via n8n (email + SMS)
3. Listing **stays at `docs_signed`** until photographer accepts
4. Photographer **Accept shoot date** → `confirmed` → listing advances to **`shoot_booked`**
5. Photographer **Suggest alternate** → `alt_suggested` → agent sees options on **Listing Hub** (`/listing/:id`)
6. Agent accepts an alternate or sends counter-offer → back to `pending` → photographer must accept
7. Two-way notes: `access_notes` (initial request) + `suggested_alternate.note` (negotiation); visible on both sides

**Photographer calendar:** Month/week view, block dates, upcoming shoots table, accept / suggest / mark complete.

**n8n:** `photography-booked-notification.json` — webhook `localpro-photography-booked` → Gmail + Twilio.

**Backend:** `POST /bookings/create`, `GET /bookings/listing/:id`, `POST /bookings/:id/agent-respond`, photographer endpoints under `/bookings/`.

### 5.9 Marketing

**URL:** `/listing/[id]/marketing`
**Layout:** Masonry grid of marketing asset cards.
**Asset types:**
- Social Pack (IG Square + Story) — Free
- Listing Flyer (1-page PDF template) — Free
- Just Listed Postcard (4x6) — $5 (Stripe)
- Open House Kit (flyer + social + email template) — $15 (Stripe)
- Custom Video Reel Script (GROQ-generated) — Free
- Branded Yard Sign (Lowen Sign link) — redirect
- Custom Branded Materials (Markful link) — redirect

**Per asset card:** Preview thumbnail, name, price/free badge, "Open Canva Template" deep-link button, status (Not started / In progress / Done).
**On select:** n8n notifies assigned marketing team group with full property brief (GROQ-generated summary PDF).

**Implemented (Phase 21):** Marketing grid page with asset selection, summary sidebar, link to asset generator. Stripe/Canva on grid page remain stubs.

### 5.9.1 Marketing Asset Generator

**URL:** `/listing/[id]/marketing` → **Create marketing assets →** → `/listing/[id]/marketing-assets`
**Stage:** `marketing` only (agent JWT).

**Flow:**
1. **Photo upload** — up to 25 images, category tags (hero, kitchen, agent headshot, etc.), hero required
2. **Payment** — $80 Stripe UI stub (no real charge yet)
3. **Generate** — tabbed previews: Just Sold (1080×1080), Listing Flyer (8.5×11), Listing Book (multi-page)

**Listing Book pages:** cover, neighborhood guide (GROQ), property details, photo collages by room type, agent bio.

**AI refinement panel:** GROQ rewrite per section — flyer description, flyer footer contact (`Name | Phone | Email`), neighborhood fields, property copy, agent bio. Undo last 3 instructions per section.

**Downloads:** PNG (Just Sold, Flyer), PDF (Flyer single-page, Listing Book full multi-page). Export uses `modern-screenshot` with hidden full-size DOM nodes (preview is CSS-scaled only).

**Agent branding:** Name, phone, email pulled from `public.users` (signup profile). Footer email editable without changing property description.

**Backend:** `POST /listings/{id}/marketing/refine`, `POST /listings/{id}/marketing/neighborhood-guide` (GROQ, `marketing` stage).

**Not yet:** Real Stripe charge, Supabase storage for uploads/generated files, Canva API.

### 5.9.2 Market Yourself Video Generator (HeyGen)

**URL:** `/market-yourself?step=1|2|3|4` (agent JWT; sidebar nav between New Listing and Profile).

**Flow:**
1. **Avatar** — 30s teleprompter recording in browser → Supabase Storage → HeyGen digital twin training → `heygen_avatar_id` on profile. Returning agents can reuse avatar or re-record.
2. **Options** — topic, audience, content style, tone, pacing, background, aspect ratio, CTA, optional context
3. **Script** — GROQ-generated script (edit, regenerate, refine); HeyGen voice selector (default Rachel when available)
4. **Video** — HeyGen `POST /v3/videos`; poll until `completed`; download MP4

**URL persistence:** `step`, `avatar_job_id`, `video_id` query params survive refresh.

**Backend:** HeyGen v3 + GROQ. Requires `HEYGEN_API_KEY`, `GROQ_API_KEY`, public Supabase bucket `agent-avatars`.

**Pricing:** See [HeyGen API pricing](https://developers.heygen.com/docs/pricing).

**Not yet:** Video history DB, Stripe metering, social auto-post.

### 5.10 MLS Submission

**URL:** `/listing/[id]/mls`
**Layout:** Dark, focused. Two-panel — left: instructions + status, right: extension checklist mirror.
**Content:**
1. Extension status indicator — "LP Fill extension detected" (green) or "Extension not installed — download here" (with link)
2. "Open NTREIS Matrix" button (opens ntreis.net in new tab)
3. 22-section checklist synced from extension — shows which pages are complete
4. When 22/22: "All sections complete. Submit when ready in NTREIS." with a confirmation checkbox: "I have submitted this listing on NTREIS."
**Extension download:** Chrome Web Store link + direct .crx download as backup

### 5.11 Go Live

**URL:** `/listing/[id]/golive`
**Layout:** Celebration step. Dark background, gold accents.
**Content:**
1. "Almost there" — shows final checklist (docs signed ✓, shoot done ✓, MLS submitted ✓)
2. AI-generated property description — GROQ output, editable, word count shown
3. Go-live date picker
4. "Mark as Live" — large gold button
**On click:** n8n fan-out: admin email (Gmail), marketing team (Resend), Lofty webhook. Kanban card → Live column. Confetti animation (Framer Motion). "Listing is live" confirmation screen.

---

## 6. Admin Pages

### 6.1 Admin Dashboard
Global Kanban (same Mission Control layout but shows all agents). Filter by agent, stage, date. Stats bar at top.

### 6.2 Agent Approvals
Table of pending sign-ups. Full profile visible. Approve/Reject with one click. Bulk approve. CSV import.

### 6.3 Agent Management
Full roster. Per-agent: edit, suspend, view history, change tier, W-9/IABS status.

### 6.4 Photographer Roster
Add/remove photographers. Tier assignment. Booking history. Block dates.

### 6.5 Marketing Team
Add/remove members. Group assignment (Social / Print / Video). n8n routing control.

### 6.6 Canva Template Library
Add/edit/remove templates. Tag (flyer, social, postcard, open-house). Free vs. Premium. Active/inactive toggle.

### 6.7 Automation Config
**Implemented (partial):** Admin → Automations (`/admin/automations`) — edit milestone email templates per type, iframe preview, **Run now** (n8n webhook), **Sent today** log. Personal dates per agent under Admin → Agents (admin-only).

**Still planned:** n8n workflow list as toggles, plain-English descriptions for all future automations, test-fire per workflow, last 20 n8n execution logs in UI.

### 6.8 Resources
Edit quick-access tiles visible on agent dashboard. Add/remove links (Sellers Shield, UtilityConnect, Revenue Share, Training, etc.).

---

## 7. Chrome Extension (LP Fill)

**Target:** `*.ntreis.net` only. Dot Loop uses the official API.

**Architecture:**
- Background service worker: maintains auth token, fetches active listing data from LP Hub API
- Content script: injected into NTREIS Matrix pages
- Popup: shows which listing is active, link to change
- Sidebar panel: 22-section checklist with completion percentage

**Field mapping:** JSON config fetched from LP Hub backend on each load. Admin can update field selectors without releasing a new extension version.

**Security:** Auth token stored in Chrome's `storage.session` (not localStorage). Cleared on browser close.

---

## 8. n8n Automation Map

| Event | Trigger | Channel | Recipient |
|---|---|---|---|
| New agent signs up | Webhook from FastAPI | Gmail | Admin |
| Agent milestone due (birthday, anniversary, etc.) | n8n schedule 8am + manual webhook | Gmail | Agent |
| Agent searches property (listing form) | Frontend → POST /rets/search | — | Live NTREIS RETS via backend |
| Admin approves agent | DB event | Gmail | New agent (welcome email) |
| Agent books photographer | Webhook | Resend + Twilio | Photographer |
| Photographer suggests alternate date | Calendar update | Resend + Twilio | Agent |
| Dot Loop document signed | DL webhook | Resend | Agent |
| Agent selects marketing package | Webhook | Resend fan-out | Marketing team group |
| MLS submission complete | Webhook | Gmail | Admin |
| Agent marks go live | Webhook | Gmail + Resend | Admin + Marketing + Lofty |
| Stripe payment complete | Stripe webhook | Resend | Agent (receipt) + Marketing team |

**Marketing team fan-out:** n8n reads the group assignment from Supabase, fans out to all members simultaneously. Admin changes group membership in UI — no n8n changes needed.

---

## 9. MLS Data — RETS (live) + RESO (future)

### NTREIS RETS (implemented)

**Endpoint:** Matrix MLS — `https://ntrdd.mlsmatrix.com/rets/`  
**Auth:** HTTP digest (`NTREIS_RETS_USERNAME` / `NTREIS_RETS_PASSWORD` in backend `.env`)  
**Proxy:** `POST /rets/search` on FastAPI — frontend never holds RETS credentials  

**Search patterns:**
```
(ListingId=20439821)
(StreetNumber=13128),(StreetName=Northhaven)
```

**Field mapping:** RETS returns RESO-style SystemNames (`ListPrice`, `BedroomsTotal`, `PublicRemarks`, …) → mapped in `backend/services/rets_service.py` → flat NTREIS `form_data` keys.

### NTREIS RESO OData (future / interim Bridge)

**Endpoint:** NTREIS RESO OData Web API
**Auth:** OAuth 2.0 client credentials flow
**Key query pattern:**
```
GET /Property?$filter=ListingId eq '{mls_number}'
GET /Property?$filter=contains(UnparsedAddress, '{street}') and City eq '{city}'
```

**Field mapping (NTREIS form → RESO standard field names):**
- List Price → `ListPrice`
- Beds → `BedroomsTotal`
- Full Baths → `BathroomsFull`
- Half Baths → `BathroomsHalf`
- SqFt → `LivingArea`
- Year Built → `YearBuilt`
- Subdivision → `SubdivisionName`
- School District → `ElementarySchool`, `MiddleOrJuniorSchool`, `HighSchool`
- Lot Size → `LotSizeAcres`
- Property Type → `PropertyType`
- ...all 200+ fields mapped in `field-mapping.json`

**Interim:** Bridge Interactive (bridgeinteractive.com) — same OData format, API key in 1–3 days.

---

## 10. Cost Summary

| Service | Monthly | Notes |
|---|---|---|
| Supabase Pro | $25 | Upgrade from free after 2 months dev |
| Railway | $5 | FastAPI + n8n self-hosted |
| NTREIS data feed | $20 | One credential, all agents |
| Netlify | $0 | Free tier |
| GROQ | ~$10 | Free tier covers 14,400 req/day |
| Twilio SMS | ~$5 | ~600 SMS/month |
| Resend | $0 | 3,000/month free |
| Gmail SMTP | $0 | Google Workspace already paid |
| Kokoro TTS | $0 | Open source, self-hosted |
| **Total** | **~$65/month** | **For 110+ agents** |

---

## 11. Phase Roadmap

### Phase 1 (Months 1–3) — Core Listing Flow
Auth + approval, Dashboard (Mission Control), Property Search + RESO, Voice Q&A, Data Review (22 sections), Dot Loop API, Photography Booking, Marketing + Canva, Chrome Extension (LP Fill), Go Live, n8n automations, Gmail + Resend email, Twilio SMS.

### Phase 2 (Months 4–6) — CRM + Advanced
Buyer flow, Lease flow, Follow-up Plans (Lofty replacement), CMA tool (RESO data), Google Drive photo link storage, RESO Add/Edit submission (if NTREIS supports), Listing performance tracker, Expiry alerts, PWA (mobile).

### Phase 3 (Month 7+) — Scale
Lead capture integration, Revenue share dashboard, Multi-brokerage white-label.
