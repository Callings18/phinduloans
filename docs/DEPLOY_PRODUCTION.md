# Production deploy (quick)

Architecture (Cloudflare static + Supabase backend): see [`ENTERPRISE_HOSTING.md`](./ENTERPRISE_HOSTING.md).

After merging to `main`, ship all three surfaces:

| Surface | Command | URL |
|---------|---------|-----|
| Borrower PWA | `npm run deploy:borrower:full` | https://app.phindu.com |
| Staff / office | `STAFF_SITE_MODE=office npm run deploy:staff:full` | https://office.phindu.com |
| Marketing (separate CF project) | `STAFF_SITE_MODE=marketing npm run deploy:staff:full` | https://phindu.com |

One shot (borrower + office build in this repo):

```bash
npm run deploy:production
```

Requires `.env` with Supabase keys and `CLOUDFLARE_API_TOKEN` (or `npx wrangler login`).

GitHub Actions (if secrets are set): **Deploy Borrower PWA**, **Deploy Staff Web** on push to `main`.

## After deploy

1. Hard refresh once on admin tabs (`Ctrl+Shift+R`) — or rely on auto-reload for stale JS chunks (see commit `cb49568`).
2. **Cloudflare** → Purge cache for `office.phindu.com` / `app.phindu.com` if users still see old hashed assets.
3. Supabase: `npx supabase link --project-ref seobilifwyxhtjvsgqpc` then `npx supabase db push --yes` (see `SUPABASE_OPS.md`).

## “Failed to fetch dynamically imported module”

Stale `index.html` pointing at removed `/assets/*.js` after a deploy. Fixed in app code; **redeploy staff** is still required so live assets match.
