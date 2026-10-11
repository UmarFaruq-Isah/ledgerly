# Ledgerly – Expense Tracker

React (Vite) + Node/Express + PostgreSQL. JWT auth with bcrypt-hashed passwords; logout revokes the token server-side.

## Run locally
1. Create a Postgres database (local, or a free Supabase project) and copy its connection string.
2. `cp .env.example server/.env` and fill in `DATABASE_URL` and a long random `JWT_SECRET`.
3. `npm run setup`
4. Two terminals: `npm run dev:server` (API on :4000) and `npm run dev:client` (app on :5173, proxies `/api`).

The server creates its tables on startup (`server/src/schema.sql`).

## Production (single service)
`npm run setup && npm run build && npm start` – Express serves the built client and the API from one origin.

**Render + Supabase:** push to GitHub, create a Render Blueprint from `render.yaml`, set `DATABASE_URL` to your Supabase connection string (`DATABASE_SSL=true` is preset) and `NODE_ENV=production`.

## Tests
`npm test` runs the API suite (in-memory Postgres via pg-mem, no setup needed).

## API (all under /api; everything except auth routes needs `Authorization: Bearer <token>`)
`POST /auth/signup|login|logout|forgot|reset` · `GET|PATCH /auth/me` · `POST /auth/password`
`GET|POST /expenses` (filters: from, to, category, limit) · `GET|PUT|DELETE /expenses/:id` · `POST /expenses/import`
`GET|POST /budgets` · `DELETE /budgets/:category` · `GET /reports?month=YYYY-MM`

## Known gaps
- Password reset has no email provider: outside production the API returns the reset token so the flow works in development. Plug a mailer into `POST /auth/forgot` before going live.
- Phase 3 (notifications, recurring transactions, currency conversion, AI insights) is not built; the currency setting only changes display formatting.
- No login rate limiting yet (add `express-rate-limit` before launch).
