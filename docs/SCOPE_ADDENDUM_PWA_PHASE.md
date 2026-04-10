# Scope addendum — borrower channel (PWA-first phase)

Use this as a **written alignment** with the client alongside the original execution plan. It does not replace the master agreement; it **narrows and clarifies** deliverables for the current phase.

## Change: native apps → installable PWA

**Original plan (summary):** Borrower mobile applications for Android and iOS (store-distributed native apps).

**Agreed adjustment for this phase:** Deliver borrower-facing functionality as a **Progressive Web App (PWA)**:

- One web codebase, installable from the browser (“Add to Home Screen” / install prompt).
- **Marketing / information** may remain available in a normal browser tab.
- **Apply, sign-in / account creation, and signed-in borrower dashboard** are intended to run in the **installed** PWA when `VITE_BORROWER_WEB_INSTALL_GATE` is enabled in production (see [`src/components/common/BorrowerInstallGate.tsx`](../src/components/common/BorrowerInstallGate.tsx)).

**Client acknowledgment (checkbox in your pack):**

- [ ] Native **Play Store / App Store** apps are **out of scope for this phase** unless separately budgeted.
- [ ] PWA meets the business need for “an app on the phone” for borrowers for this phase.

## Acceptance criteria — channels (explicit)

| Channel | Acceptance (this phase) | Notes |
|--------|-------------------------|--------|
| **Web push (PWA)** | User can opt in; subscription stored in `push_subscriptions` (existing schema); ops can send via [`send-web-push`](../supabase/functions/send-web-push/README.md) using VAPID secrets. | iOS/Safari has stricter rules than Android; **test on real devices**. |
| **SMS** | Follow existing Supabase functions / providers (e.g. `send-sms`, `excite-sms`). | Treat delivery and templates as **existing** unless the contract lists new SMS stories. |
| **Email** | Follow existing notification / Brevo paths. | Same as above. |
| **WhatsApp** | Only if already integrated in this codebase and listed in contract; otherwise **separate** line item with template + provider acceptance. | Do not imply “full WhatsApp parity” without a signed subset. |

## Production readiness wording (stakeholder-safe)

Approved phrases:

- “**Stabilization and hardening** — defect fixes and regression testing before go-live.”
- “**Borrower channel:** PWA-first for this phase, with optional native apps later if agreed.”
- “**Push:** infrastructure is in place; go-live requires VAPID secrets, device testing, and operational runbooks.”

Avoid until true:

- “Complete per the original 2-week execution plan as written.”
- “Fully production-ready” without a signed **test exit report** for agreed critical paths.

## Sign-off block (copy into email or contract)

- Parties agree that **borrower-facing mobile delivery** for this phase is satisfied by a **standards-based PWA**, not by published native store apps.
- **Web push**, **SMS**, **email**, and **WhatsApp** (if in scope) are accepted per the table above with named test evidence attached.
