# Phase 6 AI Operations Center v1

## Delivered in v1
- Added read-only admin page at `/admin/ai-ops`:
  - File: `apps/staff-web/src/pages/admin/AdminAIOpsCenter.tsx`
  - Menu entry in `apps/staff-web/src/components/admin/adminSidebarConfig.ts` under **AI Agents**
  - Route registration in `apps/staff-web/src/App.tsx` (admin-only, beta key: `ai_ops_center`)
- Added shared hook:
  - `apps/staff-web/src/hooks/useAIOpsBriefing.ts`
  - Uses `react-query` and Supabase reads only (no writes)

## Morning briefing data (observe-only)
The briefing surfaces:
- Pending applications
- Overdue/failed repayment signals
- Available liquidity (from active `accounts` balances)
- Unsigned contracts (best-effort from loan status/signature fields)
- Assigned pending review workload
- Collections trend hint (current overdue compared with last-week overdue)
- Approaching-default watchlist
- Notification failure signal (from `notification_logs`)

When a table is missing, v1 shows `—` instead of failing hard.

## Platform health strip
- Displays recent notification failure count and a plain-language health hint.
- Includes operator guidance to check Supabase/Edge logs for deeper diagnostics.

## Observe-only policy (enforced)
v1 does **not**:
- Auto-approve or reject loans
- Auto-send SMS/messages without manual action
- Mutate production business data
- Trigger schema migrations

## V2 roadmap candidates
- Collections AI with prioritized call lists and scripts
- Risk AI with early-warning cohorts and borrower-level reasoning
- Treasury AI with liquidity runway forecasting
- SLA watchdog alerts routed to staff channels
