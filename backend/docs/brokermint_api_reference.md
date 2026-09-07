# BrokerMint API Reference — LocalPRO Hub

Official docs: https://my.brokermint.com/api_docs

This file combines BrokerMint's official API documentation with our project's
confirmed, hard-won gotchas. When in doubt, the official docs are the source
of truth for *what the API accepts*; the "Our Confirmed Gotchas" sections are
the source of truth for *what actually works reliably in practice*.

---

## Basics

- Base URL: `https://my.brokermint.com/api`
- Auth: `api_key` query param on every request (not a header)
- Content-Type: `application/json` required on POST/PUT bodies
- Versions in use: **v1** (transactions, contacts, participants — all our
  current create calls), **v2** (transaction/contact reads, flat custom
  field shape), **v3** (current/recommended, not yet adopted by us)

### Rate limits
- 100 requests / 10 seconds (burst)
- 2000 requests / hour
- 100 failed requests / hour (after this, ALL requests blocked until next hour)
- Watch response headers: `X-Brokermint-Burst-Remaining`, `X-Brokermint-Hour-Remaining`,
  `X-Brokermint-Hour-Reset` (13-digit unix ms timestamp)
- 429 response = rate limited, must wait for reset

---

## Transactions

### Create (`POST /v1/transactions`) — what we currently use
Required: `address`, `city`, `state`, `zip`, `price`, `status`,
`listing_side_representer`, `buying_side_representer`
Our shape: `custom_attributes` as nested array
`[{type, label, name, value, options}]` — confirmed necessary; flat
shorthand silently drops labels and drops dropdown values entirely.

### v2/v3 alternative shape (NOT what we use, but documented)
v2 and v3 accept custom fields as **flat top-level keys** instead:
```json
{ "MLS #": "IR28020198", "Property Type": "Single Family" }
```
We have not migrated to this — our v1 nested-array approach is what's
actually running in production. Do not mix shapes in the same payload.

### Update
`PUT /v1|v2|v3/transactions/{id}` exists in the docs but **we do not call
it anywhere**. We only create once; BrokerMint is source of truth after
that (by design, not oversight).

⚠️ `custom_attributes` on update is a **full replacement**, not a merge —
sending a partial array would wipe unlisted fields. Relevant if we ever
add update support.

### Schema discovery (not yet used by us — should be)
`GET /v3/transactions/schema` — returns every field (built-in + custom)
configured for THIS account, live. Use this instead of hardcoding field
names/labels from a single observed payload.

`GET /v1/accounts/{id}/settings/transaction_participant_roles` — real,
current list of valid role strings for this account.

---

## Contacts

### Create (`POST /v1/contacts`) — what we use
Flat payload: `first_name`, `last_name`, `email`, `phone`, etc.
`custom_attributes` optional nested array (v1) or flat keys (v2).

### Update
`PUT /v1/contacts/{id}` exists but **we never call it**.

### Delete
`DELETE /v1/contacts/{id}` — returns 400 if the contact has active
references (assigned to transactions, commission payments). Used in our
test cleanup scripts.

---

## Participants

- `POST /v1/transactions/{txn_id}/participants/users` — add/update a user
  participant. Body: `{id, role, owner}`. Setting `owner: true` unassigns
  ownership from whoever previously had it (only one owner allowed).
- `POST /v1/transactions/{txn_id}/participants/contacts` — same, for
  contacts. Body: `{id, role}`.
- `preserve_existing_role: true` flag prevents overwriting an existing
  role on repeat calls — but does **not** let one person hold two roles.

### ⚠️ Our Confirmed Gotcha
Calling this endpoint twice for the same person with two different roles
does NOT create two participant entries — **the second call silently
overwrites the first's role**. Fix: one call with a single
comma-combined role string, e.g. `"office administrator, cda administrator"`.
Confirmed this is the only reliable way — the API has no native
multi-role-per-person support.

---

## Checklists

- `GET /v1/transactions/checklist_templates` — list available templates
  account-wide (use this to verify our hardcoded IDs are still valid,
  instead of trusting memory)
- `POST /v1/transactions/{id}/checklists` — add one checklist by
  `checklist_template_id`
- `POST /v1/transactions/{id}/checklists/batch_add` — add multiple at once
  via `checklist_template_ids` array

Our current mapping (verify periodically against the live template list):
`listing → 3301356`, `lease → 3317147`

---

## Commissions

Minimal required set per transaction: `tgc` (total gross commission),
`award_distribution`, `award_allocation`, `sales_volume` — one
`award_distribution` per side, one `award_allocation`/`sales_volume`/`split`
per side+payee combination.

Correct dollar field to read: **`calculated_dollar_amount`** (not `split`,
not `award_allocation` — those are input percentages, not resolved dollars).

`split` items support `sliding_base` (e.g. `"company dollar contribution"`)
— this is the field that should map to our cap-progress tracking logic.

- `PUT /v1/transactions/{id}/commissions` — **full replacement** of all
  commission items, not a merge.
- `POST /v1/transactions/{id}/commissions/finalize` — locks commissions.

---

## Webhooks (not yet implemented — candidate for replacing manual sync)

- Max 5 subscriptions per account
- Must respond 200 within 10 seconds or BrokerMint retries (5, 10, 15, 30,
  60, 120 min intervals, then deactivates after 6 failures)
- Verify authenticity via `X-Brokermint-Webhook-Signature` header
  (HMAC-SHA256 using the subscription's `secret_token` — only shown once
  at creation)
- **No delivery-order guarantee**, and duplicate/out-of-order delivery is
  possible — must be idempotent on our end
- Relevant event types for us: `transaction.created`, `transaction.updated`,
  `transaction.participant.added/updated/removed`

Potential use: replace the manual "Run Sync Now" full-account sync with
real-time per-transaction updates. Not yet built — would need a new
public callback endpoint on our Railway backend plus signature
verification logic.

---

## Users (agents)

- `GET /v1/users/schema` — live field schema, same purpose as the
  transaction schema endpoint
- `Sponsor` field (custom, string) stores the upline agent's name as
  free text — **not a foreign key**, so name-matching logic is required
  and WILL produce ambiguous/unmatched cases. See our
  `sponsor_resolution_log` table for real examples of this in production.
- `anniversary_date` — used for cap-year reset logic, distinct from
  calendar year

---

## Things we've confirmed the API does NOT support

- No API for attaching/filling/e-signing documents — only works through
  BrokerMint's own UI ("Use forms" feature). No workaround exists.
- No SSO for our specific account setup (confirmed broken, do not retry).
- `transaction_name` is write-only — saves and displays in BrokerMint's
  UI, but never appears in any GET response. Can only be verified by eye.
- `"representing": "both"` silently reverts to `"seller"` — no error.
- Blank fields are sometimes omitted entirely from GET responses (no key
  at all) rather than returned as `null` — a single sampled transaction
  will UNDERCOUNT the true field list. Use the schema endpoints instead.

---

## Open questions for us to resolve

1. Should we migrate transaction/contact creation from v1 to v3? (v1 is
   marked deprecated in the docs; currently still functional)
2. Should webhooks replace manual full-account sync?
3. Are all 16 rows in `sponsor_resolution_log` correctly falling back to
   Deana Custer, or should ambiguous cases block payout calculation
   entirely until a human resolves them?
