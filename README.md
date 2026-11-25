# ORSAVEN

**Productization & Digital Product Catalog**

ORSAVEN is the productization and catalog brand for packaging, presenting, distributing, and supporting useful digital products and implementation-ready solutions for Indonesian and global customers.

- Website/domain: https://orsaven.biz.id
- Cloudflare Pages: https://orsaven.pages.dev
- Repository: https://github.com/Sparkmind-obp-off/Orsaven
- Status: Brand locked. Platform v1 built and deployed; paid checkout **inactive**; legal documents **DRAFT**; catalog contains **example listings only**.
- Primary catalog: Digital Assets, Business & System Kits, Agentic Solutions, Implementation Services.

## Brand architecture

ORSAVEN is a distinct commercial product layer. It does not replace or absorb the identities of MAELVYN, EUDELLA, ZUVANE, or AVORLUNE. Products may originate from those ventures, but each source brand retains its own identity and responsibilities.

## Platform (v1)

| Area | Status |
|---|---|
| Public site: Home, Catalog, 4 family pages, Product detail, How it works, About, FAQ, Contact, Legal ×4, Sign in/up, 404 | Implemented (ID/EN) |
| Catalog: search, family/category/pricing filters, sorting, pagination, maturity labels, demo labelling | Implemented |
| Customer account: overview, orders, order detail + cancel, library + secure downloads, download history, inquiries, profile/settings, onboarding | Implemented |
| Admin: overview, products editor, publishing workflow & approvals, versions, private files, categories, orders, payments, customers + role assignment, inquiries, download activity, roles matrix, audit log, legal content, settings, CSV exports | Implemented |
| Clerk Production auth (server-side JWT verification, user mapping, RBAC) | Configured — sign-in requires the custom domain (production keys are domain-bound) |
| Orders & payments | Provider-independent lifecycle; **no provider active** (Midtrans adapter prepared, inactive) |
| Digital delivery | Private storage, short-lived use-limited links, entitlement re-check, audit |
| SEO | Server-injected meta, canonical, hreflang, OG, JSON-LD, sitemap, robots |

Details: [Architecture](docs/ARCHITECTURE.md) · [Design system](docs/DESIGN_SYSTEM.md)

## Development

```bash
npm install
cp .dev.vars.example .dev.vars        # fill in values; never commit
npm run db:migrate:local && npm run db:seed:local
npm run build && npx wrangler pages dev dist --ip 0.0.0.0 --port 3000
npm run check                          # typecheck + lint + tests + build
```

## Deployment (Cloudflare Pages, own account)

```bash
npm run db:migrate:prod                # non-destructive migrations
npm run deploy                         # build + wrangler pages deploy (project: orsaven, branch: main)
```
Secrets are set with `wrangler pages secret put <NAME> --project-name orsaven`. See docs/ARCHITECTURE.md.

## Admin access

The first Super Admin is bootstrapped from the `SUPER_ADMIN_EMAILS` secret: sign in with that **verified** email and the account is promoted server-side (audited). Further roles are assigned in Admin → Customers.

## Documentation

- [Brand strategy](docs/BRAND_STRATEGY.md)
- [Positioning and messaging](docs/POSITIONING.md)
- [Product catalog architecture](docs/PRODUCT_CATALOG.md)
- [Commercial model](docs/COMMERCIAL_MODEL.md)
- [Brand identity direction](docs/IDENTITY_DIRECTION.md)
- [Operating model](docs/OPERATING_MODEL.md)
- [Website brief](docs/WEBSITE_BRIEF.md)
- [Roadmap](docs/ROADMAP.md)
- [Decision log](docs/DECISIONS.md)
- [Platform architecture](docs/ARCHITECTURE.md)
- [Design system](docs/DESIGN_SYSTEM.md)

## Guardrails

- Do not claim a product capability, integration, certification, customer result, or availability unless verified.
- Do not imply ORSAVEN develops or owns third-party AI models or provider infrastructure.
- Respect each source venture's ownership, licenses, commercial terms, and support boundaries.
- No paid infrastructure, subscriptions, domain changes, trademark filings, advertising, or external purchases without explicit approval.
- Treat legal, trademark, domain, and social-handle checks as separate verification tasks; a brand decision is not proof of registration or ownership.

## Before public commerce

1. Replace example listings with real products that pass the quality gates (docs/OPERATING_MODEL.md).
2. Legal review and approval of Privacy, Terms, Refund, Delivery and license texts (Admin → Legal).
3. Choose and authorise a payment provider; set its secrets; set `PAYMENT_PROVIDER`.
4. Enable `commerce.checkout_enabled` (Super Admin only; the API refuses until 2–3 are done).
