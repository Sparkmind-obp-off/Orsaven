import { describe, expect, it } from 'vitest'
import { canTransitionOrder, canTransitionProduct, ROLE_PERMISSIONS, validateUpload } from '../src/shared/domain'
import { validatePricing } from '../src/worker/services/catalog'

describe('product workflow state machine', () => {
  it('allows draft → review via submit only', () => {
    expect(canTransitionProduct('submit', 'draft')).toBe(true)
    expect(canTransitionProduct('publish', 'draft')).toBe(false)
    expect(canTransitionProduct('approve', 'draft')).toBe(false)
  })
  it('does not allow publishing archived products directly', () => {
    expect(canTransitionProduct('publish', 'archived')).toBe(false)
    expect(canTransitionProduct('restore_draft', 'archived')).toBe(true)
  })
})

describe('order state machine', () => {
  it('only reaches paid from pending_payment', () => {
    expect(canTransitionOrder('pending_payment', 'paid')).toBe(true)
    expect(canTransitionOrder('cancelled', 'paid')).toBe(false)
    expect(canTransitionOrder('failed', 'paid')).toBe(false)
    expect(canTransitionOrder('completed', 'paid')).toBe(false)
  })
  it('never skips straight from pending to completed', () => {
    expect(canTransitionOrder('pending_payment', 'completed')).toBe(false)
  })
  it('treats terminal states as terminal', () => {
    for (const s of ['cancelled', 'failed', 'refunded'] as const) expect(canTransitionOrder(s, 'pending_payment')).toBe(false)
  })
})

describe('role permissions', () => {
  it('administrators cannot approve, publish or assign roles', () => {
    const a = ROLE_PERMISSIONS.administrator
    expect(a).not.toContain('product.approve')
    expect(a).not.toContain('product.publish')
    expect(a).not.toContain('user.role_assign')
    expect(a).toContain('product.write')
  })
  it('customers have no admin permissions', () => {
    expect(ROLE_PERMISSIONS.customer).toEqual([])
  })
})

describe('upload validation', () => {
  it('accepts allowed type with matching extension', () => {
    expect(validateUpload('guide.pdf', 'application/pdf', 1000)).toBeNull()
  })
  it('rejects mismatched extension, path traversal, oversize, and executables', () => {
    expect(validateUpload('guide.exe', 'application/pdf', 10)).toBe('extension_mismatch')
    expect(validateUpload('../x.pdf', 'application/pdf', 10)).toBe('invalid_filename')
    expect(validateUpload('x.pdf', 'application/pdf', 60 * 1024 * 1024)).toBe('file_too_large')
    expect(validateUpload('x.exe', 'application/x-msdownload', 10)).toBe('unsupported_type')
    expect(validateUpload('x.pdf', 'application/pdf', 0)).toBe('empty_file')
  })
})

describe('pricing validation', () => {
  it('requires a price for one-time products', () => {
    expect(validatePricing({ pricing_model: 'one_time', price_idr: null, family: 'digital_assets' })).toBe('price_required')
  })
  it('requires quote pricing for implementation services', () => {
    expect(validatePricing({ pricing_model: 'one_time', price_idr: 100, family: 'implementation_services' })).toBe('services_require_quote_pricing')
    expect(validatePricing({ pricing_model: 'quote', price_idr: null, family: 'implementation_services' })).toBeNull()
  })
})
