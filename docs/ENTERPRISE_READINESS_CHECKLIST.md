# Enterprise Readiness Checklist

This checklist is used to sign off borrower and admin LMS production readiness.

## Functional Gates

- [ ] Borrower flow: apply -> approve -> disburse -> repay -> close
- [ ] KYC flow: upload -> admin review -> decision -> reupload
- [ ] Claim flow: submit -> admin review -> borrower sees decision
- [ ] Disbursement flow: source account selected -> maker action -> checker approval -> borrower wallet visible

## Reliability Gates

- [ ] Type-check passes
- [ ] Edited files have no lint errors
- [ ] Critical actions are idempotent (status transitions, claim review, notifications)
- [ ] Notification duplicates are suppressed in short time window
- [ ] Notification retries recover transient provider failures

## Audit and Controls

- [ ] High-risk admin actions are permission-gated
- [ ] Disbursement completion requires approval permission
- [ ] Claim verification is permission-gated
- [ ] Admin dashboard shows reconciliation and operational risk strip
- [ ] Daily close checklist is reviewed by operations lead

## Operational Signoff

- [ ] Product owner signoff
- [ ] Compliance signoff
- [ ] Operations signoff
- [ ] Rollback plan confirmed
