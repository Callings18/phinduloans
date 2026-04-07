# Phinduloans API (NestJS)

PostgreSQL + Prisma + REST (`/api/v1/...`). Intended to **strangler-migrate** off direct Supabase usage from the Vite frontend.

## Setup

1. Copy `.env.example` to `.env` and set `DATABASE_URL` (same Postgres as Supabase, or a fresh instance).
2. `npm install` (or `bun install`) in this folder.
3. `npx prisma generate`
4. If the DB already exists and was not created by Prisma: `npx prisma db pull` to align `schema.prisma`, then `npx prisma generate` again.
5. `npm run start:dev`

## Endpoints

- `GET /api/v1/loan-products?active=true&sort=name|interest_rate|min_amount&order=asc|desc` — list products (JSON compatible with frontend `loan_products` row shape; decimals as numbers).
- OpenAPI: `http://localhost:3000/api/docs`

## Environment

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `PORT` | HTTP port (default `3000`) |
| `CORS_ORIGIN` | Comma-separated allowed origins (default includes `http://localhost:8080`) |
| `JWT_SECRET` | Secret for future JWT auth |
| `JWT_EXPIRES` | Access token TTL (default `15m`) |
