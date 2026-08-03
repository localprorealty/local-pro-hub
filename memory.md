# Developer Memory & Revenue Share Sync Lessons Learned

This document records key lessons, constraints, and bugs resolved during the implementation of Feature 3 (Revenue Share & BrokerMint Sync).

---

## 1. BrokerMint API Constraints & Quirks

### 1.1 Custom Fields Creation
- **Behavior**: BrokerMint custom fields (e.g. `RS Credit Toward Cap`, `RS Cash Owed`) **cannot be created via the API**.
- **Lesson**: They must be created manually first via the BrokerMint Settings UI. Once created, they can be read or written to via the `/v1/users/{id}` endpoint in the custom fields block.

### 1.2 PUT /v1/users/{id} Field Wipe
- **Behavior**: The PUT request to update user fields **silently clears/wipes** the user's relationship-style fields—specifically `team`, `Sponsor`, and `Office`—if they are omitted from the update payload.
- **Lesson**: Always fetch the user's current detail via `GET /v1/users/{id}` first, extract these three fields, and merge them into the update payload before executing the PUT call to protect agent metadata.

### 1.3 429 Rate Limit Response
- **Behavior**: BrokerMint's `429 Too Many Requests` response **does not** return a standard `Retry-After` header.
- **Lesson**: Instead, it returns custom header fields:
  - `x-brokermint-burst-limit`
  - `x-brokermint-hour-limit`
  - `x-brokermint-hour-reset` (epoch milliseconds)
  Our code handles this by checking for standard `429` status codes and falling back to a structured exponential backoff (starting at 10.0 seconds and scaling by `1.5x` per retry).

### 1.4 GET /v1/users Query Filter Ignored
- **Behavior**: Sending a query parameter like `/v1/users?id=185390` is silently ignored by BrokerMint's API, which returns the entire users list instead.
- **Lesson**: Always use the explicit path-based endpoint `/v1/users/{id}` to query a single user's detail record.

---

## 2. Revenue Share Calculations

### 2.1 Non-Accumulation Principle
- **Rule**: Cap credit (`RS Credit Toward Cap`) and cash owed (`RS Cash Owed`) must **always be computed fresh from the database from the ground up on every sync**, rather than accumulated over time.
- **Why**: Accumulation introduces drift and double-counting if transactions are updated, voided, or recalculated. Computing them fresh against the agent's active cap cycle ensures 100% mathematical consistency.
