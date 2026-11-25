# ORSAVEN — Platform Architecture

## Stack
| Layer | Choice |
|---|---|
| Frontend | React 19 + TypeScript + Vite 7 + Tailwind CSS 4, React Router 7 (SPA, admin code-split) |
| Backend | Hono 4 on Cloudflare Pages Functions (advanced mode `_worker.js`, bundled by esbuild) |
| Database | Cloudflare D1 `orsaven-production` |
| Auth | Clerk Production (`clerk.orsaven.biz.id`), `@clerk/clerk-react` + `@clerk/backend` |
| Files | Private storage abstraction: D1 blobs (free tier, ≤1.8 MB) or R2 when explicitly bound |
| Payments | Provider adapter: `none` (active), `midtrans` (prepared, inactive), `test` (tests only) |

## Request flow
`/assets/*`, `/brand/*` → static. Everything else → Worker:
- `/api/v1/*` JSON API (envelope `{data, meta}` / `{error:{code,message,details,requestId}}`)
- `/sitemap.xml`, `/robots.txt`
- other paths → SPA shell with server-injected `<title>`, meta, canonical, hreflang, Open Graph, JSON-LD and correct 404 status.

## Source layout
```
src/shared/domain.ts         families, statuses, roles, permissions, state machines, upload rules
src/worker/app.ts            app composition, CORS, error handling
src/worker/middleware/       security headers + CSP, origin guard, rate limit (D1), auth/RBAC
src/worker/services/         catalog, orders, payments/, delivery, storage, audit, settings
src/worker/routes/           public, account, admin/, webhooks
src/worker/seo.ts            meta injection, sitemap, robots
src/web/                     React app (components/ui = design system)
migrations/                  D1 schema + reference data (non-destructive)
seed/demo.sql                clearly-flagged example listings (is_demo = 1)
tests/                       Vitest: domain + API integration over real migrations
```

## API
Public: `GET /health`, `GET /config`, `GET /catalog/families|categories|products|products/:slug`, `GET /legal/:slug`, `POST /inquiries` (rate-limited, honeypot).
Customer (Bearer Clerk session): `GET /account`, `PATCH /account/profile`, `GET /account/orders[/:id]`, `POST /account/orders/:id/cancel`, `POST /account/checkout`, `GET /account/library`, `POST|GET /account/downloads`, `GET /account/inquiries`.
Download: `GET /downloads/:token` (single-use window, short-lived, hashed token).
Admin (`admin.access` + per-route permission): overview, products CRUD + `/transition`, versions, assets (multipart), categories, licenses, orders + `/action`, payments, customers, `/users/:id/role`, roles, inquiries, downloads, audit, settings, legal (+ approve), exports (CSV).
Webhooks: `POST /webhooks/payments/:provider` (adapter signature verification, idempotent), `POST /webhooks/clerk` (Svix verification).

## Data model
users · user_profiles · roles · permissions · role_permissions · product_categories · product_licenses · products · product_versions · product_assets · asset_blobs · orders · order_items · payments · webhook_events · downloads · download_events · service_inquiries · audit_logs · site_settings · legal_documents · rate_limits.
All FKs declared; indexes on status/family, owner, created_at. Migrations contain only `CREATE … IF NOT EXISTS` / `INSERT OR IGNORE`.

## State machines
Product: draft → (submit) review → (approve) review✓ → (publish) published → unavailable / archived → (restore) draft. Publishing requires prior approval; non-super-admins cannot approve their own submission.
Order: pending_payment → paid → completed (→ refunded); pending → cancelled / failed. `paid` is reachable **only** from a verified provider webhook whose amount matches. Free claims complete without a payment record. Admins cannot set payment state.

## Security controls
Server-side zod validation; parameterised SQL with LIKE escaping; React output encoding and a no-HTML Markdown renderer; Clerk JWT verification with authorized parties; roles read from D1 only, super-admin bootstrap only for verified emails in a server secret; RBAC per route; ownership checks in SQL (404 for foreign resources); CSP, HSTS, X-Frame-Options, nosniff, Referrer/Permissions policy; CORS allowlist + origin guard; D1 rate limits; audit log with secret scrubbing; upload type/extension/size/filename checks + SHA-256; storage keys never exposed; download entitlement re-checked at redemption; CSV formula-injection guard; open-redirect guard on sign-in.

## Environment
Vars (wrangler.jsonc): `ENVIRONMENT`, `APP_ORIGIN`, `ALLOWED_ORIGINS`, `PAYMENT_PROVIDER`.
Secrets (`wrangler pages secret put`): `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `IP_HASH_SALT`, `SUPER_ADMIN_EMAILS`, optional `CLERK_WEBHOOK_SECRET`, `CLERK_JWT_KEY`, `MIDTRANS_SERVER_KEY`.
Local: copy `.dev.vars.example` → `.dev.vars` (git-ignored).
