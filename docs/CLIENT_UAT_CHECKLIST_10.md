# Client UAT — 10 checks (pilot sign-off)

**Environment:** staging URL + production Supabase (or staging project) as agreed.  
**Devices:** complete at least **one phone** (Safari or Chrome) **and** one desktop browser.  
**Record:** Pass / Fail / Notes (and screenshot for any fail).

---

| # | Who | What to do | Pass criteria |
|---|-----|------------|----------------|
| 1 | **Borrower** | Open the public site → **Sign up** with a new email (or use the flow your team agreed: password vs email link). | Account is created without a dead end; user knows the **next step** (dashboard, or “check email” if confirmation is on). |
| 2 | **Borrower** | **Sign in** (same account), land on **Dashboard**. | Session holds; dashboard loads without a blank error screen. |
| 3 | **Borrower** | On **phone**: use **bottom navigation** (if shown) to switch between **Home**, **Loans**, **Payments**, **Profile** (or equivalent tabs). | No content hidden behind the nav bar; no horizontal scroll that blocks primary actions. |
| 4 | **Borrower** | Open **Profile** → **Documents** (or KYC / documents area). | Page opens; upload or status messaging is understandable (even if uploads are pending staff review). |
| 5 | **Borrower** | If **Apply for a loan** is in scope: start an application and save or submit as designed. | No unexplained 403/500 toast; data appears where staff expect it (or clear “submitted” state). |
| 6 | **Borrower** | If **payment claim / repayment** is in scope: submit or view a claim (or view repayment list). | Status text is clear; no silent failure. |
| 7 | **Borrower** | **Sign out**, then open a protected URL (e.g. dashboard) while logged out. | Redirects to auth (or login), not a broken page. |
| 8 | **Staff** | Log in as **one real staff role** (e.g. loan officer or admin — not super_admin only). | Sees only screens allowed for that role; no endless loading spinners. |
| 9 | **Staff** | Open **Borrowers** or **Applications** (whichever you use daily) → open **one record** → return to list. | List/detail navigation works on **phone** and desktop. |
| 10 | **Staff** | Perform **one write action** allowed for that role (e.g. status change, note, or filter + export if that is the main task). | Save succeeds **or** shows a clear permission / validation message (not a generic error). |

---

## After UAT

- **All Pass:** OK to schedule **training + pilot** with a small user group.  
- **Any Fail:** Log URL, role, device, time, screenshot → fix → re-run only failed rows.

**Related:** `docs/CLIENT_READINESS_BACKLOG.md` · `docs/SUPABASE_LOVABLE_AUTH_HANDOFF.md` · `docs/QA_SIGNOFF_CHECKLIST.md`
