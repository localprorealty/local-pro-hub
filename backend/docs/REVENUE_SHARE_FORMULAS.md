# Revenue Share (Growth Club) — Formulas & Rules Reference

All numeric values below are the current defaults, live in `revenue_share_settings`,
and are editable by an admin without a deploy. Rates are already converted to be
against the FULL `COMPANY_SPLIT` commission amount — not the deck's "% of RSP"
framing, which is halved (RSP = 50% of `COMPANY_SPLIT`). See the "Rate conversion"
section below before ever touching these numbers.

## 1. Generation rates, bonuses, and caps (defaults)

| Gen | Rate (of COMPANY_SPLIT) | Completion bonus (once/cap year) | Max payout per downline agent/year | Unlocks with |
|---|---|---|---|---|
| 1 | 13.75% | $1,000 | $3,200 | automatic |
| 2 | 5.31%  | $750  | $1,600 | 10 eligible Gen-1 agents |
| 3 | 1.875% | $500  | $800   | 15 |
| 4 | 1.565% | $750  | $1,000 | 20 |
| 5 | 2.5%   | $1,000| $1,400 | 25 |

### Rate conversion (why 13.75%, not 27.50%)

The Growth Club deck presents rates as "% of the Revenue Share Pool," and the
RSP is itself only 50% of the real `COMPANY_SPLIT` dollar amount (the other 50%
goes to LocalPRO operations). So:

```
effective_rate = deck_rate x 50%
```

Example: Gen 1 deck rate 27.50% x 50% = **13.75%**, which is the number that
actually belongs in code, since our formula multiplies directly against the
full `COMPANY_SPLIT` amount pulled from BrokerMint.

## 2. Earnings calculation (per commission item, per generation)

For every `COMPANY_SPLIT` commission item on a transaction closed on/after
launch day:

```
amount = commission.calculated_dollar_amount x gen{N}_rate
```

Capped so the running total for `(recipient, contributing_agent, generation,
cap_year)` never exceeds `gen{N}_max_payout`.

## 3. Eligibility (to receive revenue share)

An agent is eligible if **all** of:
- `active = true` in BrokerMint (or `eligibility_override = true` in `agent_overrides`)
- `cap_override ?? BrokerMint Goal amount >= min_cap_amount` (default $16,000)
- Within `grace_period_months` (default 6) of registration, **or** has
  `>= production_min_transactions` (default 1) closed transactions in the
  trailing `production_window_months` (default 6)
- `cash_override = true` skips the cap/production checks above, but never
  skips the `active` check

## 4. The sponsor walk (generations 1-5)

Starting from the contributing agent's resolved sponsor:
1. If there's no sponsor, or the sponsor is the agent's own node (self-sponsor,
   e.g. Tricia), **stop the walk entirely** - this is intentional, not a bug.
2. If the current sponsor fails eligibility (S3): **skip paying them, but
   keep walking up past them** - the chain does not stop just because one
   node is ineligible. A suspended Gen-1 sponsor doesn't block a Gen-2 payout
   to whoever sponsored them, provided that sponsor is themselves eligible
   and has that generation unlocked.
3. For generation 2+, the sponsor also needs that generation **unlocked**:
   `count(eligible direct Gen-1 agents) >= gen{N}_unlock_count`.

## 5. Completion bonus

Fires once per `(contributing_agent, recipient, generation, cap_year_start)`
the first time the contributing agent's real BrokerMint cap progress reaches
their cap amount for that cap year. Re-fires naturally every new cap year
(different `cap_year_start`). Amount = `gen{N}_completion_bonus` for whichever
generation the recipient is at relative to the capping agent.

## 6. Credit vs. cash split (Tricia's ledger)

**Recomputed fresh every time - never accumulated.** This is the single most
important rule in this whole feature; walk through the Maria Hunt worked
example in the project history if this ever needs re-deriving from scratch.

```
remaining_room        = max(cap_amount - real_cap_progress_from_brokermint, 0)
total_rs_earned        = sum(unpaid + paid earnings and bonuses this cap year)
rs_credit_toward_cap   = min(total_rs_earned, remaining_room)
rs_cash_owed           = (total_rs_earned - rs_credit_toward_cap) - total_rs_already_paid_cash
```

`real_cap_progress_from_brokermint` is read live on every sync. As it climbs
from the agent's own real production, `remaining_room` shrinks - dollars that
were sitting in "credit" convert to "cash owed" automatically, with no manual
action needed. Nothing is ever double-counted because this is a fresh
calculation each time, not a running total with additions.

`total_rs_already_paid_cash` comes from summing `revenue_share_payment_contributions`
linked through `revenue_share_payments` where `status = 'paid'` - this is what
prevents re-counting an already-paid amount as owed again next cycle.

## 7. BrokerMint sync fields

Two custom User Fields, written via `PUT /v1/users/{id}`, recomputed fresh
using the formula in S6, on every full sync and immediately after any payment
is marked paid:

- `RS Credit Toward Cap` - current `rs_credit_toward_cap`
- `RS Cash Owed` - current `rs_cash_owed`

These are **visibility only** - writing to them does not change how
BrokerMint's own commission-split engine calculates real splits on the
agent's next transaction. Real cap enforcement (accounting for revenue share)
only happens inside our own app's numbers.

**Important BrokerMint write behavior**: `PUT /v1/users/{id}` silently clears
any relationship-style field (`team`, `Sponsor`, `Office`) that isn't included
in the payload, even though BrokerMint's docs suggest partial updates are
safe. Always fetch-and-merge these three fields before any write - see
`update_bm_user_custom_fields` in `brokermint_service.py`.

## 8. Sponsor resolution

BrokerMint's `Sponsor` field is plain text (a name), not an ID. Resolution:
- Exact one-to-one name match -> use it.
- Zero or 2+ matches -> default to Deana Custer (the fixed, always-zero-earning
  placeholder), log to `sponsor_resolution_log` for admin review.
- `agent_overrides.sponsor_override`, if set, always wins.

## 9. Cap year

An agent's "cap year" runs from their `Cap Start Date` (in BrokerMint) through
the following year, resetting on that anniversary - not the calendar year.
All the "per cap year" resets above (completion bonus, max payout ceiling,
`total_rs_earned` in the credit/cash formula) key off this, not Jan 1.
