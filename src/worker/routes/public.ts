import { Hono } from 'hono'
import { z } from 'zod'
import type { AppEnv } from '../types'
import { FAMILIES, LEGAL_SLUGS, SERVICE_TYPES } from '../../shared/domain'
import { many, one } from '../lib/db'
import { notFound, ok, parse, parseJson } from '../lib/http'
import { hashIp, newInquiryId } from '../lib/crypto'
import { catalogQuery, getProductBySlug, listProducts, relatedProducts, serializePublic } from '../services/catalog'
import { publicSettings } from '../services/settings'
import { audit } from '../services/audit'
import { rateLimit } from '../middleware/rateLimit'
import { clerkFrontendApi } from '../middleware/security'

export const publicRoutes = new Hono<AppEnv>()

publicRoutes.get('/health', async (c) => {
  const db = await one<{ ok: number }>(c.env.DB, 'SELECT 1 AS ok').catch(() => null)
  return ok(c, { status: db ? 'ok' : 'degraded', database: !!db, time: new Date().toISOString() })
})

/** Public runtime config. Contains ONLY publishable values. */
publicRoutes.get('/config', async (c) => {
  return ok(c, {
    clerkPublishableKey: c.env.CLERK_PUBLISHABLE_KEY ?? null,
    clerkFrontendApi: c.env.CLERK_PUBLISHABLE_KEY ? clerkFrontendApi(c.env) : null,
    authConfigured: !!(c.env.CLERK_PUBLISHABLE_KEY && c.env.CLERK_SECRET_KEY),
    paymentsConfigured: (c.env.PAYMENT_PROVIDER ?? 'none') !== 'none',
    environment: c.env.ENVIRONMENT ?? 'development',
    settings: await publicSettings(c.env.DB),
  })
})

publicRoutes.get('/catalog/families', async (c) => {
  const counts = await many<{ family: string; n: number }>(c.env.DB, "SELECT family, COUNT(*) AS n FROM products WHERE status = 'published' GROUP BY family")
  return ok(
    c,
    FAMILIES.map((f) => ({ ...f, productCount: counts.find((x) => x.family === f.key)?.n ?? 0 })),
  )
})

publicRoutes.get('/catalog/categories', async (c) => {
  const rows = await many(
    c.env.DB,
    `SELECT c.id, c.family, c.slug, c.name_id, c.name_en, c.description_id, c.description_en, c.sort_order,
            (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.status = 'published') AS product_count
     FROM product_categories c WHERE c.is_active = 1 ORDER BY c.family, c.sort_order, c.id`,
  )
  return ok(
    c,
    rows.map((r) => ({
      id: r.id,
      family: r.family,
      slug: r.slug,
      name: { id: r.name_id, en: r.name_en },
      description: { id: r.description_id, en: r.description_en },
      productCount: r.product_count,
    })),
  )
})

publicRoutes.get('/catalog/products', async (c) => {
  const q = parse(catalogQuery, c.req.query())
  const { rows, meta } = await listProducts(c.env.DB, q, { admin: false })
  c.header('Cache-Control', 'public, max-age=30')
  return ok(c, rows.map(serializePublic), meta)
})

publicRoutes.get('/catalog/products/:slug', async (c) => {
  const r = await getProductBySlug(c.env.DB, c.req.param('slug'), { admin: false })
  if (!r) throw notFound('product_not_found')
  const related = await relatedProducts(c.env.DB, r)
  const assets = await many(
    c.env.DB,
    "SELECT label, filename, content_type, size_bytes FROM product_assets WHERE product_id = ? AND kind = 'deliverable' AND is_active = 1 ORDER BY id",
    r.id,
  )
  return ok(c, {
    ...serializePublic(r),
    // Names and sizes only — never storage keys.
    deliverables: assets.map((a) => ({ label: a.label || a.filename, contentType: a.content_type, sizeBytes: a.size_bytes })),
    related: related.map(serializePublic),
  })
})

publicRoutes.get('/legal/:slug', async (c) => {
  const slug = c.req.param('slug')
  if (!(LEGAL_SLUGS as readonly string[]).includes(slug)) throw notFound()
  const r = await one(c.env.DB, 'SELECT slug, title_id, title_en, body_id, body_en, status, version, approved_at, updated_at FROM legal_documents WHERE slug = ?', slug)
  if (!r) throw notFound()
  return ok(c, {
    slug: r.slug,
    title: { id: r.title_id, en: r.title_en },
    body: { id: r.body_id, en: r.body_en },
    status: r.status,
    version: r.version,
    approvedAt: r.approved_at,
    updatedAt: r.updated_at,
  })
})

const inquirySchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(200),
  company: z.string().trim().max(160).default(''),
  serviceType: z.enum(SERVICE_TYPES),
  budgetRange: z.string().trim().max(60).default(''),
  message: z.string().trim().min(20).max(5000),
  productSlug: z.string().trim().max(90).optional(),
  locale: z.enum(['id', 'en']).default('id'),
  consent: z.literal(true),
  /** Honeypot: must stay empty. */
  website: z.string().max(0).optional().default(''),
})

publicRoutes.post('/inquiries', rateLimit('inquiry', 5, 3600), async (c) => {
  const b = await parseJson(c, inquirySchema)
  const user = c.get('user')
  let productId: number | null = null
  if (b.productSlug) {
    const p = await one<{ id: number }>(c.env.DB, "SELECT id FROM products WHERE slug = ? AND status = 'published'", b.productSlug)
    productId = p?.id ?? null
  }
  const publicId = newInquiryId()
  await c.env.DB.prepare(
    `INSERT INTO service_inquiries (public_id, user_id, product_id, name, email, company, service_type, budget_range, message, locale, ip_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(publicId, user?.id ?? null, productId, b.name, b.email, b.company, b.serviceType, b.budgetRange, b.message, b.locale, await hashIp(c.req.header('CF-Connecting-IP'), c.env.IP_HASH_SALT))
    .run()
  await audit(c.env, { actorUserId: user?.id ?? null, actorRole: user?.role ?? 'public', action: 'inquiry.created', entityType: 'inquiry', entityId: publicId })
  return ok(c, { publicId, status: 'new' }, undefined, 201)
})
