import { describe, expect, it } from 'vitest'
import { makeAdmin, productBody, publishedProduct, setup, signTestWebhook, tokens } from './helpers'

describe('public API', () => {
  it('health + config expose no secrets', async () => {
    const ctx = setup({ CLERK_SECRET_KEY: 'sk_live_SHOULD_NOT_LEAK', CLERK_PUBLISHABLE_KEY: 'pk_live_Y2xlcmsub3JzYXZlbi5iaXouaWQk' })
    const h = await ctx.call('GET', '/api/v1/health')
    expect(h.status).toBe(200)
    const c = await ctx.call('GET', '/api/v1/config')
    const body = JSON.stringify(c.json)
    expect(body).not.toContain('sk_live')
    expect(c.json.data!['clerkFrontendApi']).toBe('https://clerk.orsaven.biz.id')
  })

  it('sets security headers', async () => {
    const ctx = setup()
    const r = await ctx.call('GET', '/api/v1/health')
    expect(r.res.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(r.res.headers.get('X-Frame-Options')).toBe('DENY')
    expect(r.res.headers.get('Cache-Control')).toBe('no-store')
    const html = await ctx.app.request('https://orsaven.biz.id/', {}, ctx.env)
    expect(html.headers.get('Content-Security-Policy')).toContain("frame-ancestors 'none'")
  })

  it('lists families and 24 seeded categories', async () => {
    const ctx = setup()
    const f = await ctx.call('GET', '/api/v1/catalog/families')
    expect((f.json.data as unknown[]).length).toBe(4)
    const c = await ctx.call('GET', '/api/v1/catalog/categories')
    expect((c.json.data as unknown[]).length).toBe(24)
  })

  it('legal documents are served as draft', async () => {
    const ctx = setup()
    const r = await ctx.call('GET', '/api/v1/legal/privacy')
    expect(r.status).toBe(200)
    expect(r.json.data!['status']).toBe('draft')
    expect((await ctx.call('GET', '/api/v1/legal/unknown')).status).toBe(404)
  })

  it('unknown API path returns JSON 404', async () => {
    const ctx = setup()
    const r = await ctx.call('GET', '/api/v1/nope')
    expect(r.status).toBe(404)
    expect(r.json.error!.code).toBe('not_found')
  })

  it('rejects cross-origin state-changing requests', async () => {
    const ctx = setup()
    const r = await ctx.call('POST', '/api/v1/inquiries', { headers: { Origin: 'https://evil.example' }, body: {} })
    expect(r.status).toBe(403)
  })
})

describe('authentication & authorization boundaries', () => {
  it('anonymous users cannot reach account or admin APIs', async () => {
    const ctx = setup()
    expect((await ctx.call('GET', '/api/v1/account')).status).toBe(401)
    expect((await ctx.call('GET', '/api/v1/admin/overview')).status).toBe(401)
    expect((await ctx.call('GET', '/api/v1/account', { token: 'garbage' })).status).toBe(401)
  })

  it('maps a new Clerk user to a customer; browser cannot pick its role', async () => {
    const ctx = setup()
    const r = await ctx.call('GET', '/api/v1/account', { token: tokens.alice, headers: { 'X-Role': 'super_admin' } })
    expect(r.status).toBe(200)
    expect(r.json.data!['role']).toBe('customer')
    expect((await ctx.call('GET', '/api/v1/admin/overview', { token: tokens.alice })).status).toBe(403)
  })

  it('bootstraps super admin only from the server-side allowlist with a verified email', async () => {
    const ctx = setup()
    const r = await ctx.call('GET', '/api/v1/account', { token: tokens.owner })
    expect(r.json.data!['role']).toBe('super_admin')
    const audit = ctx.raw.prepare("SELECT COUNT(*) n FROM audit_logs WHERE action = 'user.role_bootstrap'").get() as { n: number }
    expect(audit.n).toBe(1)
  })

  it('customers cannot escalate privileges via role endpoint', async () => {
    const ctx = setup()
    const me = await ctx.call('GET', '/api/v1/account', { token: tokens.alice })
    const r = await ctx.call('POST', `/api/v1/admin/users/${me.json.data!['id']}/role`, { token: tokens.alice, body: { role: 'super_admin' } })
    expect(r.status).toBe(403)
  })

  it('administrators can operate but cannot approve/publish/assign roles', async () => {
    const ctx = setup()
    await makeAdmin(ctx, 'admin')
    expect((await ctx.call('GET', '/api/v1/admin/overview', { token: tokens.admin })).status).toBe(200)
    const p = await ctx.call('POST', '/api/v1/admin/products', { token: tokens.admin, body: productBody() })
    expect(p.status).toBe(201)
    const id = p.json.data!['id']
    expect((await ctx.call('POST', `/api/v1/admin/products/${id}/transition`, { token: tokens.admin, body: { action: 'submit' } })).status).toBe(200)
    expect((await ctx.call('POST', `/api/v1/admin/products/${id}/transition`, { token: tokens.admin, body: { action: 'approve' } })).status).toBe(403)
    expect((await ctx.call('POST', `/api/v1/admin/products/${id}/transition`, { token: tokens.admin, body: { action: 'publish' } })).status).toBe(403)
    const owner = await ctx.call('GET', '/api/v1/account', { token: tokens.owner })
    expect((await ctx.call('POST', `/api/v1/admin/users/${owner.json.data!['id']}/role`, { token: tokens.admin, body: { role: 'customer' } })).status).toBe(403)
  })

  it('super admin cannot demote themselves or the last super admin', async () => {
    const ctx = setup()
    const me = await ctx.call('GET', '/api/v1/account', { token: tokens.owner })
    expect((await ctx.call('POST', `/api/v1/admin/users/${me.json.data!['id']}/role`, { token: tokens.owner, body: { role: 'customer' } })).status).toBe(403)
  })
})

describe('product publishing workflow', () => {
  it('drafts are invisible publicly; publish requires review + approval', async () => {
    const ctx = setup()
    const c = await ctx.call('POST', '/api/v1/admin/products', { token: tokens.owner, body: productBody() })
    expect(c.status).toBe(201)
    const id = c.json.data!['id']
    expect(c.json.data!['status']).toBe('draft')
    expect((await ctx.call('GET', '/api/v1/catalog/products/sample-kit')).status).toBe(404)
    expect((await ctx.call('POST', `/api/v1/admin/products/${id}/transition`, { token: tokens.owner, body: { action: 'publish' } })).status).toBe(409)
    await ctx.call('POST', `/api/v1/admin/products/${id}/transition`, { token: tokens.owner, body: { action: 'submit' } })
    const noApproval = await ctx.call('POST', `/api/v1/admin/products/${id}/transition`, { token: tokens.owner, body: { action: 'publish' } })
    expect(noApproval.status).toBe(409)
    expect(noApproval.json.error!.code).toBe('approval_required')
    await ctx.call('POST', `/api/v1/admin/products/${id}/transition`, { token: tokens.owner, body: { action: 'approve' } })
    const pub = await ctx.call('POST', `/api/v1/admin/products/${id}/transition`, { token: tokens.owner, body: { action: 'publish' } })
    expect(pub.status).toBe(200)
    expect(pub.json.data!['status']).toBe('published')
    const pubGet = await ctx.call('GET', '/api/v1/catalog/products/sample-kit')
    expect(pubGet.status).toBe(200)
    expect(pubGet.json.data!['internalNotes']).toBeUndefined()
    const logs = ctx.raw.prepare("SELECT action FROM audit_logs WHERE entity_type = 'product' ORDER BY id").all() as { action: string }[]
    expect(logs.map((l) => l.action)).toEqual(['product.created', 'product.submit', 'product.approve', 'product.publish'])
  })

  it('administrators cannot approve their own submission even if granted later; super admin can archive', async () => {
    const ctx = setup()
    const { id } = await publishedProduct(ctx)
    const a = await ctx.call('POST', `/api/v1/admin/products/${id}/transition`, { token: tokens.owner, body: { action: 'archive' } })
    expect(a.json.data!['status']).toBe('archived')
    expect((await ctx.call('GET', '/api/v1/catalog/products/sample-kit')).status).toBe(404)
  })

  it('validates input and rejects duplicate slugs / wrong category family', async () => {
    const ctx = setup()
    expect((await ctx.call('POST', '/api/v1/admin/products', { token: tokens.owner, body: { slug: 'Bad Slug' } })).status).toBe(400)
    await ctx.call('POST', '/api/v1/admin/products', { token: tokens.owner, body: productBody() })
    expect((await ctx.call('POST', '/api/v1/admin/products', { token: tokens.owner, body: productBody() })).status).toBe(409)
    const cat = ctx.raw.prepare("SELECT id FROM product_categories WHERE family = 'digital_assets' LIMIT 1").get() as { id: number }
    const wrong = await ctx.call('POST', '/api/v1/admin/products', { token: tokens.owner, body: productBody({ slug: 'other', category_id: cat.id }) })
    expect(wrong.json.error!.code).toBe('category_family_mismatch')
  })

  it('search, filter, sort and paginate published products only', async () => {
    const ctx = setup()
    await publishedProduct(ctx, { slug: 'alpha-kit', title_en: 'Alpha Kit', price_idr: 300000 })
    await publishedProduct(ctx, { slug: 'beta-asset', family: 'digital_assets', title_en: 'Beta Asset', price_idr: 100000 })
    await ctx.call('POST', '/api/v1/admin/products', { token: tokens.owner, body: productBody({ slug: 'hidden-draft', title_en: 'Alpha Hidden' }) })
    const all = await ctx.call('GET', '/api/v1/catalog/products')
    expect(all.json.meta!['total']).toBe(2)
    const q = await ctx.call('GET', '/api/v1/catalog/products?q=alpha')
    expect((q.json.data as { slug: string }[]).map((p) => p.slug)).toEqual(['alpha-kit'])
    const fam = await ctx.call('GET', '/api/v1/catalog/products?family=digital_assets')
    expect((fam.json.data as { slug: string }[]).map((p) => p.slug)).toEqual(['beta-asset'])
    const sorted = await ctx.call('GET', '/api/v1/catalog/products?sort=price_asc')
    expect((sorted.json.data as { slug: string }[]).map((p) => p.slug)).toEqual(['beta-asset', 'alpha-kit'])
    const paged = await ctx.call('GET', '/api/v1/catalog/products?pageSize=1&page=2')
    expect((paged.json.data as unknown[]).length).toBe(1)
    expect(paged.json.meta!['totalPages']).toBe(2)
    const wildcard = await ctx.call('GET', '/api/v1/catalog/products?q=%25')
    expect(wildcard.json.meta!['total']).toBe(0)
  })
})

describe('orders, payments and delivery', () => {
  async function enableCheckout(ctx: ReturnType<typeof setup>) {
    ctx.raw.prepare("UPDATE site_settings SET value_json = 'true' WHERE key = 'commerce.checkout_enabled'").run()
  }

  it('checkout is refused while disabled and for demo / unpublished products', async () => {
    const ctx = setup()
    const { id } = await publishedProduct(ctx)
    const r = await ctx.call('POST', '/api/v1/account/checkout', { token: tokens.alice, body: { productIds: [id], acceptTerms: true } })
    expect(r.status).toBe(503)
    expect(r.json.error!.code).toBe('checkout_disabled')
    await enableCheckout(ctx)
    const demo = await publishedProduct(ctx, { slug: 'demo-one', is_demo: true })
    const d = await ctx.call('POST', '/api/v1/account/checkout', { token: tokens.alice, body: { productIds: [demo.id], acceptTerms: true } })
    expect(d.status).toBe(422)
  })

  it('order stays pending until a VERIFIED webhook; forged webhooks are rejected', async () => {
    const ctx = setup()
    await enableCheckout(ctx)
    const { id, assetId } = await publishedProduct(ctx)
    const co = await ctx.call('POST', '/api/v1/account/checkout', { token: tokens.alice, body: { productIds: [id], acceptTerms: true } })
    expect(co.status).toBe(201)
    const orderId = co.json.data!['publicId'] as string
    expect(co.json.data!['status']).toBe('pending_payment')

    const detail = await ctx.call('GET', `/api/v1/account/orders/${orderId}`, { token: tokens.alice })
    expect(detail.json.data!['deliveryAvailable']).toBe(false)
    const item = (detail.json.data!['items'] as { id: number; licenseCode: string | null }[])[0]
    expect(item.licenseCode).toBeNull()
    expect((await ctx.call('POST', '/api/v1/account/downloads', { token: tokens.alice, body: { orderItemId: item.id, assetId } })).status).toBe(403)

    // Forged signature
    const forged = await ctx.app.request(
      'https://orsaven.biz.id/api/v1/webhooks/payments/test',
      { method: 'POST', headers: { 'X-Test-Signature': 'deadbeef' }, body: JSON.stringify({ event_id: 'e1', order_id: orderId, status: 'paid', amount: 150000 }) },
      ctx.env,
    )
    expect(forged.status).toBe(401)
    // Wrong amount, valid signature
    const bad = await signTestWebhook({ event_id: 'e2', order_id: orderId, provider_ref: 'x', status: 'paid', amount: 1 })
    const badRes = await ctx.app.request('https://orsaven.biz.id/api/v1/webhooks/payments/test', { method: 'POST', headers: { 'X-Test-Signature': bad.sig }, body: bad.raw }, ctx.env)
    expect(((await badRes.json()) as { data: { outcome: string } }).data.outcome).toBe('amount_mismatch')
    expect((ctx.raw.prepare('SELECT status FROM orders WHERE public_id = ?').get(orderId) as { status: string }).status).toBe('pending_payment')

    // Valid
    const good = await signTestWebhook({ event_id: 'e3', order_id: orderId, provider_ref: 'x', status: 'paid', amount: 150000 })
    const goodRes = await ctx.app.request('https://orsaven.biz.id/api/v1/webhooks/payments/test', { method: 'POST', headers: { 'X-Test-Signature': good.sig }, body: good.raw }, ctx.env)
    expect(((await goodRes.json()) as { data: { outcome: string } }).data.outcome).toBe('paid')
    // Replay is idempotent
    const replay = await ctx.app.request('https://orsaven.biz.id/api/v1/webhooks/payments/test', { method: 'POST', headers: { 'X-Test-Signature': good.sig }, body: good.raw }, ctx.env)
    expect(((await replay.json()) as { data: { outcome: string } }).data.outcome).toBe('duplicate')

    const after = await ctx.call('GET', `/api/v1/account/orders/${orderId}`, { token: tokens.alice })
    expect(after.json.data!['status']).toBe('completed')
    expect(after.json.data!['deliveryAvailable']).toBe(true)

    // Download: issue → redeem → counted → exhausted
    const grant = await ctx.call('POST', '/api/v1/account/downloads', { token: tokens.alice, body: { orderItemId: item.id, assetId } })
    expect(grant.status).toBe(201)
    const url = grant.json.data!['url'] as string
    expect(url).not.toContain('products/')
    for (let i = 0; i < 3; i++) {
      const dl = await ctx.app.request(`https://orsaven.biz.id${url}`, {}, ctx.env)
      expect(dl.status).toBe(200)
      expect(await dl.text()).toBe('hello deliverable')
      expect(dl.headers.get('Content-Disposition')).toContain('attachment')
    }
    expect((await ctx.app.request(`https://orsaven.biz.id${url}`, {}, ctx.env)).status).toBe(410)
    const events = ctx.raw.prepare('SELECT COUNT(*) n FROM download_events').get() as { n: number }
    expect(events.n).toBe(3)
    const lib = await ctx.call('GET', '/api/v1/account/library', { token: tokens.alice })
    expect((lib.json.data as unknown[]).length).toBe(1)
  })

  it('IDOR: another customer cannot see orders or issue downloads for them', async () => {
    const ctx = setup()
    await enableCheckout(ctx)
    const { id, assetId } = await publishedProduct(ctx)
    const co = await ctx.call('POST', '/api/v1/account/checkout', { token: tokens.alice, body: { productIds: [id], acceptTerms: true } })
    const orderId = co.json.data!['publicId'] as string
    const good = await signTestWebhook({ event_id: 'e9', order_id: orderId, provider_ref: 'x', status: 'paid', amount: 150000 })
    await ctx.app.request('https://orsaven.biz.id/api/v1/webhooks/payments/test', { method: 'POST', headers: { 'X-Test-Signature': good.sig }, body: good.raw }, ctx.env)
    const item = ctx.raw.prepare('SELECT id FROM order_items LIMIT 1').get() as { id: number }
    expect((await ctx.call('GET', `/api/v1/account/orders/${orderId}`, { token: tokens.bob })).status).toBe(404)
    expect((await ctx.call('POST', `/api/v1/account/orders/${orderId}/cancel`, { token: tokens.bob })).status).toBe(404)
    expect((await ctx.call('POST', '/api/v1/account/downloads', { token: tokens.bob, body: { orderItemId: item.id, assetId } })).status).toBe(404)
    const bobOrders = await ctx.call('GET', '/api/v1/account/orders', { token: tokens.bob })
    expect((bobOrders.json.data as unknown[]).length).toBe(0)
  })

  it('admins can never mark orders as paid; refunds revoke delivery', async () => {
    const ctx = setup()
    await enableCheckout(ctx)
    const { id, assetId } = await publishedProduct(ctx)
    const co = await ctx.call('POST', '/api/v1/account/checkout', { token: tokens.alice, body: { productIds: [id], acceptTerms: true } })
    const orderId = co.json.data!['publicId'] as string
    const r = await ctx.call('POST', `/api/v1/admin/orders/${orderId}/action`, { token: tokens.owner, body: { action: 'paid' } })
    expect(r.status).toBe(400)
    const pay = await signTestWebhook({ event_id: 'p1', order_id: orderId, provider_ref: 'x', status: 'paid', amount: 150000 })
    await ctx.app.request('https://orsaven.biz.id/api/v1/webhooks/payments/test', { method: 'POST', headers: { 'X-Test-Signature': pay.sig }, body: pay.raw }, ctx.env)
    const item = ctx.raw.prepare('SELECT id FROM order_items LIMIT 1').get() as { id: number }
    const grant = await ctx.call('POST', '/api/v1/account/downloads', { token: tokens.alice, body: { orderItemId: item.id, assetId } })
    const refund = await signTestWebhook({ event_id: 'r1', order_id: orderId, provider_ref: 'x', status: 'refunded', amount: 150000 })
    await ctx.app.request('https://orsaven.biz.id/api/v1/webhooks/payments/test', { method: 'POST', headers: { 'X-Test-Signature': refund.sig }, body: refund.raw }, ctx.env)
    expect((await ctx.app.request(`https://orsaven.biz.id${grant.json.data!['url']}`, {}, ctx.env)).status).toBe(403)
  })

  it('test payment provider is inert outside the test environment', async () => {
    const ctx = setup({ ENVIRONMENT: 'production' })
    ctx.raw.prepare("UPDATE site_settings SET value_json = 'true' WHERE key = 'commerce.checkout_enabled'").run()
    const { id } = await publishedProduct(ctx)
    const r = await ctx.call('POST', '/api/v1/account/checkout', { token: tokens.alice, body: { productIds: [id], acceptTerms: true } })
    expect(r.status).toBe(503)
    expect(r.json.error!.code).toBe('payments_unavailable')
  })

  it('free products complete without any payment record', async () => {
    const ctx = setup()
    const { id } = await publishedProduct(ctx, { slug: 'free-guide', pricing_model: 'free', price_idr: null })
    const r = await ctx.call('POST', '/api/v1/account/checkout', { token: tokens.alice, body: { productIds: [id], acceptTerms: true } })
    expect(r.status).toBe(201)
    expect(r.json.data!['status']).toBe('completed')
    expect((ctx.raw.prepare('SELECT COUNT(*) n FROM payments').get() as { n: number }).n).toBe(0)
    const again = await ctx.call('POST', '/api/v1/account/checkout', { token: tokens.alice, body: { productIds: [id], acceptTerms: true } })
    expect(again.status).toBe(409)
  })

  it('customers can cancel their own pending orders only', async () => {
    const ctx = setup()
    await enableCheckout(ctx)
    const { id } = await publishedProduct(ctx)
    const co = await ctx.call('POST', '/api/v1/account/checkout', { token: tokens.alice, body: { productIds: [id], acceptTerms: true } })
    const orderId = co.json.data!['publicId'] as string
    const c1 = await ctx.call('POST', `/api/v1/account/orders/${orderId}/cancel`, { token: tokens.alice })
    expect(c1.json.data!['status']).toBe('cancelled')
    expect((await ctx.call('POST', `/api/v1/account/orders/${orderId}/cancel`, { token: tokens.alice })).status).toBe(400)
  })
})

describe('inquiries, settings, legal, exports', () => {
  const inquiry = { name: 'Rina', email: 'rina@example.com', serviceType: 'integration', message: 'We need help integrating the operating kit with our tools.', consent: true }

  it('accepts valid inquiries, rejects honeypot and rate-limits', async () => {
    const ctx = setup()
    expect((await ctx.call('POST', '/api/v1/inquiries', { body: inquiry })).status).toBe(201)
    expect((await ctx.call('POST', '/api/v1/inquiries', { body: { ...inquiry, website: 'spam' } })).status).toBe(400)
    expect((await ctx.call('POST', '/api/v1/inquiries', { body: { ...inquiry, consent: false } })).status).toBe(400)
    // Invalid attempts also count toward the limit (5/hour): 3 used so far.
    expect((await ctx.call('POST', '/api/v1/inquiries', { body: inquiry })).status).toBe(201)
    expect((await ctx.call('POST', '/api/v1/inquiries', { body: inquiry })).status).toBe(201)
    const limited = await ctx.call('POST', '/api/v1/inquiries', { body: inquiry })
    expect(limited.status).toBe(429)
    expect(limited.res.headers.get('Retry-After')).toBeTruthy()
    const list = await ctx.call('GET', '/api/v1/admin/inquiries', { token: tokens.owner })
    expect(list.json.meta!['total']).toBe(3)
    expect(JSON.stringify(list.json)).not.toContain('ip_hash')
  })

  it('checkout cannot be enabled without provider and approved legal docs', async () => {
    const ctx = setup({ PAYMENT_PROVIDER: 'none' })
    const r = await ctx.call('PUT', '/api/v1/admin/settings/commerce.checkout_enabled', { token: tokens.owner, body: { value: true } })
    expect(r.json.error!.code).toBe('no_payment_provider_configured')
    const ctx2 = setup()
    const r2 = await ctx2.call('PUT', '/api/v1/admin/settings/commerce.checkout_enabled', { token: tokens.owner, body: { value: true } })
    expect(r2.json.error!.code).toBe('legal_documents_not_approved')
  })

  it('editing a legal doc resets it to draft; approval needs explicit confirmation', async () => {
    const ctx = setup()
    expect((await ctx.call('POST', '/api/v1/admin/legal/privacy/approve', { token: tokens.owner, body: {} })).status).toBe(400)
    expect((await ctx.call('POST', '/api/v1/admin/legal/privacy/approve', { token: tokens.owner, body: { confirmLegalReview: true } })).status).toBe(200)
    await ctx.call('PUT', '/api/v1/admin/legal/privacy', { token: tokens.owner, body: { title_id: 'Kebijakan', title_en: 'Policy', body_id: 'x', body_en: 'y' } })
    expect((await ctx.call('GET', '/api/v1/legal/privacy')).json.data!['status']).toBe('draft')
  })

  it('CSV export guards against formula injection and is audited', async () => {
    const ctx = setup()
    await ctx.call('POST', '/api/v1/inquiries', { body: { ...inquiry, name: '=HYPERLINK("x")' } })
    const r = await ctx.app.request('https://orsaven.biz.id/api/v1/admin/exports/inquiries', { headers: { Authorization: `Bearer ${tokens.owner}` } }, ctx.env)
    const csv = await r.text()
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`)
    expect((ctx.raw.prepare("SELECT COUNT(*) n FROM audit_logs WHERE action = 'export.generated'").get() as { n: number }).n).toBe(1)
    expect((await ctx.call('GET', '/api/v1/admin/exports/inquiries', { token: tokens.alice })).status).toBe(403)
  })

  it('rejects invalid uploads', async () => {
    const ctx = setup()
    const c = await ctx.call('POST', '/api/v1/admin/products', { token: tokens.owner, body: productBody() })
    const form = new FormData()
    form.set('file', new File([new Uint8Array([1, 2])], 'run.exe', { type: 'application/x-msdownload' }))
    const r = await ctx.call('POST', `/api/v1/admin/products/${c.json.data!['id']}/assets`, { token: tokens.owner, form })
    expect(r.status).toBe(400)
    expect(r.json.error!.code).toBe('unsupported_type')
  })
})

describe('SEO', () => {
  it('robots + sitemap + per-page meta + 404 status', async () => {
    const ctx = setup()
    await publishedProduct(ctx)
    const robots = await (await ctx.app.request('https://orsaven.biz.id/robots.txt', {}, ctx.env)).text()
    expect(robots).toContain('Disallow: /admin')
    const sm = await (await ctx.app.request('https://orsaven.biz.id/sitemap.xml', {}, ctx.env)).text()
    expect(sm).toContain('/products/sample-kit')
    const page = await ctx.app.request('https://orsaven.biz.id/products/sample-kit', {}, ctx.env)
    const html = await page.text()
    expect(html).toContain('<title>Sample Kit — ORSAVEN</title>')
    expect(html).toContain('application/ld+json')
    expect((await ctx.app.request('https://orsaven.biz.id/products/missing', {}, ctx.env)).status).toBe(404)
    const admin = await (await ctx.app.request('https://orsaven.biz.id/admin', {}, ctx.env)).text()
    expect(admin).toContain('noindex')
  })
})
