# Phinduloans API (NestJS)

PostgreSQL + Prisma + REST (`/api/v1/...`). Intended to **strangler-migrate** off direct Supabase usage from the Vite frontend.

## Setup

1. Copy `.env.example` to `.env` and set `DATABASE_URL` (same Postgres as Supabase, or a fresh instance).
2. `npm install` (or `bun install`) in this folder.
3. `npx prisma generate`
4. If the DB already exists and was not created by Prisma: `npx prisma db pull` to align `schema.prisma`, then `npx prisma generate` again.
5. `npm run start:dev`

## Endpoints

- `GET /api/v1/health` — liveness (Railway healthcheck)
- `GET /api/v1/health/ready` — database ping
- `GET /api/v1/loan-products?active=true&sort=name|interest_rate|min_amount&order=asc|desc`
- `POST /api/v1/loans/:id/transitions` — staff status change (Supabase bearer + staff role)
- `GET /api/v1/loans/:id/events`
- `POST /api/v1/repayments/:id/payment-claims`
- `GET /api/v1/admin/payment-claims`
- `POST /api/v1/payment-claims/:id/review`
- `GET /api/v1/notifications/me` · `POST /api/v1/notifications/:id/read`
- OpenAPI: `http://localhost:3000/api/docs`

Money and status writes use Prisma transactions against the existing Postgres (typically the Supabase database). Do not run `prisma migrate` to create these tables; they already exist.

## Railway

Create a service from this repo. Root Dockerfile builds `backend/`. Set:

- `DATABASE_URL` — same Postgres as production Supabase (pooler URI is fine)
- `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
- `CORS_ORIGIN` — staff + borrower origins
- `PORT` — Railway injects this; the app listens on it

Healthcheck: `GET /api/v1/health`

## Environment

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `PORT` | HTTP port (default `3000`) |
| `CORS_ORIGIN` | Comma-separated allowed origins (default includes `http://localhost:8080`) |
| `SUPABASE_URL` | Project URL for `auth.getUser` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role (or `SUPABASE_ANON_KEY` for token checks only) |
| `JWT_SECRET` | Secret for future JWT auth |
| `JWT_EXPIRES` | Access token TTL (default `15m`) |
