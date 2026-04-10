# Git sync log — local `main` vs `origin/main`

During implementation, `origin/main` was **fast-forward merged** into local `main`, then stashed local work was **reapplied** (with manual conflict resolution in `App.tsx`, admin pages, and `pushNotifications.ts`).

Re-run after fetching:

```bash
git fetch origin
git log --oneline HEAD..origin/main
```

## Sample of commits that were on `origin/main` and not local (at sync time)

These are mostly **LMS fixes, admin flow, notifications, SMS resilience, OTP RLS, triggers, and disbursement/approval** work:

- Fix SMS provider resilience / config  
- Harden send-notification flow; internal auth for notifications  
- Fix critical LMS gaps; loan approval / enum / RPC / disbursement activation  
- Restore LMS triggers and end-to-end flow  
- Lock down OTP codes RLS  
- Admin dashboards and bug fixes across modules  
- Reattach database triggers and backfill  

(Full list: `git log --oneline HEAD..origin/main`.)

## Safe merge workflow (when you have local changes)

1. Commit or **stash** local work (including untracked files you care about).
2. `git fetch origin`
3. `git merge origin/main` **or** `git rebase origin/main` (team preference).
4. Resolve conflicts, run `npm run build`, apply DB migrations as needed.
5. If you used stash: `git stash pop`.

**Note:** Excluding `.cursor/` from stash (if large) is optional:  
`git stash push -u -m "wip" -- . ":(exclude).cursor"`
