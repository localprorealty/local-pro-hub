# Resend Domain Verification Pending Guide

**Date Created:** September 9, 2026  
**Status:** Deferred Pending Domain Migration  
**Feature:** External Photographer Vendor Flow — Resend Fallback Dispatch (Backlog Item #4)

---

## 1. Overview & Current Status

The backend and frontend code for the **Resend fallback path** in the External Photographer Vendor flow is **100% complete and verified**.

When an agent does not have a Google App Password connected, the backend automatically dispatches vendor order requests through Resend.

### Verification Milestone Completed
- End-to-end code path verified via Resend sandbox domain (`onboarding@resend.dev`) to account owner (`admin@localprorealty.com`).
- Delivery status confirmed **delivered** with Amazon SES Message ID:
  `<010001a085407d0b-6d3029f5-6778-47d8-88fa-650c65c8383d-000000@email.amazonses.com>`.
- Verified formatting:
  - From: `{agent_name} via LocalPRO Hub <...>`
  - Reply-To: `{agent_email}`
  - CC: `{agent_email}` (enabled automatically on custom domain sends)
  - Full property specs, pricing, target dates, and custom agent notes intact.

---

## 2. Dependency: Netlify Domain Migration

Full external delivery (to any external photographer or dispatcher address such as `orders@photographer.com` or `g.adarsh043@gmail.com`) requires domain verification for `localprorealty.com`.

Until `localprorealty.com` is verified in Resend, attempting to send from `@localprorealty.com` or to external recipients via sandbox will be rejected by Resend's API with:
> `resend.exceptions.ResendError: The localprorealty.com domain is not verified. Please, add and verify your domain on https://resend.com/domains`

This step is **deferred pending Adarsh completing the Netlify domain migration**.

---

## 3. Post-Migration Activation Checklist

Once the Netlify domain migration is complete, perform the following steps to activate live external sending:

1. **Add Domain in Resend**:
   - Go to [resend.com/domains](https://resend.com/domains).
   - Click **Add Domain** and enter `localprorealty.com`.

2. **Add DNS Records**:
   - Add the DKIM, SPF, and MX records provided by Resend into your active DNS manager (e.g. Netlify DNS or Cloudflare).
   - Wait for Resend status to show `Verified` (typically 1–10 minutes).

3. **Verify Environment Variables**:
   - In `backend/.env` and Railway production variables:
     ```bash
     RESEND_API_KEY=re_...
     RESEND_FROM_EMAIL=LocalPRO Hub <notifications@localprorealty.com>
     ```

4. **Zero Code Changes Needed**:
   - The backend `backend/routers/vendors.py` is already wired to parse `settings.resend_from_email` and attach `{agent_name} via LocalPRO Hub <notifications@localprorealty.com>` as the `From` header, with the agent's real email as `Reply-To` and `CC`.
