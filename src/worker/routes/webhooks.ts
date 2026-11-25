import { Hono } from 'hono'
import type { AppEnv, Env } from '../types'
import { base64ToBytes, bytesToBase64, hmacSha256, safeEqual } from '../lib/crypto'
import { exec, nowIso, one } from '../lib/db'
import { ok } from '../lib/http'
import { audit } from '../services/audit'
import { applyPaymentEvent } from '../services/orders'
import { getProvider } from '../services/payments'

export const webhookRoutes = new Hono<AppEnv>()

/** Payment webhooks: signature verification is delegated to the provider adapter. */
webhookRoutes.post('/payments/:provider', async (c) => {
  const name = c.req.param('provider')
  const configured = c.env.PAYMENT_PROVIDER ?? 'none'
  if (name !== configured || name === 'none') return c.json({ error: { code: 'provider_not_active' } }, 404)
  const provider = getProvider(c.env, name)
  const v = await provider.verifyWebhook(c.req.raw)
  if (!v.verified) {
    await audit(c.env, { actorUserId: null, actorRole: 'payment_provider', action: 'payment.webhook_rejected', entityType: 'payment', metadata: { provider: name, reason: v.reason } })
    return c.json({ error: { code: 'invalid_signature' } }, 401)
  }
  const result = await applyPaymentEvent(c.env, name, v)
  return ok(c, result)
})

/** Verify a Svix-signed Clerk webhook (https://docs.svix.com/receiving/verifying-payloads/how-manual). */
export async function verifySvix(env: Env, headers: Headers, body: string): Promise<boolean> {
  const secret = env.CLERK_WEBHOOK_SECRET
  if (!secret) return false
  const id = headers.get('svix-id')
  const ts = headers.get('svix-timestamp')
  const sigs = headers.get('svix-signature')
  if (!id || !ts || !sigs) return false
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false
  const key = base64ToBytes(secret.replace(/^whsec_/, ''))
  const expected = bytesToBase64(await hmacSha256(key, `${id}.${ts}.${body}`))
  return sigs.split(' ').some((s) => {
    const [, sig] = s.split(',')
    return !!sig && safeEqual(sig, expected)
  })
}

webhookRoutes.post('/clerk', async (c) => {
  const body = await c.req.text()
  if (!(await verifySvix(c.env, c.req.raw.headers, body))) return c.json({ error: { code: 'invalid_signature' } }, 401)
  const evt = JSON.parse(body) as { type: string; data: { id: string; email_addresses?: { id: string; email_address: string; verification?: { status: string } }[]; primary_email_address_id?: string } }
  const u = await one<{ id: number }>(c.env.DB, 'SELECT id FROM users WHERE clerk_user_id = ?', evt.data.id)
  if (evt.type === 'user.deleted' && u) {
    await exec(c.env.DB, "UPDATE users SET status = 'deleted', email = NULL, updated_at = ? WHERE id = ?", nowIso(), u.id)
    await exec(c.env.DB, "UPDATE user_profiles SET display_name = '', company = '', phone = '' WHERE user_id = ?", u.id)
    await audit(c.env, { actorUserId: null, actorRole: 'clerk', action: 'user.deleted', entityType: 'user', entityId: String(u.id) })
  } else if (evt.type === 'user.updated' && u) {
    const primary = evt.data.email_addresses?.find((e) => e.id === evt.data.primary_email_address_id)
    if (primary) {
      await exec(c.env.DB, 'UPDATE users SET email = ?, email_verified = ?, updated_at = ? WHERE id = ?', primary.email_address.toLowerCase(), primary.verification?.status === 'verified' ? 1 : 0, nowIso(), u.id)
    }
  }
  return ok(c, { received: true })
})
