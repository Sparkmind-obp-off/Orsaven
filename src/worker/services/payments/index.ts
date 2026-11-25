import type { Env } from '../../types'
import { hmacSha256, safeEqual, sha512Hex, toHex } from '../../lib/crypto'
import { PaymentsUnavailableError, type PaymentProvider, type VerifiedPaymentStatus, type WebhookVerification } from './types'

export * from './types'

/** Default: no provider. Checkout creates pending orders but cannot collect payment. */
export const noneProvider: PaymentProvider = {
  name: 'none',
  isConfigured: () => false,
  async createCheckout() {
    throw new PaymentsUnavailableError()
  },
  async verifyWebhook(): Promise<WebhookVerification> {
    return { verified: false, eventKey: '', orderPublicId: '', providerRef: '', status: 'failed', amountIdr: 0, reason: 'no_provider' }
  },
}

/**
 * Midtrans Snap adapter (prepared, INACTIVE until MIDTRANS_SERVER_KEY is set and the
 * owner authorises activation). Signature: SHA512(order_id + status_code + gross_amount + server_key).
 */
export function midtransProvider(env: Env): PaymentProvider {
  const key = env.MIDTRANS_SERVER_KEY ?? ''
  const prod = env.MIDTRANS_IS_PRODUCTION === 'true'
  const base = prod ? 'https://app.midtrans.com' : 'https://app.sandbox.midtrans.com'
  return {
    name: 'midtrans',
    isConfigured: () => key.length > 0,
    async createCheckout(req) {
      if (!key) throw new PaymentsUnavailableError()
      const res = await fetch(`${base}/snap/v1/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Basic ${btoa(`${key}:`)}` },
        body: JSON.stringify({
          transaction_details: { order_id: req.orderPublicId, gross_amount: req.amountIdr },
          item_details: req.items,
          customer_details: req.customerEmail ? { email: req.customerEmail } : undefined,
          callbacks: { finish: req.returnUrl },
        }),
      })
      if (!res.ok) throw new Error(`midtrans_checkout_failed_${res.status}`)
      const j = (await res.json()) as { token: string; redirect_url: string }
      return { providerRef: req.orderPublicId, checkoutUrl: j.redirect_url }
    },
    async verifyWebhook(request) {
      const fail = (reason: string): WebhookVerification => ({ verified: false, eventKey: '', orderPublicId: '', providerRef: '', status: 'failed', amountIdr: 0, reason })
      if (!key) return fail('not_configured')
      let b: Record<string, string>
      try {
        b = (await request.json()) as Record<string, string>
      } catch {
        return fail('invalid_json')
      }
      const expected = await sha512Hex(`${b.order_id}${b.status_code}${b.gross_amount}${key}`)
      if (!b.signature_key || !safeEqual(expected, String(b.signature_key))) return fail('bad_signature')
      const ts = b.transaction_status
      const fraud = b.fraud_status
      let status: VerifiedPaymentStatus = 'pending'
      if ((ts === 'capture' && fraud === 'accept') || ts === 'settlement') status = 'paid'
      else if (ts === 'deny' || ts === 'cancel') status = 'failed'
      else if (ts === 'expire') status = 'expired'
      else if (ts === 'refund' || ts === 'partial_refund') status = 'refunded'
      return {
        verified: true,
        eventKey: `${b.transaction_id}:${ts}`,
        orderPublicId: b.order_id,
        providerRef: b.order_id,
        status,
        amountIdr: Math.round(Number(b.gross_amount)),
      }
    },
  }
}

/**
 * Test-only provider: HMAC-signed webhooks for automated tests. Refuses to operate
 * unless ENVIRONMENT === 'test', so it can never mark a production order as paid.
 */
export function testProvider(env: Env): PaymentProvider {
  const secret = env.TEST_PAYMENT_SECRET ?? ''
  const enabled = env.ENVIRONMENT === 'test' && secret.length >= 16
  return {
    name: 'test',
    isConfigured: () => enabled,
    async createCheckout(req) {
      if (!enabled) throw new PaymentsUnavailableError()
      return { providerRef: `test_${req.orderPublicId}`, checkoutUrl: `/account/orders/${req.orderPublicId}?test_checkout=1` }
    },
    async verifyWebhook(request) {
      const raw = await request.text()
      const sig = request.headers.get('X-Test-Signature') ?? ''
      if (!enabled) return { verified: false, eventKey: '', orderPublicId: '', providerRef: '', status: 'failed', amountIdr: 0, reason: 'disabled' }
      const expected = toHex(await hmacSha256(secret, raw))
      if (!safeEqual(expected, sig)) return { verified: false, eventKey: '', orderPublicId: '', providerRef: '', status: 'failed', amountIdr: 0, reason: 'bad_signature' }
      const b = JSON.parse(raw) as { event_id: string; order_id: string; provider_ref: string; status: VerifiedPaymentStatus; amount: number }
      return { verified: true, eventKey: b.event_id, orderPublicId: b.order_id, providerRef: b.provider_ref, status: b.status, amountIdr: b.amount }
    },
  }
}

export function getProvider(env: Env, name = env.PAYMENT_PROVIDER ?? 'none'): PaymentProvider {
  if (name === 'midtrans') return midtransProvider(env)
  if (name === 'test') return testProvider(env)
  return noneProvider
}
