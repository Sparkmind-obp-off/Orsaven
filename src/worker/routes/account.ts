import { Hono } from 'hono'
import { z } from 'zod'
import type { AppEnv } from '../types'
import { exec, many, nowIso, one, pageParams } from '../lib/db'
import { badRequest, notFound, ok, parseJson } from '../lib/http'
import { requireUser } from '../middleware/auth'
import { rateLimit } from '../middleware/rateLimit'
import { audit } from '../services/audit'
import { createOrder, orderDetail, transitionOrder, type OrderRow } from '../services/orders'
import { issueDownload } from '../services/delivery'

export const accountRoutes = new Hono<AppEnv>()
accountRoutes.use('*', requireUser)

accountRoutes.get('/', async (c) => {
  const u = c.get('user')!
  const p = await one(c.env.DB, 'SELECT * FROM user_profiles WHERE user_id = ?', u.id)
  const row = await one<{ created_at: string }>(c.env.DB, 'SELECT created_at FROM users WHERE id = ?', u.id)
  return ok(c, {
    id: u.id,
    email: u.email,
    role: u.role,
    permissions: [...u.permissions].sort(),
    createdAt: row?.created_at,
    profile: {
      displayName: p?.display_name ?? '',
      company: p?.company ?? '',
      phone: p?.phone ?? '',
      country: p?.country ?? '',
      locale: p?.locale ?? 'id',
      onboardedAt: p?.onboarded_at ?? null,
    },
  })
})

const profileSchema = z.object({
  displayName: z.string().trim().max(120),
  company: z.string().trim().max(160).default(''),
  phone: z.string().trim().max(40).regex(/^[+0-9 ()-]*$/, 'invalid_phone').default(''),
  country: z.string().trim().max(80).default(''),
  locale: z.enum(['id', 'en']).default('id'),
  completeOnboarding: z.boolean().optional(),
})

accountRoutes.patch('/profile', async (c) => {
  const u = c.get('user')!
  const b = await parseJson(c, profileSchema)
  await exec(
    c.env.DB,
    `INSERT INTO user_profiles (user_id, display_name, company, phone, country, locale, onboarded_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET display_name = excluded.display_name, company = excluded.company, phone = excluded.phone,
       country = excluded.country, locale = excluded.locale,
       onboarded_at = COALESCE(user_profiles.onboarded_at, excluded.onboarded_at), updated_at = excluded.updated_at`,
    u.id,
    b.displayName,
    b.company,
    b.phone,
    b.country,
    b.locale,
    b.completeOnboarding ? nowIso() : null,
    nowIso(),
  )
  await audit(c.env, { actorUserId: u.id, actorRole: u.role, action: 'profile.updated', entityType: 'user', entityId: String(u.id) })
  return ok(c, { saved: true })
})

/* ---------------- Orders (ownership enforced in SQL) ---------------- */

accountRoutes.get('/orders', async (c) => {
  const u = c.get('user')!
  const { pageSize, offset, page } = pageParams(c.req.query('page'), c.req.query('pageSize'), 50)
  const rows = await many<OrderRow & { item_count: number }>(
    c.env.DB,
    `SELECT o.*, (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count
     FROM orders o WHERE o.user_id = ? ORDER BY o.created_at DESC LIMIT ? OFFSET ?`,
    u.id,
    pageSize,
    offset,
  )
  const total = await one<{ n: number }>(c.env.DB, 'SELECT COUNT(*) AS n FROM orders WHERE user_id = ?', u.id)
  return ok(
    c,
    rows.map((o) => ({ publicId: o.public_id, status: o.status, totalIdr: o.total_idr, itemCount: o.item_count, createdAt: o.created_at, completedAt: o.completed_at })),
    { page, pageSize, total: total?.n ?? 0 },
  )
})

async function ownOrder(c: { env: AppEnv['Bindings'] }, userId: number, publicId: string) {
  const o = await one<OrderRow>(c.env.DB, 'SELECT * FROM orders WHERE public_id = ? AND user_id = ?', publicId, userId)
  if (!o) throw notFound('order_not_found')
  return o
}

accountRoutes.get('/orders/:publicId', async (c) => {
  const o = await ownOrder(c, c.get('user')!.id, c.req.param('publicId'))
  return ok(c, await orderDetail(c.env.DB, o, { admin: false }))
})

accountRoutes.post('/orders/:publicId/cancel', async (c) => {
  const u = c.get('user')!
  const o = await ownOrder(c, u.id, c.req.param('publicId'))
  if (o.status !== 'pending_payment') throw badRequest('only_pending_orders_can_be_cancelled')
  const next = await transitionOrder(c.env, o, 'cancelled', { actorUserId: u.id, actorRole: u.role, reason: 'customer_cancelled' })
  return ok(c, { publicId: next.public_id, status: next.status })
})

const checkoutSchema = z.object({
  productIds: z.array(z.number().int().positive()).min(1).max(10),
  note: z.string().trim().max(1000).default(''),
  acceptTerms: z.literal(true),
})

accountRoutes.post('/checkout', rateLimit('checkout', 10, 600), async (c) => {
  const b = await parseJson(c, checkoutSchema)
  const origin = new URL(c.req.url).origin
  const { order, checkoutUrl } = await createOrder(c.env, c.get('user')!, b.productIds, b.note, origin)
  return ok(c, { publicId: order.public_id, status: order.status, totalIdr: order.total_idr, checkoutUrl }, undefined, 201)
})

/* ---------------- Library & downloads ---------------- */

accountRoutes.get('/library', async (c) => {
  const u = c.get('user')!
  const items = await many(
    c.env.DB,
    `SELECT oi.id AS order_item_id, oi.license_code, oi.license_snapshot, o.public_id, o.completed_at,
            p.id AS product_id, p.slug, p.title_id, p.title_en, p.family, v.version
     FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN products p ON p.id = oi.product_id
     LEFT JOIN product_versions v ON v.id = p.current_version_id
     WHERE o.user_id = ? AND o.status = 'completed' ORDER BY o.completed_at DESC`,
    u.id,
  )
  const out = []
  for (const it of items) {
    const assets = await many(
      c.env.DB,
      `SELECT a.id, a.label, a.filename, a.content_type, a.size_bytes, a.created_at, v.version
       FROM product_assets a LEFT JOIN product_versions v ON v.id = a.version_id
       WHERE a.product_id = ? AND a.kind = 'deliverable' AND a.is_active = 1 ORDER BY a.id DESC`,
      it.product_id,
    )
    out.push({
      orderItemId: it.order_item_id,
      orderPublicId: it.public_id,
      completedAt: it.completed_at,
      licenseCode: it.license_code,
      license: it.license_snapshot,
      product: { id: it.product_id, slug: it.slug, title: { id: it.title_id, en: it.title_en }, family: it.family, version: it.version },
      assets: assets.map((a) => ({ id: a.id, label: a.label || a.filename, filename: a.filename, contentType: a.content_type, sizeBytes: a.size_bytes, version: a.version, createdAt: a.created_at })),
    })
  }
  return ok(c, out)
})

accountRoutes.post(
  '/downloads',
  rateLimit('download_issue', 30, 600),
  async (c) => {
    const b = await parseJson(c, z.object({ orderItemId: z.number().int().positive(), assetId: z.number().int().positive() }))
    return ok(c, await issueDownload(c.env, c.get('user')!, b.orderItemId, b.assetId, c.req.header('CF-Connecting-IP')), undefined, 201)
  },
)

accountRoutes.get('/downloads', async (c) => {
  const rows = await many(
    c.env.DB,
    `SELECT e.created_at, a.filename, a.label, p.slug, p.title_id, p.title_en
     FROM download_events e JOIN product_assets a ON a.id = e.asset_id JOIN products p ON p.id = a.product_id
     WHERE e.user_id = ? ORDER BY e.created_at DESC LIMIT 100`,
    c.get('user')!.id,
  )
  return ok(c, rows.map((r) => ({ at: r.created_at, file: r.label || r.filename, product: { slug: r.slug, title: { id: r.title_id, en: r.title_en } } })))
})

accountRoutes.get('/inquiries', async (c) => {
  const rows = await many(
    c.env.DB,
    'SELECT public_id, service_type, status, message, created_at, updated_at FROM service_inquiries WHERE user_id = ? ORDER BY created_at DESC LIMIT 100',
    c.get('user')!.id,
  )
  return ok(c, rows.map((r) => ({ publicId: r.public_id, serviceType: r.service_type, status: r.status, message: r.message, createdAt: r.created_at, updatedAt: r.updated_at })))
})
