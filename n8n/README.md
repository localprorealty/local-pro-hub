# n8n — LocalPRO automations

**Import workflow files from `n8n/workflows/`:**

| File | Webhook / trigger | Purpose |
|------|-------------------|---------|
| `localpro-automations.json` | `localpro-signup-pending`, `localpro-run-milestones`, daily 8am schedule | Signup alert + milestone emails (three branches, one Active toggle) |
| `photography-booked-notification.json` | `localpro-photography-booked` | Photographer email + SMS on shoot request |
| `listing-go-live.json` | `localpro-listing-live` | Admin + marketing emails + Lofty stub when listing goes live |

**`localpro-automations.json` branches:**

| Branch | Trigger | What it does |
|--------|---------|----------------|
| **Signup** | Webhook `localpro-signup-pending` | Emails admin when a new user signs up |
| **Milestones (scheduled)** | Schedule daily 8am | Sends birthday/anniversary emails to agents; logs to Supabase |
| **Milestones (manual)** | Webhook `localpro-run-milestones` | Same as scheduled branch; triggered from Admin → Automations **Run now** |

Set in `backend/.env`:

```env
N8N_BOOKING_WEBHOOK_URL=http://localhost:5678/webhook/localpro-photography-booked
N8N_GO_LIVE_WEBHOOK_URL=http://localhost:5678/webhook/localpro-listing-live
LOFTY_WEBHOOK_URL=          # optional — forwarded in go-live payload for n8n HTTP node
FRONTEND_URL=http://localhost:5173
```

Activate each workflow in n8n after wiring Gmail SMTP (+ Twilio for photography).

When a new user signs up, Supabase inserts a row into `public.users` with `status = 'pending'`. The signup branch emails you so you can open LocalPRO Hub and approve them.

### Local dev without ngrok

Signup notifications go **FastAPI → n8n on localhost** (not from the browser). You do **not** need ngrok for that path.

1. n8n on `http://localhost:5678`, workflow **Active**
2. Webhook node → **Authentication: None** is fine (only your backend calls it)
3. `backend/.env`:

   ```env
   N8N_SIGNUP_WEBHOOK_URL=http://localhost:5678/webhook/localpro-signup-pending
   ```

4. FastAPI running on `:8000`

ngrok is only needed if **cloud Supabase** must call n8n directly (Database Webhook) — we use the FastAPI proxy instead.

## ⚠️ Why your workflow never fired

**This URL is the n8n editor — it is NOT a webhook:**

```
http://localhost:5678/workflow/8q3LyYH85sBZkUEV   ← wrong (UI only)
```

**You need the Webhook node Production URL**, e.g.:

```
http://localhost:5678/webhook/localpro-signup-pending   ← correct
```

Checklist:

1. Workflow is **Active** (toggle ON in n8n)
2. **`N8N_SIGNUP_WEBHOOK_URL` must match the Webhook node Production URL exactly** (copy from n8n UI — do not guess the path)
3. If you see **404 "webhook is not registered"**: set `WEBHOOK_URL` on the n8n container, then **deactivate and re-activate** the workflow
4. Supabase Database Webhook points to the **webhook URL**, not `/workflow/...`
5. If Supabase is **cloud-hosted**, it cannot reach `localhost` — use **ngrok** (see Part 4)

### Fix 404 "webhook is not registered"

n8n returns this when the production webhook is not listening:

```json
{"message":"The requested webhook \"POST localpro-signup-pending\" is not registered.",
 "hint":"The workflow must be active..."}
```

**Do this in order:**

1. In n8n Docker, set (use your current ngrok URL, trailing slash required):

   ```env
   WEBHOOK_URL=https://unappliable-francine-evincible.ngrok-free.dev/
   ```

2. **Restart** the n8n container.

3. Open your workflow → turn **Active** OFF → turn **Active** ON again.

4. Click the **Webhook** node → **Production** tab → copy the full URL shown there.

5. Paste that **exact** URL into `backend/.env`:

   ```env
   N8N_SIGNUP_WEBHOOK_URL=<paste Production URL here>
   ```

6. Restart FastAPI (`python main.py`).

7. Test:

   ```bash
   curl -X POST http://localhost:8000/internal/notify-signup-pending \
     -H "Content-Type: application/json" \
     -d '{"record":{"id":"1","email":"a@b.com","full_name":"T","phone":"1","mls_id":"1111111","license_number":"1","photographer_tier":"basic"}}'
   ```

   Expect `{"ok":true}`. Check n8n **Executions**.

### CORS error from the browser (OPTIONS 500)

Browsers **cannot** POST directly to ngrok/n8n — you get `CORS policy` / `OPTIONS 500`.

**Fix:** signup notifications go through **FastAPI** (server → n8n, no CORS).

1. Add to **`backend/.env`**:

```env
N8N_SIGNUP_WEBHOOK_URL=https://unappliable-francine-evincible.ngrok-free.dev/webhook/localpro-signup-pending
```

2. Start the API:

```bash
cd backend && source venv/bin/activate && python main.py
```

3. Keep `VITE_API_BASE_URL=http://localhost:8000` in **`frontend/.env`**.

4. Restart `npm run dev`. Signup → frontend → `:8000/internal/notify-signup-pending` → ngrok → n8n.

Do **not** set `VITE_N8N_SIGNUP_WEBHOOK_URL` on the frontend.

---

## Orphan auth users (email “already registered”)

Supabase has **two** user stores:

| Table | What it is |
|-------|------------|
| `auth.users` | Login identity — signup checks this |
| `public.users` | App profile — admin panel shows this |

Deleting only `public.users` leaves `auth.users` → same email cannot sign up again.

**Fix in Supabase SQL Editor** (replace email):

```sql
-- Removes auth login + profile (cascade)
delete from auth.users where email = 'test3@localprorealty.com';
```

Or use **Delete** in Admin → Rejected tab (after running migration `005_admin_delete_user.sql`).

---

```
Signup (Supabase Auth)
    → trigger handle_new_user()
    → INSERT public.users (status: pending)
    → Supabase Database Webhook (HTTP POST)
    → n8n Webhook (localhost:5678)
    → IF pending
    → Gmail SMTP email to admin
    → You click link → http://localhost:5173/login → /admin/approvals
```

## Part 1 — Gmail SMTP (not an “API key”)

Gmail does **not** give you a simple API key for sending mail via SMTP. You use either:

| Method | Best for |
|--------|----------|
| **App Password** (recommended) | Personal/workspace Gmail + n8n SMTP node |
| **Google OAuth2** | n8n “Gmail” node (more setup) |

### App Password steps (recommended)

1. Use a Google account you control (e.g. `you@gmail.com` or Google Workspace).
2. Turn on **2-Step Verification**:  
   [https://myaccount.google.com/security](https://myaccount.google.com/security) → 2-Step Verification → On.
3. Create an **App Password**:  
   [https://myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)  
   - App: **Mail**  
   - Device: **Other** → name it `n8n LocalPRO`  
   - Google shows a **16-character password** (e.g. `abcd efgh ijkl mnop`) — copy it once.
4. That 16-character string is what n8n uses as the SMTP password — **not** your normal Gmail password.

### SMTP settings for n8n

| Field | Value |
|-------|--------|
| Host | `smtp.gmail.com` |
| Port | `465` (SSL) **or** `587` (STARTTLS) |
| User | Your full Gmail address |
| Password | The 16-char App Password (no spaces) |
| Secure | SSL/TLS on (465) or STARTTLS (587) |

---

## Part 2 — n8n credentials (Docker on :5678)

1. Open n8n: [http://localhost:5678](http://localhost:5678)
2. **Settings → Credentials → Add credential**
3. Search **SMTP** → create **SMTP account**:
   - Name: `Gmail SMTP — LocalPRO`
   - User: `your@gmail.com`
   - Password: App Password from Part 1
   - Host: `smtp.gmail.com`
   - Port: `465`
   - SSL/TLS: enabled
4. Save.

Optional env vars on your n8n Docker container (so the workflow can read them):

```env
GMAIL_USER=your@gmail.com
LOCALPRO_ADMIN_EMAIL=admin@localprorealty.com
LOCALPRO_APP_URL=http://localhost:5173
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
```

Example `docker run` snippet:

```bash
docker run -d --name n8n \
  -p 5678:5678 \
  -e GMAIL_USER=your@gmail.com \
  -e LOCALPRO_ADMIN_EMAIL=admin@localprorealty.com \
  -e LOCALPRO_APP_URL=http://localhost:5173 \
  -e SUPABASE_URL=https://YOUR_PROJECT.supabase.co \
  -v n8n_data:/home/node/.n8n \
  n8nio/n8n
```

---

## Part 3 — Import and run (step by step)

### Prerequisites

1. **Supabase:** run migration `008_agent_milestones.sql` in SQL Editor (required for milestone branch + Admin → Automations).
2. **Gmail App Password** — see Part 1 below.
3. **n8n running** on `http://localhost:5678` (Docker or desktop).

### Will importing break my existing workflow?

**Import alone does not change or delete anything** — it adds a **new** workflow next to your old one.

| Situation | What to do |
|-----------|------------|
| **First time** | Import `localpro-automations.json` → wire credentials → Activate |
| **Already have old signup workflow active** | Import the new file → wire credentials on the **new** workflow → **Deactivate** the old workflow → **Activate** the new one → delete the old workflow in n8n UI (optional cleanup) |
| **Same webhook path** | Both use `localpro-signup-pending`. Only **one** active workflow should own that path — deactivate the old one before activating the new one, or signup emails may hit the wrong flow |

Your `N8N_SIGNUP_WEBHOOK_URL` in `backend/.env` stays the same if the webhook path is unchanged:

```
http://localhost:5678/webhook/localpro-signup-pending
```

Local dev: use localhost (no ngrok). Production: use your public n8n URL + same path.

### Step 1 — Credentials (once per n8n instance)

1. **Gmail SMTP — LocalPRO** — Part 2 below (signup + milestone emails).
2. **Supabase (milestone HTTP nodes only)** — see **Supabase headers for milestone nodes** below.

> **Webhook auth vs Supabase auth:** The **Webhook — Signup pending** node can use **Authentication: None** (only FastAPI calls it). The **Fetch due milestones** and **Log milestone email** nodes must send Supabase API keys — **None will fail** with `No API key found in request`.

### Supabase headers for milestone nodes (required)

Supabase REST/RPC always needs your **service role** key (same as `SUPABASE_SERVICE_KEY` in `backend/.env` — **not** the anon key).

**On both `Fetch due milestones` and `Log milestone email` nodes:**

1. **Method:** POST (already set)
2. **URL:** `https://YOUR_PROJECT.supabase.co/rest/v1/rpc/get_milestones_due_on` (or use `={{ $env.SUPABASE_URL }}/rest/v1/rpc/get_milestones_due_on` if `SUPABASE_URL` is set on n8n)
3. **Authentication:** None (if you add headers manually below) — OR Generic Credential Type → Header Auth (only covers one header; manual headers are easier)
4. Turn **Send Headers** **ON**
5. Add **Header Parameters**:

| Name | Value |
|------|--------|
| `apikey` | Your **service_role** key (long JWT from Supabase → Settings → API) |
| `Authorization` | `Bearer <same service_role key>` |
| `Content-Type` | `application/json` |

6. **Send Body** ON, JSON body `{}` for Fetch (already set)

Repeat the same headers on **Log milestone email** (URL ends with `/rest/v1/milestone_email_log`).

**Where to get the key:** Supabase Dashboard → **Project Settings** → **API** → `service_role` (secret). Copy from `backend/.env` as `SUPABASE_SERVICE_KEY`.

### Step 2 — Import workflow

1. n8n → **Workflows** → **Import from file**
2. Choose `n8n/workflows/localpro-automations.json`
3. Open the imported workflow **LocalPRO — All Automations**

### Step 3 — Wire nodes

| Node | What to set |
|------|-------------|
| Webhook — Signup pending | Authentication: **None** (OK) |
| Send Email — Signup (Gmail) | Gmail SMTP credential |
| Send Email — Milestone (Gmail) | Gmail SMTP credential |
| Fetch due milestones | **Supabase headers** (see above) — not None |
| Log milestone email | **Supabase headers** (see above) — not None |

### Step 4 — Environment variables (n8n Docker / container)

```env
GMAIL_USER=your@gmail.com
LOCALPRO_ADMIN_EMAIL=admin@localprorealty.com
LOCALPRO_APP_URL=http://localhost:5173
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
```

If using ngrok for cloud Supabase webhooks, also set:

```env
WEBHOOK_URL=https://YOUR-NGROK-ID.ngrok-free.dev/
```

Restart n8n after changing `WEBHOOK_URL`, then toggle the workflow off/on.

### Step 5 — Backend env

In `backend/.env`:

```env
N8N_SIGNUP_WEBHOOK_URL=http://localhost:5678/webhook/localpro-signup-pending
N8N_MILESTONE_WEBHOOK_URL=http://localhost:5678/webhook/localpro-run-milestones
```

Copy the **exact** Production URLs from the webhook nodes if different.

Restart FastAPI after editing.

**Admin → Automations → Run milestone emails now** calls `POST /admin/automations/run-milestones` → n8n **production** webhook `localpro-run-milestones` (with `force: true` to resend same day for testing).

### Test URL vs production URL (Run now / signup)

| URL | Works when | Used by |
|-----|------------|---------|
| `http://localhost:5678/webhook-test/localpro-run-milestones` | You clicked **Listen for test event** in n8n editor | Manual test in n8n only |
| `http://localhost:5678/webhook/localpro-run-milestones` | Workflow toggle **Active** ON | FastAPI `N8N_MILESTONE_WEBHOOK_URL` |

**Run now** from the admin app must use **production** (`/webhook/`). If you get 404 "webhook is not registered", turn the workflow **Active** ON in n8n (top-right toggle), then copy the **Production** tab URL from **Webhook — Run milestones now**.

If n8n fails, the API returns **502** (not 200) with the n8n error message.

### Step 6 — Activate

1. If an old signup-only workflow is active → turn it **OFF**
2. Turn **LocalPRO — All Automations** **ON** (one toggle runs signup webhook + daily schedule)

### Step 7 — Test signup branch

```bash
curl -X POST http://localhost:8000/internal/notify-signup-pending \
  -H "Content-Type: application/json" \
  -d '{"record":{"id":"1","email":"a@b.com","full_name":"Test Agent","phone":"2145550100","mls_id":"1234567","license_number":"TX-1","photographer_tier":"basic"}}'
```

Expect `{"ok":true}`. Check n8n **Executions** and your admin inbox.

Or hit the webhook directly:

```bash
curl -X POST http://localhost:5678/webhook/localpro-signup-pending \
  -H "Content-Type: application/json" \
  -d '{
    "type": "INSERT",
    "table": "users",
    "record": {
      "email": "newagent@example.com",
      "full_name": "Test Agent",
      "mls_id": "1234567",
      "phone": "(214) 555-0100",
      "status": "pending"
    }
  }'
```

### Step 8 — Test milestone branch (optional)

1. Run `supabase/seeds/agent_milestones_seed.sql` (or add a milestone in **Admin → Agents** with today’s month-day).
2. In n8n, open the workflow → click **Execute workflow** on **Schedule — Daily 8am** (manual test run).
3. Check **Executions** — should email matching agents and write `milestone_email_log`.

Daily production run: automatic at 8:00 server time when workflow is Active.

### Fix: Log milestone email sends literal `{{ $json.user_id }}`

**Why it’s “not in sync”:** After **Send Email — Milestone (Gmail)**, `$json` is SMTP output (`accepted`, `messageId`, …) — not `user_id` / `milestone_id`. The `{{ $json.user_id }}` text is also **not evaluated** in plain JSON mode.

**Fix (2 nodes):**

**A) Add Code node** between email send and log — name it **Prepare log payload**:

```javascript
const m = $('Render milestone emails').item.json;
return [{
  json: {
    user_id: m.user_id,
    milestone_id: m.milestone_id,
    sent_on: m.sent_on,
  },
}];
```

Wire: `Send Email — Milestone (Gmail)` → **Prepare log payload** → `Log milestone email`

**B) Log milestone email** — JSON body in **expression** mode (`=`):

```
={{ JSON.stringify($json) }}
```

Now `$json` on the log node is `{ user_id, milestone_id, sent_on }` with real UUIDs.

Re-import `localpro-automations.json` (includes this node) or add it manually in your current workflow.

---

## Part 4 — Supabase Database Webhook

### Important: hosted Supabase vs local

| Supabase | n8n on localhost:5678 |
|----------|-------------------------|
| **Cloud** (supabase.com project) | Cannot reach `localhost` on your Mac. Use a **tunnel** (ngrok, Cloudflare Tunnel) or run n8n on a public URL. |
| **Local** (`supabase start`) | Webhook can target `http://host.docker.internal:5678/webhook/...` if Supabase runs in Docker on the same machine. |

### Cloud Supabase + local n8n (typical dev setup)

1. Install ngrok: [https://ngrok.com](https://ngrok.com)
2. Expose n8n:

   ```bash
   ngrok http 5678
   ```

3. Copy the HTTPS URL, e.g. `https://abc123.ngrok-free.app`
4. Your webhook URL becomes:

   ```
   https://abc123.ngrok-free.app/webhook/localpro-signup-pending
   ```

5. In **Supabase Dashboard** → **Database** → **Webhooks** → **Create webhook**:
   - **Name:** `notify-n8n-signup-pending`
   - **Table:** `public.users`
   - **Events:** `INSERT`
   - **Type:** HTTP Request
   - **Method:** POST
   - **URL:** ngrok URL above
   - **HTTP Headers** (optional but recommended):

     ```
     Content-Type: application/json
     ```

6. Save.

Every new signup inserts into `users` → Supabase POSTs to n8n → email fires.

### Optional: filter only pending in Supabase

Supabase webhooks fire on every `INSERT`. The workflow already has an **IF status is pending** node, so non-pending inserts are ignored.

---

## Part 5 — End-to-end test

1. Frontend running: `cd frontend && npm run dev` → [http://localhost:5173](http://localhost:5173)
2. n8n workflow **Active**
3. ngrok running (if using cloud Supabase)
4. Sign up a new test user on `/signup`
5. Check your admin inbox (`LOCALPRO_ADMIN_EMAIL`)
6. Click **Log in as admin** → sign in with `admin@localprorealty.com`
7. Go to **Approvals** (or open `/admin/approvals`) → approve the user

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| No email | Check n8n **Executions** tab for errors |
| Gmail “Authentication failed” | Regenerate App Password; use port 465 + SSL |
| Webhook never fires | Confirm Supabase webhook URL is reachable (ngrok for cloud) |
| “Connection refused” from Supabase | Do not use bare `localhost` from cloud — use ngrok |
| Email links don’t work on phone | `localhost` only works on your machine; use ngrok for frontend too or deploy |

---

## Security notes

- Never commit App Passwords or `.env` files.
- Rotate App Passwords if leaked.
- In production, use a dedicated sender (`noreply@yourdomain.com`) via Google Workspace or Resend instead of personal Gmail.
- Add a shared secret header on the Supabase webhook and validate it in n8n (optional hardening — add an **IF** node comparing `$json.headers['x-localpro-secret']`).

---

## Agent milestone branch (daily)

Sends personalized HTML emails to agents on birthdays, work anniversaries, children's birthdays, etc. Each `milestone_type` uses a different template editable in **Admin → Automations**.

Requires migration `008_agent_milestones.sql` and the milestone branch nodes in `localpro-automations.json`.

### How it works

| Step | What happens |
|------|----------------|
| Schedule | Runs daily at 8:00 (server timezone) |
| RPC | `get_milestones_due_on()` returns active agents with matching month-day (respects `send_lead_days`) |
| Render | Code node replaces `{{agent_name}}`, `{{person_name}}`, `{{custom_label}}`, `{{years}}` in templates |
| Send | Gmail SMTP to agent email |
| Log | Inserts `milestone_email_log` to prevent duplicate sends same day |

### Milestone types → templates

| `milestone_type` | Use case |
|------------------|----------|
| `agent_birthday` | Agent's own birthday |
| `work_anniversary` | Joined brokerage |
| `wedding_anniversary` | Wedding anniversary |
| `spouse_birthday` | Spouse birthday (uses `person_name`) |
| `child_birthday` | Child birthday (uses `person_name`) |
| `home_purchase_anniversary` | Property anniversary (uses `custom_label` for address) |
| `license_renewal` | TREC renewal reminder |
| `custom` | Other (uses `custom_label`) |

Admins add dates per agent under **Admin → Agents → Edit user → Personal milestones**. Templates are edited under **Admin → Automations**.

Optional seed: `supabase/seeds/agent_milestones_seed.sql` for `test@localprorealty.com`.

---

## Files

| File | Purpose |
|------|---------|
| `n8n/workflows/localpro-automations.json` | Single workflow — signup webhook + daily milestone emails |
| `n8n/workflows/photography-booked-notification.json` | Shoot request → photographer email + SMS |
| `n8n/workflows/listing-go-live.json` | Listing live → admin email, marketing brief, Lofty HTTP stub |
| `n8n/README.md` | This guide |
