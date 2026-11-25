/**
 * Payment-provider-independent contract.
 * A provider adapter may CREATE a checkout session and VERIFY a webhook.
 * Only `verifyWebhook` returning `{ verified: true, status: 'paid' }` can move an order to `paid`.
 */
export interface CheckoutRequest {
  orderPublicId: string
  amountIdr: number
  customerEmail: string | null
  items: { id: string; name: string; price: number; quantity: number }[]
  returnUrl: string
}

export interface CheckoutSession {
  providerRef: string
  checkoutUrl: string
}

export type VerifiedPaymentStatus = 'paid' | 'pending' | 'failed' | 'expired' | 'refunded'

export interface WebhookVerification {
  verified: boolean
  eventKey: string
  orderPublicId: string
  providerRef: string
  status: VerifiedPaymentStatus
  amountIdr: number
  reason?: string
}

export interface PaymentProvider {
  name: string
  /** True when the provider has the credentials needed to operate. */
  isConfigured(): boolean
  createCheckout(req: CheckoutRequest): Promise<CheckoutSession>
  verifyWebhook(request: Request): Promise<WebhookVerification>
}

export class PaymentsUnavailableError extends Error {
  constructor() {
    super('payments_unavailable')
  }
}
