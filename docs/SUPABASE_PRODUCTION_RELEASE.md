# Supabase production releases

Production Supabase changes are versioned in `supabase/` and deployed from
GitHub Actions after they reach `main`.

## One-time GitHub setup

Add these repository Actions secrets in GitHub under **Settings → Secrets and
variables → Actions**:

- `SUPABASE_ACCESS_TOKEN`: a Supabase personal access token scoped to this
  project.
- `SUPABASE_DB_PASSWORD`: the production database password.

Do not put either value in the repository, a workflow file, or chat. The deploy
workflow stops with a clear error if either secret is missing.

## Release flow

1. Commit schema changes as a new SQL migration in `supabase/migrations/` and
   Edge Function changes under `supabase/functions/`.
2. Review and merge the pull request to `main` after the normal CI checks pass.
3. The `Deploy Supabase Production` workflow reconciles the known migration
   history entries from the earlier manual deployments, previews pending SQL,
   applies migrations, then deploys the functions.
4. Confirm the workflow completed and inspect the affected staff or borrower
   operation in production.

From this point forward, do not apply a repository migration with a separate
tool that invents a different migration version. Make urgent changes in a
versioned SQL file and let the workflow apply that file so local and production
migration histories stay aligned.
