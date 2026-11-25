import type { CurrentUser, Env } from '../types'
import { exec, nowIso, one } from '../lib/db'
import { ApiError, forbidden, notFound } from '../lib/http'
import { hashIp, randomToken, sha256Hex } from '../lib/crypto'
import { audit } from './audit'
import { getSetting } from './settings'
import { storageFor } from './storage'

/**
 * Issue a short-lived, use-limited download grant.
 * Ownership is verified server-side: the order item must belong to the caller,
 * the order must be completed, and the asset must be an active deliverable of that product.
 */
export async function issueDownload(env: Env, user: CurrentUser, orderItemId: number, assetId: number, ip?: string) {
  const item = await one<{ id: number; product_id: number; user_id: number; status: string; public_id: string }>(
    env.DB,
    `SELECT oi.id, oi.product_id, o.user_id, o.status, o.public_id FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE oi.id = ?`,
    orderItemId,
  )
  // Same response for "not yours" and "does not exist" to avoid IDOR enumeration.
  if (!item || item.user_id !== user.id) throw notFound()
  if (item.status !== 'completed') throw forbidden('order_not_deliverable')
  const asset = await one<{ id: number; filename: string }>(
    env.DB,
    `SELECT id, filename FROM product_assets WHERE id = ? AND product_id = ? AND kind = 'deliverable' AND is_active = 1`,
    assetId,
    item.product_id,
  )
  if (!asset) throw notFound()
  const ttlMin = Math.min(60, Math.max(1, await getSetting<number>(env.DB, 'delivery.link_ttl_minutes', 15)))
  const maxUses = Math.min(10, Math.max(1, await getSetting<number>(env.DB, 'delivery.max_uses', 3)))
  const token = randomToken(32)
  const expires = new Date(Date.now() + ttlMin * 60_000).toISOString()
  await exec(
    env.DB,
    `INSERT INTO downloads (user_id, order_item_id, asset_id, token_hash, expires_at, max_uses) VALUES (?, ?, ?, ?, ?, ?)`,
    user.id,
    item.id,
    asset.id,
    await sha256Hex(token),
    expires,
    maxUses,
  )
  await audit(env, {
    actorUserId: user.id,
    actorRole: user.role,
    action: 'download.issued',
    entityType: 'order',
    entityId: item.public_id,
    metadata: { assetId: asset.id },
    ipHash: await hashIp(ip, env.IP_HASH_SALT),
  })
  return { url: `/api/v1/downloads/${token}`, expiresAt: expires, maxUses, filename: asset.filename }
}

/** Redeem a grant and stream the private file. Never exposes storage keys or paths. */
export async function redeemDownload(env: Env, token: string, ip?: string, ua?: string) {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) throw notFound()
  const hash = await sha256Hex(token)
  const d = await one<{ id: number; user_id: number; order_item_id: number; asset_id: number; expires_at: string; max_uses: number; use_count: number }>(
    env.DB,
    'SELECT * FROM downloads WHERE token_hash = ?',
    hash,
  )
  if (!d) throw notFound()
  if (Date.parse(d.expires_at) < Date.now()) throw new ApiError(410, 'download_expired', 'This download link has expired')
  // Re-check entitlement at redemption time (e.g. refunds revoke access).
  const ok = await one(
    env.DB,
    `SELECT o.id FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE oi.id = ? AND o.user_id = ? AND o.status = 'completed'`,
    d.order_item_id,
    d.user_id,
  )
  if (!ok) throw forbidden('order_not_deliverable')
  const used = await exec(
    env.DB,
    'UPDATE downloads SET use_count = use_count + 1, last_used_at = ? WHERE id = ? AND use_count < max_uses',
    nowIso(),
    d.id,
  )
  if (used.changes !== 1) throw new ApiError(410, 'download_exhausted', 'This download link has been used up')
  const asset = await one<{ id: number; filename: string; content_type: string; storage_driver: 'r2' | 'd1'; storage_key: string; is_active: number; sha256: string }>(
    env.DB,
    'SELECT * FROM product_assets WHERE id = ?',
    d.asset_id,
  )
  if (!asset || !asset.is_active) throw notFound()
  const data = await storageFor(env, asset.storage_driver).get(asset.storage_key)
  if (!data) throw new ApiError(500, 'file_unavailable')
  await exec(
    env.DB,
    'INSERT INTO download_events (download_id, user_id, asset_id, ip_hash, user_agent) VALUES (?, ?, ?, ?, ?)',
    d.id,
    d.user_id,
    asset.id,
    await hashIp(ip, env.IP_HASH_SALT),
    (ua ?? '').slice(0, 200),
  )
  const safeName = asset.filename.replace(/[^\w.\- ]+/g, '_')
  return new Response(data as BodyInit, {
    headers: {
      'Content-Type': asset.content_type,
      'Content-Disposition': `attachment; filename="${safeName}"`,
      'Content-Length': String(data.byteLength),
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      ETag: `"${asset.sha256.slice(0, 32)}"`,
    },
  })
}
