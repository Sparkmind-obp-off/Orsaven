# ORSAVEN — Decision Log

## 2026-11-25 — Brand lock

- **Decision:** ORSAVEN is the selected and locked brand name.
- **Role:** Productization & Digital Product Catalog.
- **Domain:** Owner reports purchase of orsaven.biz.id.
- **Audience:** Indonesia and global.
- **Brand character:** Premium, elegant, approachable, mature, timeless.
- **Catalog pillars:** Digital Assets; Business & System Kits; Agentic Solutions; Implementation Services.
- **Architecture:** ORSAVEN is an independent productization layer and does not replace MAELVYN, EUDELLA, ZUVANE, or AVORLUNE.
- **Budget constraint:** Rp0 initial operating assumption; no paid service or purchase without explicit approval.
- **Legal status:** Brand selection is not equivalent to trademark registration or legal clearance. Preserve official search evidence and registration records separately.
- **Next step:** Review repository and infrastructure, then build the public website only after stack and cost checks.

## Change control

Future changes to the name, positioning, catalog pillars, or brand architecture require an explicit owner decision and an update to this log.

## 2026-11-25 — Platform v1 stack and deployment

- **Decision:** React + Vite + Tailwind frontend; Hono on Cloudflare Pages Functions; Cloudflare D1 `orsaven-production`; Clerk Production for authentication. Deployed to the owner's Cloudflare account (Pages project `orsaven`, branch `main`).
- **Cost:** Cloudflare free tier only (Pages, D1). R2 not enabled; private files use D1 blob storage (≤1.8 MB per file) until R2 is explicitly authorised.
- **Payments:** Provider-independent adapter; no provider active. Midtrans adapter prepared but inactive pending owner authorisation and merchant credentials.
- **Content:** Catalog contains example listings only (flagged, non-purchasable, noindex). Legal documents are DRAFT.
- **Typography (working):** Fraunces (display) and Inter (interface), both OFL, self-hosted. Subject to final identity approval.
