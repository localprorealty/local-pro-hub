# Standing Rule: Ban on Agent Self-Testing via Browser Automation

## Rule Statement
**Never open the browser, launch Playwright/Puppeteer, use `browser_subagent`, or run any interactive or headless browser session for visual or UI verification, ever, going forward.**

This rule applies universally across the entire codebase and all future tasks, regardless of whether prior browser tools failed or succeeded.

---

## Approved Verification Protocol

When visual, styling, layout, or browser-based verification is needed:

1. **Perform Static & Code-Level Verification**:
   - Run TypeScript type checks and production builds (`npm run build`).
   - Audit CSS tokens, layout math, and component props directly in code.
   - Run unit tests and backend syntax/compilation checks.
2. **Stop and Request Screenshots from Adarsh**:
   - Do not attempt automated browser launches or headless screenshot capturing.
   - Stop and ask Adarsh to provide screenshots from their real browser session.
   - Clearly specify:
     - Target route (e.g. `/listing/:id/form`)
     - Theme state (Dark vs. Light)
     - Target viewport (e.g. Desktop 1280px vs. Mobile 375px)
     - Specific interactive elements to inspect
3. **Wait for Human Visual Sign-Off**:
   - Visual approval between steps and pages is strictly human-in-the-loop with Adarsh.

---

## Standing Engineering Rules Catalog
- `docs/no_self_browser_verification_rule.md` — Ban on agent self-testing via browser automation / headless browser sessions.
- `docs/no_native_dialogs_rule.md` — Ban on native browser dialogs (`alert()`, `confirm()`, `prompt()`).
- `docs/ai_text_template_rule.md` — Ban on raw character-index text slicing in fixed visual containers.
