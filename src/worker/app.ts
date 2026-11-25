import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { AppEnv, AuthDeps } from './types'
import { ApiError } from './lib/http'
import { authenticate, clerkDeps } from './middleware/auth'
import { allowedOrigins, originGuard, securityHeaders } from './middleware/security'
import { publicRoutes } from './routes/public'
import { accountRoutes } from './routes/account'
import { adminRoutes } from './routes/admin'
import { webhookRoutes } from './routes/webhooks'
import { redeemDownload } from './services/delivery'
import { rateLimit } from './middleware/rateLimit'
import { injectMeta, metaFor, origin, robots, sitemap } from './seo'

export function createApp(deps: AuthDeps = clerkDeps) {
  const app = new Hono<AppEnv>()

  app.use('*', securityHeaders)
  app.use('*', async (c, next) => {
    c.set('deps', deps)
    await next()
  })

  app.use(
    '/api/*',
    cors({
      origin: (o, c) => (allowedOrigins(c.env).includes(o) ? o : null),
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Authorization', 'Content-Type'],
      maxAge: 600,
    }),
  )
  app.use('/api/*', originGuard)

  // Webhooks are signature-authenticated, so they skip session auth.
  app.route('/api/v1/webhooks', webhookRoutes)

  // Download redemption is authorised by the single-use, short-lived token (works with plain <a href>).
  app.get('/api/v1/downloads/:token', rateLimit('download_redeem', 60, 600), async (c) =>
    redeemDownload(c.env, c.req.param('token'), c.req.header('CF-Connecting-IP'), c.req.header('User-Agent')),
  )

  app.use('/api/v1/*', authenticate)
  app.route('/api/v1', publicRoutes)
  app.route('/api/v1/account', accountRoutes)
  app.route('/api/v1/admin', adminRoutes)

  app.all('/api/*', (c) => c.json({ error: { code: 'not_found', message: 'Unknown API endpoint' } }, 404))

  app.get('/robots.txt', (c) => c.text(robots(c.env)))
  app.get('/sitemap.xml', async (c) => {
    c.header('Content-Type', 'application/xml; charset=utf-8')
    c.header('Cache-Control', 'public, max-age=3600')
    return c.body(await sitemap(c.env))
  })

  // SPA shell with server-rendered meta for SEO and correct 404 status codes.
  app.get('*', async (c) => {
    if (!c.env.ASSETS) return c.text('Assets binding missing', 500)
    const url = new URL(c.req.url)
    const shell = await c.env.ASSETS.fetch(new Request(new URL('/', url.origin)))
    const html = await shell.text()
    const meta = await metaFor(c.env, url.pathname)
    c.header('Cache-Control', 'no-cache')
    return c.html(injectMeta(html, meta, origin(c.env)), meta.status as 200)
  })

  app.onError((err, c) => {
    const requestId = c.get('requestId')
    if (err instanceof ApiError) {
      return c.json({ error: { code: err.code, message: err.message, details: err.details, requestId } }, err.status)
    }
    console.error(JSON.stringify({ level: 'error', requestId, path: c.req.path, message: err.message, stack: err.stack?.split('\n').slice(0, 5) }))
    return c.json({ error: { code: 'internal_error', message: 'Something went wrong', requestId } }, 500)
  })

  return app
}
