import type { Env, CurrentUser } from '../types'
import { canTransitionOrder, type OrderStatus } from '../../shared/domain'
import { exec, many, nowIso, one, type Row } from '../lib/db'
import { ApiError, badRequest, conflict } from '../lib/http'
import { newLicenseCode, newOrderId } from '../lib/crypto'
import { getProductById, isPurchasable } from './catalog'
import { audit } from './audit'
import { getProvider, PaymentsUnavailableError, type WebhookVerification } from './payments'
import { getSetting } from './settings'

export interface OrderRow {
  id: number
  public_id: string
  user_id: number
  status: OrderStatus
  total_idr: number
  subtotal_idr: number
  currency: string
  payment_provider: string
  customer_note: string
  admin_note: string
  created_at: string
  updated_at: string
  paid_at: string | null
  completed_at: string | null
  cancelled_at: string | null
}

/**
 * Transition an order. Throws when the transition is not allowed by the state machine.
 * Uses a conditional UPDATE (WHERE status = from) so concurrent writers cannot double-transition.
 */
export async function transitionOrder(env: Env, order: OrderRow, to: OrderStatus, ctx: { actorUserId: number | null; actorRole: string; reason: string }) {
  if (!canTransitionOrder(order.status, to)) throw conflict('invalid_order_transition', { from: order.status, to })
  const ts = nowIso()
  const col = to === 'paid' ? ', paid_at = ?' : to === 'completed' ? ', completed_at = ?' : to === 'cancelled' ? ', cancelled_at = ?' : ''
  const params: unknown[] = [to, ts]
  if (col) params.push(ts)
  params.push(order.id, order.status)
  const r = await exec(env.DB, `UPDATE orders SET status = ?, updated_at = ?${col} WHERE id = ? AND status = ?`, ...params)
  if (r.changes !== 1) throw conflict('order_state_changed')
  await audit(env, {
    actorUserId: ctx.actorUserId,
    actorRole: ctx.actorRole,
    action: `order.${to}`,
    entityType: 'order',
    entityId: order.public_id,
    metadata: { from: order.status, to, reason: ctx.reason },
  })
  return { ...order, status: to }
}

export async function createOrder(env: Env, user: CurrentUser, productIds: number[], note: string, origin: string) {
  const unique = [...new Set(productIds)]
  if (unique.length === 0 || unique.length > 10) throw badRequest('invalid_items')
  const products: Row[] = []
  for (const id of unique) {
    const p = await getProductById(env.DB, id)
    if (!p || p.status !== 'published') throw new ApiError(404, 'product_not_found')
    if (!isPurchasable(p)) throw new ApiError(422, 'product_not_purchasable', 'This product is not available for purchase', { productId: id })
    const owned = await one(
      env.DB,
      `SELECT oi.id FROM order_items oi JOIN orders o ON o.id = oi.order_id
       WHERE o.user_id = ? AND oi.product_id = ? AND o.status IN ('pending_payment','paid','completed')`,
      user.id,
      id,
    )
    if (owned) throw conflict('already_owned_or_pending', { productId: id })
    products.push(p)
  }
  const total = products.reduce((s, p) => s + (p.pricing_model === 'free' ? 0 : Number(p.price_idr ?? 0)), 0)
  const isFree = total === 0
  if (!isFree) {
    const enabled = await getSetting<boolean>(env.DB, 'commerce.checkout_enabled', false)
    if (!enabled) throw new ApiError(503, 'checkout_disabled', 'Paid checkout is not yet enabled')
  }
  const provider = isFree ? null : getProvider(env)
  if (provider && !provider.isConfigured()) throw new ApiError(503, 'payments_unavailable', 'No payment provider is configured')

  const publicId = newOrderId()
  const ins = await exec(
    env.DB,
    `INSERT INTO orders (public_id, user_id, status, subtotal_idr, total_idr, payment_provider, customer_note) VALUES (?, ?, 'pending_payment', ?, ?, ?, ?)`,
    publicId,
    user.id,
    total,
    total,
    isFree ? 'free' : provider!.name,
    note,
  )
  for (const p of products) {
    await exec(
      env.DB,
      `INSERT INTO order_items (order_id, product_id, version_id, title_snapshot, license_snapshot, unit_price_idr, license_code) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ins.lastId,
      p.id,
      p.current_version_id ?? null,
      String(p.title_en),
      String(p.license_key ?? ''),
      p.pricing_model === 'free' ? 0 : Number(p.price_idr ?? 0),
      newLicenseCode(),
    )
  }
  let order = (await one<OrderRow>(env.DB, 'SELECT * FROM orders WHERE id = ?', ins.lastId))!
  await audit(env, { actorUserId: user.id, actorRole: user.role, action: 'order.created', entityType: 'order', entityId: publicId, metadata: { total, items: unique } })

  if (isFree) {
    // No payment is involved, so nothing is fabricated: free claims complete directly.
    order = await transitionOrderFromPending(env, order, 'completed', user)
    return { order, checkoutUrl: null as string | null }
  }
  try {
    const session = await provider!.createCheckout({
      orderPublicId: publicId,
      amountIdr: total,
      customerEmail: user.email,
      items: products.map((p) => ({ id: String(p.id), name: String(p.title_en).slice(0, 50), price: Number(p.price_idr), quantity: 1 })),
      returnUrl: `${origin}/account/orders/${publicId}`,
    })
    await exec(
      env.DB,
      `INSERT INTO payments (order_id, provider, provider_ref, status, amount_idr, checkout_url) VALUES (?, ?, ?, 'pending', ?, ?)`,
      order.id,
      provider!.name,
      session.providerRef,
      total,
      session.checkoutUrl,
    )
    return { order, checkoutUrl: session.checkoutUrl }
  } catch (e) {
    if (e instanceof PaymentsUnavailableError) throw new ApiError(503, 'payments_unavailable')
    await transitionOrder(env, order, 'failed', { actorUserId: null, actorRole: 'system', reason: 'checkout_session_failed' })
    throw new ApiError(502, 'payment_provider_error')
  }
}

/** Free orders: pending → completed without a payment step (amount is zero). */
async function transitionOrderFromPending(env: Env, order: OrderRow, to: 'completed', user: CurrentUser) {
  if (order.total_idr !== 0) throw conflict('not_free')
  const ts = nowIso()
  const r = await exec(env.DB, `UPDATE orders SET status = ?, completed_at = ?, updated_at = ? WHERE id = ? AND status = 'pending_payment' AND total_idr = 0`, to, ts, ts, order.id)
  if (r.changes !== 1) throw conflict('order_state_changed')
  await audit(env, { actorUserId: user.id, actorRole: user.role, action: 'order.completed', entityType: 'order', entityId: order.public_id, metadata: { reason: 'free_claim' } })
  return { ...order, status: to, completed_at: ts }
}

/**
 * Apply a VERIFIED provider event. This is the only code path that can mark an order paid.
 * Idempotent via webhook_events(provider, event_key).
 */
export async function applyPaymentEvent(env: Env, providerName: string, v: WebhookVerification) {
  if (!v.verified) return { outcome: 'rejected', reason: v.reason }
  const dup = await one(env.DB, 'SELECT id FROM webhook_events WHERE provider = ? AND event_key = ?', providerName, v.eventKey)
  if (dup) return { outcome: 'duplicate' }
  const order = await one<OrderRow>(env.DB, 'SELECT * FROM orders WHERE public_id = ?', v.orderPublicId)
  let outcome = 'ignored'
  if (!order) outcome = 'order_not_found'
  else if (order.payment_provider !== providerName) outcome = 'provider_mismatch'
  else if (v.status === 'paid') {
    if (v.amountIdr !== order.total_idr) outcome = 'amount_mismatch'
    else if (order.status === 'pending_payment') {
      await exec(env.DB, `UPDATE payments SET status = 'verified', verified_at = ?, updated_at = ? WHERE order_id = ? AND provider = ?`, nowIso(), nowIso(), order.id, providerName)
      const paid = await transitionOrder(env, order, 'paid', { actorUserId: null, actorRole: 'payment_provider', reason: `verified:${providerName}` })
      await transitionOrder(env, paid, 'completed', { actorUserId: null, actorRole: 'system', reason: 'digital_delivery_ready' })
      outcome = 'paid'
    } else outcome = 'already_processed'
  } else if (v.status === 'failed' || v.status === 'expired') {
    if (order.status === 'pending_payment') {
      await exec(env.DB, `UPDATE payments SET status = ?, updated_at = ? WHERE order_id = ? AND provider = ?`, v.status, nowIso(), order.id, providerName)
      await transitionOrder(env, order, 'failed', { actorUserId: null, actorRole: 'payment_provider', reason: v.status })
      outcome = v.status
    }
  } else if (v.status === 'refunded') {
    if (order.status === 'paid' || order.status === 'completed') {
      await exec(env.DB, `UPDATE payments SET status = 'refunded', updated_at = ? WHERE order_id = ? AND provider = ?`, nowIso(), order.id, providerName)
      await transitionOrder(env, order, 'refunded', { actorUserId: null, actorRole: 'payment_provider', reason: 'provider_refund' })
      outcome = 'refunded'
    }
  }
  await exec(env.DB, 'INSERT OR IGNORE INTO webhook_events (provider, event_key, outcome) VALUES (?, ?, ?)', providerName, v.eventKey, outcome)
  return { outcome }
}

export async function orderDetail(db: D1Database, order: OrderRow, opts: { admin: boolean }) {
  const items = await many(
    db,
    `SELECT oi.id, oi.product_id, oi.title_snapshot, oi.license_snapshot, oi.unit_price_idr, oi.license_code,
            p.slug, p.title_id, p.title_en, p.family, v.version
     FROM order_items oi JOIN products p ON p.id = oi.product_id LEFT JOIN product_versions v ON v.id = oi.version_id
     WHERE oi.order_id = ? ORDER BY oi.id`,
    order.id,
  )
  const deliverable = order.status === 'completed'
  const payments = await many(db, 'SELECT provider, status, amount_idr, created_at, verified_at FROM payments WHERE order_id = ? ORDER BY id', order.id)
  return {
    publicId: order.public_id,
    status: order.status,
    totalIdr: order.total_idr,
    currency: order.currency,
    paymentProvider: order.payment_provider,
    customerNote: order.customer_note,
    ...(opts.admin ? { adminNote: order.admin_note, userId: order.user_id } : {}),
    createdAt: order.created_at,
    paidAt: order.paid_at,
    completedAt: order.completed_at,
    cancelledAt: order.cancelled_at,
    deliveryAvailable: deliverable,
    payments,
    items: items.map((i) => ({
      id: i.id,
      productId: i.product_id,
      slug: i.slug,
      title: { id: i.title_id, en: i.title_en },
      family: i.family,
      version: i.version,
      license: i.license_snapshot,
      // License codes are only revealed once the order is deliverable.
      licenseCode: deliverable || opts.admin ? i.license_code : null,
      unitPriceIdr: i.unit_price_idr,
    })),
  }
}
