# API contracts (v1)

Base URL: `{VITE_API_URL}` (default `http://localhost:3000`). All routes are prefixed with `/api/v1`.

## Loan products

### `GET /loan-products`

**Query**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `active` | boolean | `true` | Filter `is_active = true` when true |
| `sort` | `"name"` \| `"interest_rate"` \| `"min_amount"` | `name` | Order column |
| `order` | `"asc"` \| `"desc"` | `asc` | Sort direction |

**Response:** `200` — JSON array of `loan_products` rows (numeric fields as JSON numbers; timestamps ISO strings).

Matches the shape expected by `Database['public']['Tables']['loan_products']['Row']` in the frontend Supabase types.

## Auth (planned)

Future: `POST /auth/login`, `POST /auth/refresh`, JWT `Authorization: Bearer`.

Scaffolding lives in `backend/src/auth/` (strategy, guards, `Roles` decorator).
