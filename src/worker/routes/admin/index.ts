import { Hono, type Context } from 'hono'
import { z } from 'zod'
import type { AppEnv } from '../../types'
import {
  canTransitionProduct,
  INQUIRY_STATUSES,
  LEGAL_SLUGS,
  PRODUCT_TRANSITIONS,
  ROLES,
  validateUpload,
  type ProductAction,
  type ProductStatus,
} from '../../../shared/domain'
import { exec, likeEscape, many, nowIso, one, pageParams } from '../../lib/db'
import { ApiError, badRequest, conflict, forbidden, notFound, ok, parse, parseJson } from '../../lib/http'
import { hashIp, sha256Hex, randomToken } from '../../lib/crypto'
import { requirePermission } from '../../middleware/auth'
import { audit } from '../../services/audit'
import { catalogQuery, getProductById, listProducts, productInput, productToDb, serializeAdmin, validatePricing } from '../../services/catalog'
import { orderDetail, transitionOrder, type OrderRow } from '../../services/orders'
import { storageFor } from '../../services/storage'

export const adminRoutes = new Hono<AppEnv>()
adminRoutes.use('*', requirePermission('admin.access'))

const idParam = (v: string) => {
  const n = Number.parseInt(v, 10)
  if (!Number.isFinite(n) || n <= 0) throw notFound()
  return n
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function log(c: Context<AppEnv, any, any>, action: string, entityType: string, entityId: string | number, metadata?: Record<string, unknown>) {
  const u = c.get('user')!
  await audit(c.env, { actorUserId: u.id, actorRole: u.role, action, entityType, entityId: String(entityId), metadata, ipHash: await hashIp(c.req.header('CF-Connecting-IP'), c.env.IP_HASH_SALT) })
}

/* ───────────── Overview ───────────── */

adminRoutes.get('/overview', async (c) => {
  const db = c.env.DB
  const [products, orders, inquiries, customers, downloads, recent] = await Promise.all([
    many<{ status: string; n: number }>(db, 'SELECT status, COUNT(*) AS n FROM products GROUP BY status'),
    many<{ status: string; n: number; total: number }>(db, 'SELECT status, COUNT(*) AS n, COALESCE(SUM(total_idr),0) AS total FROM orders GROUP BY status'),
    many<{ status: string; n: number }>(db, 'SELECT status, COUNT(*) AS n FROM service_inquiries GROUP BY status'),
    one<{ n: number }>(db, "SELECT COUNT(*) AS n FROM users WHERE status = 'active'"),
    one<{ n: number }>(db, "SELECT COUNT(*) AS n FROM download_events WHERE created_at >= strftime('%Y-%m-%dT%H:%M:%fZ','now','-30 days')"),
    many(db, 'SELECT action, entity_type, entity_id, actor_role, created_at FROM audit_logs ORDER BY id DESC LIMIT 8'),
  ])
  return ok(c, {
    products: Object.fromEntries(products.map((r) => [r.status, r.n])),
    orders: Object.fromEntries(orders.map((r) => [r.status, { count: r.n, totalIdr: r.total }])),
    inquiries: Object.fromEntries(inquiries.map((r) => [r.status, r.n])),
    activeUsers: customers?.n ?? 0,
    downloads30d: downloads?.n ?? 0,
    recentActivity: recent,
    paymentProvider: c.env.PAYMENT_PROVIDER ?? 'none',
    storageDriver: c.env.PRIVATE_FILES ? 'r2' : 'd1',
  })
})

/* ───────────── Products ───────────── */

adminRoutes.get('/products', requirePermission('product.read_all'), async (c) => {
  const q = parse(catalogQuery, c.req.query())
  const { rows, meta } = await listProducts(c.env.DB, { ...q, sort: c.req.query('sort') ? q.sort : 'newest' }, { admin: true })
  return ok(c, rows.map(serializeAdmin), meta)
})

adminRoutes.get('/products/:id', requirePermission('product.read_all'), async (c) => {
  const id = idParam(c.req.param('id'))
  const r = await getProductById(c.env.DB, id)
  if (!r) throw notFound()
  const versions = await many(c.env.DB, 'SELECT * FROM product_versions WHERE product_id = ? ORDER BY id DESC', id)
  const assets = await many(
    c.env.DB,
    'SELECT id, version_id, kind, label, filename, content_type, size_bytes, sha256, storage_driver, is_active, created_at FROM product_assets WHERE product_id = ? ORDER BY id DESC',
    id,
  )
  const history = await many(c.env.DB, "SELECT action, actor_role, metadata_json, created_at FROM audit_logs WHERE entity_type = 'product' AND entity_id = ? ORDER BY id DESC LIMIT 30", String(id))
  return ok(c, { ...serializeAdmin(r), versions, assets, history })
})

async function ensureUniqueSlug(db: D1Database, slug: string, exceptId?: number) {
  const r = await one<{ id: number }>(db, 'SELECT id FROM products WHERE slug = ?', slug)
  if (r && r.id !== exceptId) throw conflict('slug_taken')
}

async function ensureCategoryFamily(db: D1Database, categoryId: number | null | undefined, family: string) {
  if (!categoryId) return
  const cat = await one<{ family: string }>(db, 'SELECT family FROM product_categories WHERE id = ?', categoryId)
  if (!cat) throw badRequest('category_not_found')
  if (cat.family !== family) throw badRequest('category_family_mismatch')
}

adminRoutes.post('/products', requirePermission('product.write'), async (c) => {
  const b = await parseJson(c, productInput)
  const pe = validatePricing(b)
  if (pe) throw badRequest(pe)
  await ensureUniqueSlug(c.env.DB, b.slug)
  await ensureCategoryFamily(c.env.DB, b.category_id, b.family)
  const d = productToDb(b)
  const u = c.get('user')!
  const cols = Object.keys(d)
  const r = await exec(
    c.env.DB,
    `INSERT INTO products (${cols.join(', ')}, status, created_by, updated_by) VALUES (${cols.map(() => '?').join(', ')}, 'draft', ?, ?)`,
    ...Object.values(d),
    u.id,
    u.id,
  )
  await log(c, 'product.created', 'product', r.lastId, { slug: b.slug })
  return ok(c, serializeAdmin((await getProductById(c.env.DB, r.lastId))!), undefined, 201)
})

adminRoutes.put('/products/:id', requirePermission('product.write'), async (c) => {
  const id = idParam(c.req.param('id'))
  const existing = await getProductById(c.env.DB, id)
  if (!existing) throw notFound()
  const b = await parseJson(c, productInput)
  const pe = validatePricing(b)
  if (pe) throw badRequest(pe)
  await ensureUniqueSlug(c.env.DB, b.slug, id)
  await ensureCategoryFamily(c.env.DB, b.category_id, b.family)
  const d = productToDb(b)
  // Editing a product under review or published resets it for re-approval when content changes materially.
  let status = existing.status as ProductStatus
  let resetApproval = false
  if (status === 'review' && existing.approved_at) resetApproval = true
  if (status === 'published' && !c.get('user')!.permissions.has('product.publish')) {
    status = 'review'
    resetApproval = true
  }
  const sets = Object.keys(d).map((k) => `${k} = ?`)
  await exec(
    c.env.DB,
    `UPDATE products SET ${sets.join(', ')}, status = ?, updated_by = ?, updated_at = ?${resetApproval ? ', approved_by = NULL, approved_at = NULL' : ''} WHERE id = ?`,
    ...Object.values(d),
    status,
    c.get('user')!.id,
    nowIso(),
    id,
  )
  await log(c, 'product.updated', 'product', id, { status, resetApproval, priceIdr: d.price_idr, previousPriceIdr: existing.price_idr })
  return ok(c, serializeAdmin((await getProductById(c.env.DB, id))!))
})

const ACTION_PERMISSION: Record<ProductAction, Parameters<typeof requirePermission>[0]> = {
  submit: 'product.submit',
  approve: 'product.approve',
  reject: 'product.approve',
  publish: 'product.publish',
  archive: 'product.archive',
  mark_unavailable: 'product.publish',
  restore_draft: 'product.write',
}

adminRoutes.post('/products/:id/transition', async (c) => {
  const id = idParam(c.req.param('id'))
  const b = await parseJson(c, z.object({ action: z.enum(Object.keys(PRODUCT_TRANSITIONS) as [ProductAction, ...ProductAction[]]), note: z.string().trim().max(1000).default('') }))
  const u = c.get('user')!
  if (!u.permissions.has(ACTION_PERMISSION[b.action])) throw forbidden('missing_permission')
  const p = await getProductById(c.env.DB, id)
  if (!p) throw notFound()
  const from = p.status as ProductStatus
  if (!canTransitionProduct(b.action, from)) throw conflict('invalid_transition', { from, action: b.action })

  if (b.action === 'approve') {
    if (p.approved_at) throw conflict('already_approved')
    if (p.submitted_by === u.id && u.role !== 'super_admin') throw forbidden('cannot_approve_own_submission')
  }
  if (b.action === 'publish') {
    if (from === 'review' && !p.approved_at) throw conflict('approval_required')
    if (!p.is_demo && p.maturity === 'concept' && p.family !== 'implementation_services') throw conflict('concept_products_cannot_be_published')
    const pe = validatePricing({ pricing_model: p.pricing_model as never, price_idr: p.price_idr as number | null, family: p.family as never })
    if (pe) throw conflict(pe)
  }

  const to = PRODUCT_TRANSITIONS[b.action].to
  const ts = nowIso()
  const extra: Record<ProductAction, string> = {
    submit: ', submitted_by = ?, submitted_at = ?, approved_by = NULL, approved_at = NULL',
    approve: ', approved_by = ?, approved_at = ?',
    reject: ', approved_by = NULL, approved_at = NULL',
    publish: ', published_at = COALESCE(published_at, ?)',
    archive: ', archived_at = ?',
    mark_unavailable: '',
    restore_draft: ', approved_by = NULL, approved_at = NULL, archived_at = NULL',
  }
  const extraParams: Record<ProductAction, unknown[]> = {
    submit: [u.id, ts],
    approve: [u.id, ts],
    reject: [],
    publish: [ts],
    archive: [ts],
    mark_unavailable: [],
    restore_draft: [],
  }
  const r = await exec(
    c.env.DB,
    `UPDATE products SET status = ?, updated_at = ?, updated_by = ?${extra[b.action]} WHERE id = ? AND status = ?`,
    to,
    ts,
    u.id,
    ...extraParams[b.action],
    id,
    from,
  )
  if (r.changes !== 1) throw conflict('product_state_changed')
  await log(c, `product.${b.action}`, 'product', id, { from, to, note: b.note })
  return ok(c, serializeAdmin((await getProductById(c.env.DB, id))!))
})

/* ───────────── Versions ───────────── */

adminRoutes.post('/products/:id/versions', requirePermission('product.write'), async (c) => {
  const id = idParam(c.req.param('id'))
  if (!(await getProductById(c.env.DB, id))) throw notFound()
  const b = await parseJson(
    c,
    z.object({ version: z.string().trim().regex(/^\d+\.\d+(\.\d+)?(-[a-z0-9.]+)?$/i, 'semver'), changelog: z.string().trim().max(5000).default(''), release: z.boolean().default(false) }),
  )
  const exists = await one(c.env.DB, 'SELECT id FROM product_versions WHERE product_id = ? AND version = ?', id, b.version)
  if (exists) throw conflict('version_exists')
  const r = await exec(
    c.env.DB,
    'INSERT INTO product_versions (product_id, version, changelog, status, released_at, created_by) VALUES (?, ?, ?, ?, ?, ?)',
    id,
    b.version,
    b.changelog,
    b.release ? 'released' : 'draft',
    b.release ? nowIso() : null,
    c.get('user')!.id,
  )
  if (b.release) await exec(c.env.DB, 'UPDATE products SET current_version_id = ?, updated_at = ? WHERE id = ?', r.lastId, nowIso(), id)
  await log(c, 'product.version_created', 'product', id, { version: b.version, released: b.release })
  return ok(c, { id: r.lastId }, undefined, 201)
})

adminRoutes.post('/products/:id/versions/:versionId/release', requirePermission('product.write'), async (c) => {
  const id = idParam(c.req.param('id'))
  const vid = idParam(c.req.param('versionId'))
  const v = await one<{ id: number; version: string }>(c.env.DB, 'SELECT id, version FROM product_versions WHERE id = ? AND product_id = ?', vid, id)
  if (!v) throw notFound()
  await exec(c.env.DB, "UPDATE product_versions SET status = 'deprecated' WHERE product_id = ? AND status = 'released' AND id != ?", id, vid)
  await exec(c.env.DB, "UPDATE product_versions SET status = 'released', released_at = COALESCE(released_at, ?) WHERE id = ?", nowIso(), vid)
  await exec(c.env.DB, 'UPDATE products SET current_version_id = ?, updated_at = ? WHERE id = ?', vid, nowIso(), id)
  await log(c, 'product.version_released', 'product', id, { version: v.version })
  return ok(c, { released: true })
})

/* ───────────── Assets (private files) ───────────── */

adminRoutes.post('/products/:id/assets', requirePermission('asset.write'), async (c) => {
  const id = idParam(c.req.param('id'))
  if (!(await getProductById(c.env.DB, id))) throw notFound()
  const form = await c.req.formData().catch(() => null)
  if (!form) throw badRequest('multipart_required')
  const file = form.get('file')
  if (!file || typeof file === 'string') throw badRequest('file_required')
  const kind = String(form.get('kind') ?? 'deliverable')
  if (kind !== 'deliverable' && kind !== 'preview') throw badRequest('invalid_kind')
  const label = String(form.get('label') ?? '').trim().slice(0, 160)
  const versionId = form.get('versionId') ? Number(form.get('versionId')) : null
  if (versionId) {
    const v = await one(c.env.DB, 'SELECT id FROM product_versions WHERE id = ? AND product_id = ?', versionId, id)
    if (!v) throw badRequest('version_not_found')
  }
  const f = file as File
  const err = validateUpload(f.name, f.type, f.size)
  if (err) throw badRequest(err)
  const storage = storageFor(c.env)
  if (f.size > storage.maxBytes) throw new ApiError(413, 'file_too_large_for_storage', `Max ${storage.maxBytes} bytes with ${storage.name} storage`)
  const bytes = new Uint8Array(await f.arrayBuffer())
  const key = `products/${id}/${randomToken(18)}`
  const hash = await sha256Hex(bytes)
  await storage.put(key, bytes, f.type)
  const r = await exec(
    c.env.DB,
    `INSERT INTO product_assets (product_id, version_id, kind, label, filename, content_type, size_bytes, sha256, storage_driver, storage_key, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    versionId,
    kind,
    label,
    f.name,
    f.type,
    f.size,
    hash,
    storage.name,
    key,
    c.get('user')!.id,
  )
  await log(c, 'asset.uploaded', 'product', id, { assetId: r.lastId, filename: f.name, size: f.size, sha256: hash })
  return ok(c, { id: r.lastId, filename: f.name, sizeBytes: f.size, sha256: hash, storage: storage.name }, undefined, 201)
})

adminRoutes.patch('/assets/:assetId', requirePermission('asset.write'), async (c) => {
  const aid = idParam(c.req.param('assetId'))
  const b = await parseJson(c, z.object({ isActive: z.boolean().optional(), label: z.string().trim().max(160).optional() }))
  const a = await one<{ product_id: number }>(c.env.DB, 'SELECT product_id FROM product_assets WHERE id = ?', aid)
  if (!a) throw notFound()
  if (b.isActive !== undefined) await exec(c.env.DB, 'UPDATE product_assets SET is_active = ? WHERE id = ?', b.isActive ? 1 : 0, aid)
  if (b.label !== undefined) await exec(c.env.DB, 'UPDATE product_assets SET label = ? WHERE id = ?', b.label, aid)
  await log(c, 'asset.updated', 'product', a.product_id, { assetId: aid, ...b })
  return ok(c, { updated: true })
})

/* ───────────── Categories ───────────── */

adminRoutes.get('/categories', async (c) => {
  const rows = await many(
    c.env.DB,
    'SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS product_count FROM product_categories c ORDER BY family, sort_order, id',
  )
  return ok(c, rows)
})

const categorySchema = z.object({
  family: z.enum(['digital_assets', 'business_kits', 'agentic_solutions', 'implementation_services']),
  slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name_id: z.string().trim().min(2).max(120),
  name_en: z.string().trim().min(2).max(120),
  description_id: z.string().trim().max(1000).default(''),
  description_en: z.string().trim().max(1000).default(''),
  sort_order: z.number().int().min(0).max(1000).default(0),
  is_active: z.boolean().default(true),
})

adminRoutes.post('/categories', requirePermission('category.write'), async (c) => {
  const b = await parseJson(c, categorySchema)
  if (await one(c.env.DB, 'SELECT id FROM product_categories WHERE slug = ?', b.slug)) throw conflict('slug_taken')
  const r = await exec(
    c.env.DB,
    'INSERT INTO product_categories (family, slug, name_id, name_en, description_id, description_en, sort_order, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    b.family,
    b.slug,
    b.name_id,
    b.name_en,
    b.description_id,
    b.description_en,
    b.sort_order,
    b.is_active ? 1 : 0,
  )
  await log(c, 'category.created', 'category', r.lastId, { slug: b.slug })
  return ok(c, { id: r.lastId }, undefined, 201)
})

adminRoutes.put('/categories/:id', requirePermission('category.write'), async (c) => {
  const id = idParam(c.req.param('id'))
  const b = await parseJson(c, categorySchema)
  const existing = await one<{ family: string }>(c.env.DB, 'SELECT family FROM product_categories WHERE id = ?', id)
  if (!existing) throw notFound()
  const dup = await one<{ id: number }>(c.env.DB, 'SELECT id FROM product_categories WHERE slug = ?', b.slug)
  if (dup && dup.id !== id) throw conflict('slug_taken')
  if (existing.family !== b.family) {
    const used = await one(c.env.DB, 'SELECT id FROM products WHERE category_id = ? LIMIT 1', id)
    if (used) throw conflict('category_in_use_cannot_change_family')
  }
  await exec(
    c.env.DB,
    'UPDATE product_categories SET family = ?, slug = ?, name_id = ?, name_en = ?, description_id = ?, description_en = ?, sort_order = ?, is_active = ?, updated_at = ? WHERE id = ?',
    b.family,
    b.slug,
    b.name_id,
    b.name_en,
    b.description_id,
    b.description_en,
    b.sort_order,
    b.is_active ? 1 : 0,
    nowIso(),
    id,
  )
  await log(c, 'category.updated', 'category', id, { slug: b.slug })
  return ok(c, { updated: true })
})

adminRoutes.get('/licenses', async (c) => ok(c, await many(c.env.DB, 'SELECT id, key, name_id, name_en, summary_id, summary_en, status FROM product_licenses ORDER BY id')))

/* ───────────── Orders & payments ───────────── */

adminRoutes.get('/orders', requirePermission('order.read_all'), async (c) => {
  const { page, pageSize, offset } = pageParams(c.req.query('page'), c.req.query('pageSize'), 100)
  const status = c.req.query('status')
  const q = c.req.query('q')?.trim()
  const where: string[] = []
  const params: unknown[] = []
  if (status && status !== 'all') {
    where.push('o.status = ?')
    params.push(status)
  }
  if (q) {
    where.push("(o.public_id LIKE ? ESCAPE '\\' OR u.email LIKE ? ESCAPE '\\')")
    params.push(`%${likeEscape(q)}%`, `%${likeEscape(q)}%`)
  }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const rows = await many(
    c.env.DB,
    `SELECT o.public_id, o.status, o.total_idr, o.payment_provider, o.created_at, o.completed_at, u.email,
            (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count
     FROM orders o JOIN users u ON u.id = o.user_id ${w} ORDER BY o.created_at DESC LIMIT ? OFFSET ?`,
    ...params,
    pageSize,
    offset,
  )
  const total = await one<{ n: number }>(c.env.DB, `SELECT COUNT(*) AS n FROM orders o JOIN users u ON u.id = o.user_id ${w}`, ...params)
  return ok(c, rows, { page, pageSize, total: total?.n ?? 0 })
})

adminRoutes.get('/orders/:publicId', requirePermission('order.read_all'), async (c) => {
  const o = await one<OrderRow>(c.env.DB, 'SELECT * FROM orders WHERE public_id = ?', c.req.param('publicId'))
  if (!o) throw notFound()
  const customer = await one(c.env.DB, 'SELECT u.id, u.email, p.display_name FROM users u LEFT JOIN user_profiles p ON p.user_id = u.id WHERE u.id = ?', o.user_id)
  const history = await many(c.env.DB, "SELECT action, actor_role, metadata_json, created_at FROM audit_logs WHERE entity_type = 'order' AND entity_id = ? ORDER BY id", o.public_id)
  return ok(c, { ...(await orderDetail(c.env.DB, o, { admin: true })), customer, history })
})

/**
 * Admins may cancel unpaid orders and add notes. They can NEVER mark an order as paid:
 * that state is reserved for verified provider webhooks.
 */
adminRoutes.post('/orders/:publicId/action', requirePermission('order.update'), async (c) => {
  const b = await parseJson(c, z.object({ action: z.enum(['cancel', 'note']), note: z.string().trim().max(2000).default('') }))
  const o = await one<OrderRow>(c.env.DB, 'SELECT * FROM orders WHERE public_id = ?', c.req.param('publicId'))
  if (!o) throw notFound()
  const u = c.get('user')!
  if (b.action === 'cancel') {
    if (o.status !== 'pending_payment') throw conflict('only_pending_orders_can_be_cancelled')
    await transitionOrder(c.env, o, 'cancelled', { actorUserId: u.id, actorRole: u.role, reason: b.note || 'admin_cancelled' })
  } else {
    await exec(c.env.DB, 'UPDATE orders SET admin_note = ?, updated_at = ? WHERE id = ?', b.note, nowIso(), o.id)
    await log(c, 'order.note_updated', 'order', o.public_id)
  }
  return ok(c, { done: true })
})

adminRoutes.get('/payments', requirePermission('payment.read'), async (c) => {
  const rows = await many(
    c.env.DB,
    'SELECT p.provider, p.provider_ref, p.status, p.amount_idr, p.created_at, p.verified_at, o.public_id FROM payments p JOIN orders o ON o.id = p.order_id ORDER BY p.id DESC LIMIT 200',
  )
  const webhooks = await many(c.env.DB, 'SELECT provider, event_key, outcome, received_at FROM webhook_events ORDER BY id DESC LIMIT 50')
  return ok(c, { payments: rows, webhooks, provider: c.env.PAYMENT_PROVIDER ?? 'none' })
})

/* ───────────── Customers & roles ───────────── */

adminRoutes.get('/customers', requirePermission('customer.read'), async (c) => {
  const { page, pageSize, offset } = pageParams(c.req.query('page'), c.req.query('pageSize'), 100)
  const q = c.req.query('q')?.trim()
  const role = c.req.query('role')
  const where: string[] = ["u.status != 'deleted'"]
  const params: unknown[] = []
  if (q) {
    where.push("(u.email LIKE ? ESCAPE '\\' OR p.display_name LIKE ? ESCAPE '\\')")
    params.push(`%${likeEscape(q)}%`, `%${likeEscape(q)}%`)
  }
  if (role && (ROLES as readonly string[]).includes(role)) {
    where.push('u.role_id = ?')
    params.push(role)
  }
  const w = `WHERE ${where.join(' AND ')}`
  const rows = await many(
    c.env.DB,
    `SELECT u.id, u.email, u.email_verified, u.role_id, u.status, u.created_at, p.display_name, p.company, p.country,
            (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) AS order_count
     FROM users u LEFT JOIN user_profiles p ON p.user_id = u.id ${w} ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
    ...params,
    pageSize,
    offset,
  )
  const total = await one<{ n: number }>(c.env.DB, `SELECT COUNT(*) AS n FROM users u LEFT JOIN user_profiles p ON p.user_id = u.id ${w}`, ...params)
  return ok(c, rows, { page, pageSize, total: total?.n ?? 0 })
})

adminRoutes.get('/customers/:id', requirePermission('customer.read'), async (c) => {
  const id = idParam(c.req.param('id'))
  const u = await one(c.env.DB, 'SELECT u.id, u.email, u.email_verified, u.role_id, u.status, u.created_at, u.last_seen_at, p.* FROM users u LEFT JOIN user_profiles p ON p.user_id = u.id WHERE u.id = ?', id)
  if (!u) throw notFound()
  const orders = await many(c.env.DB, 'SELECT public_id, status, total_idr, created_at FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 50', id)
  const inquiries = await many(c.env.DB, 'SELECT public_id, service_type, status, created_at FROM service_inquiries WHERE user_id = ? ORDER BY created_at DESC LIMIT 50', id)
  await log(c, 'customer.viewed', 'user', id)
  return ok(c, { user: u, orders, inquiries })
})

adminRoutes.post('/users/:id/role', requirePermission('user.role_assign'), async (c) => {
  const id = idParam(c.req.param('id'))
  const b = await parseJson(c, z.object({ role: z.enum(ROLES) }))
  const actor = c.get('user')!
  if (id === actor.id) throw forbidden('cannot_change_own_role')
  const target = await one<{ role_id: string }>(c.env.DB, 'SELECT role_id FROM users WHERE id = ?', id)
  if (!target) throw notFound()
  if (target.role_id === 'super_admin' && b.role !== 'super_admin') {
    const n = await one<{ n: number }>(c.env.DB, "SELECT COUNT(*) AS n FROM users WHERE role_id = 'super_admin' AND status = 'active'")
    if ((n?.n ?? 0) <= 1) throw conflict('last_super_admin')
  }
  await exec(c.env.DB, 'UPDATE users SET role_id = ?, updated_at = ? WHERE id = ?', b.role, nowIso(), id)
  await log(c, 'user.role_changed', 'user', id, { from: target.role_id, to: b.role })
  return ok(c, { id, role: b.role })
})

adminRoutes.get('/roles', async (c) => {
  const roles = await many(c.env.DB, 'SELECT * FROM roles ORDER BY rank DESC')
  const perms = await many(c.env.DB, 'SELECT * FROM permissions ORDER BY key')
  const map = await many<{ role_id: string; permission_key: string }>(c.env.DB, 'SELECT * FROM role_permissions')
  return ok(c, {
    roles: roles.map((r) => ({ ...r, permissions: map.filter((m) => m.role_id === r.id).map((m) => m.permission_key) })),
    permissions: perms,
  })
})

/* ───────────── Inquiries ───────────── */

adminRoutes.get('/inquiries', requirePermission('inquiry.read'), async (c) => {
  const status = c.req.query('status')
  const { page, pageSize, offset } = pageParams(c.req.query('page'), c.req.query('pageSize'), 100)
  const w = status && status !== 'all' ? 'WHERE i.status = ?' : ''
  const params = status && status !== 'all' ? [status] : []
  const rows = await many(
    c.env.DB,
    `SELECT i.*, p.slug AS product_slug, p.title_en AS product_title FROM service_inquiries i LEFT JOIN products p ON p.id = i.product_id ${w} ORDER BY i.created_at DESC LIMIT ? OFFSET ?`,
    ...params,
    pageSize,
    offset,
  )
  const total = await one<{ n: number }>(c.env.DB, `SELECT COUNT(*) AS n FROM service_inquiries i ${w}`, ...params)
  return ok(
    c,
    rows.map(({ ip_hash: _ip, ...r }) => r),
    { page, pageSize, total: total?.n ?? 0 },
  )
})

adminRoutes.patch('/inquiries/:publicId', requirePermission('inquiry.update'), async (c) => {
  const b = await parseJson(c, z.object({ status: z.enum(INQUIRY_STATUSES).optional(), adminNote: z.string().trim().max(4000).optional() }))
  const i = await one<{ id: number; status: string }>(c.env.DB, 'SELECT id, status FROM service_inquiries WHERE public_id = ?', c.req.param('publicId'))
  if (!i) throw notFound()
  await exec(
    c.env.DB,
    'UPDATE service_inquiries SET status = COALESCE(?, status), admin_note = COALESCE(?, admin_note), updated_at = ? WHERE id = ?',
    b.status ?? null,
    b.adminNote ?? null,
    nowIso(),
    i.id,
  )
  await log(c, 'inquiry.updated', 'inquiry', c.req.param('publicId'), { from: i.status, to: b.status })
  return ok(c, { updated: true })
})

/* ───────────── Downloads & audit ───────────── */

adminRoutes.get('/downloads', requirePermission('download.read'), async (c) => {
  const rows = await many(
    c.env.DB,
    `SELECT e.created_at, u.email, a.filename, p.slug, p.title_en
     FROM download_events e JOIN users u ON u.id = e.user_id JOIN product_assets a ON a.id = e.asset_id JOIN products p ON p.id = a.product_id
     ORDER BY e.id DESC LIMIT 200`,
  )
  const grants = await one<{ n: number }>(c.env.DB, 'SELECT COUNT(*) AS n FROM downloads')
  return ok(c, { events: rows, grantsIssued: grants?.n ?? 0 })
})

adminRoutes.get('/audit', requirePermission('audit.read'), async (c) => {
  const { page, pageSize, offset } = pageParams(c.req.query('page'), c.req.query('pageSize'), 100)
  const entity = c.req.query('entityType')
  const w = entity ? 'WHERE a.entity_type = ?' : ''
  const params = entity ? [entity] : []
  const rows = await many(
    c.env.DB,
    `SELECT a.id, a.action, a.entity_type, a.entity_id, a.actor_role, a.metadata_json, a.created_at, u.email AS actor_email
     FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_user_id ${w} ORDER BY a.id DESC LIMIT ? OFFSET ?`,
    ...params,
    pageSize,
    offset,
  )
  const total = await one<{ n: number }>(c.env.DB, `SELECT COUNT(*) AS n FROM audit_logs a ${w}`, ...params)
  return ok(c, rows, { page, pageSize, total: total?.n ?? 0 })
})

/* ───────────── Settings ───────────── */

const SETTING_SCHEMAS: Record<string, z.ZodTypeAny> = {
  'site.name': z.string().trim().min(1).max(60),
  'site.tagline': z.object({ id: z.string().max(200), en: z.string().max(200) }),
  'site.contact_email': z.union([z.literal(''), z.string().email().max(200)]),
  'site.announcement': z.object({ id: z.string().max(300), en: z.string().max(300) }),
  'commerce.checkout_enabled': z.boolean(),
  'delivery.link_ttl_minutes': z.number().int().min(1).max(60),
  'delivery.max_uses': z.number().int().min(1).max(10),
}

adminRoutes.get('/settings', async (c) => {
  const rows = await many<{ key: string; value_json: string; is_public: number; updated_at: string }>(c.env.DB, 'SELECT * FROM site_settings ORDER BY key')
  return ok(
    c,
    rows.map((r) => ({ key: r.key, value: JSON.parse(r.value_json), isPublic: !!r.is_public, editable: r.key in SETTING_SCHEMAS, updatedAt: r.updated_at })),
  )
})

adminRoutes.put('/settings/:key', requirePermission('settings.write'), async (c) => {
  const key = c.req.param('key')
  const schema = SETTING_SCHEMAS[key]
  if (!schema) throw badRequest('setting_not_editable')
  const b = await parseJson(c, z.object({ value: schema }))
  if (key === 'commerce.checkout_enabled' && b.value === true) {
    if (c.get('user')!.role !== 'super_admin') throw forbidden('super_admin_required')
    if ((c.env.PAYMENT_PROVIDER ?? 'none') === 'none') throw conflict('no_payment_provider_configured')
    const unapproved = await one(c.env.DB, "SELECT slug FROM legal_documents WHERE status != 'approved' LIMIT 1")
    if (unapproved) throw conflict('legal_documents_not_approved')
  }
  await exec(c.env.DB, 'UPDATE site_settings SET value_json = ?, updated_by = ?, updated_at = ? WHERE key = ?', JSON.stringify(b.value), c.get('user')!.id, nowIso(), key)
  await log(c, 'settings.updated', 'setting', key, { value: b.value })
  return ok(c, { key, value: b.value })
})

/* ───────────── Legal content ───────────── */

adminRoutes.get('/legal', async (c) => ok(c, await many(c.env.DB, 'SELECT slug, title_id, title_en, body_id, body_en, status, version, approved_at, updated_at FROM legal_documents ORDER BY slug')))

adminRoutes.put('/legal/:slug', requirePermission('legal.write'), async (c) => {
  const slug = c.req.param('slug')
  if (!(LEGAL_SLUGS as readonly string[]).includes(slug)) throw notFound()
  const b = await parseJson(
    c,
    z.object({ title_id: z.string().trim().min(2).max(160), title_en: z.string().trim().min(2).max(160), body_id: z.string().max(60000), body_en: z.string().max(60000) }),
  )
  // Any edit returns the document to DRAFT until re-approved.
  await exec(
    c.env.DB,
    "UPDATE legal_documents SET title_id = ?, title_en = ?, body_id = ?, body_en = ?, status = 'draft', version = version + 1, approved_by = NULL, approved_at = NULL, updated_by = ?, updated_at = ? WHERE slug = ?",
    b.title_id,
    b.title_en,
    b.body_id,
    b.body_en,
    c.get('user')!.id,
    nowIso(),
    slug,
  )
  await log(c, 'legal.updated', 'legal', slug)
  return ok(c, { slug, status: 'draft' })
})

adminRoutes.post('/legal/:slug/approve', requirePermission('legal.approve'), async (c) => {
  const slug = c.req.param('slug')
  const b = await parseJson(c, z.object({ confirmLegalReview: z.literal(true) }))
  void b
  const r = await exec(c.env.DB, "UPDATE legal_documents SET status = 'approved', approved_by = ?, approved_at = ? WHERE slug = ? AND status = 'draft'", c.get('user')!.id, nowIso(), slug)
  if (r.changes !== 1) throw conflict('not_in_draft')
  await log(c, 'legal.approved', 'legal', slug)
  return ok(c, { slug, status: 'approved' })
})

/* ───────────── Exports (CSV) ───────────── */

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return ''
  const cols = Object.keys(rows[0])
  const esc = (v: unknown) => {
    let s = v == null ? '' : String(v)
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}` // CSV/formula injection guard
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n')
}

const EXPORTS: Record<string, { perm: Parameters<typeof requirePermission>[0]; sql: string }> = {
  orders: {
    perm: 'order.read_all',
    sql: 'SELECT o.public_id, o.status, o.total_idr, o.payment_provider, o.created_at, o.paid_at, o.completed_at, u.email FROM orders o JOIN users u ON u.id = o.user_id ORDER BY o.id',
  },
  products: {
    perm: 'product.read_all',
    sql: 'SELECT id, slug, family, status, maturity, pricing_model, price_idr, is_demo, published_at, updated_at, title_en FROM products ORDER BY id',
  },
  inquiries: {
    perm: 'inquiry.read',
    sql: 'SELECT public_id, name, email, company, service_type, budget_range, status, created_at FROM service_inquiries ORDER BY id',
  },
  customers: {
    perm: 'customer.read',
    sql: "SELECT u.id, u.email, u.role_id, u.created_at, p.display_name, p.company, p.country FROM users u LEFT JOIN user_profiles p ON p.user_id = u.id WHERE u.status != 'deleted' ORDER BY u.id",
  },
}

adminRoutes.get('/exports/:dataset', requirePermission('export.data'), async (c) => {
  const ds = EXPORTS[c.req.param('dataset')]
  if (!ds) throw notFound()
  if (!c.get('user')!.permissions.has(ds.perm)) throw forbidden('missing_permission')
  const rows = await many(c.env.DB, ds.sql)
  await log(c, 'export.generated', 'export', c.req.param('dataset'), { rows: rows.length })
  return new Response(toCsv(rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="orsaven-${c.req.param('dataset')}-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
})
