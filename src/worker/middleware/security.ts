import type { MiddlewareHandler } from 'hono'
import type { AppEnv, Env } from '../types'

const CLERK_FAPI = 'https://clerk.orsaven.biz.id'

export function contentSecurityPolicy(env: Env): string {
  const fapi = clerkFrontendApi(env)
  return [
    "default-src 'self'",
    `script-src 'self' ${fapi} https://cdn.protect.clerk.com https://challenges.cloudflare.com https://static.cloudflareinsights.com`,
    `connect-src 'self' ${fapi} https://*.protect.clerk.com https://*.protect.clerk.com:* https://api.clerk.com https://clerk-telemetry.com https://cloudflareinsights.com`,
    "img-src 'self' data: https://img.clerk.com",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    'frame-src https://challenges.cloudflare.com',
    "worker-src 'self' blob:",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join('; ')
}

/** Decode the Clerk Frontend API host from the publishable key (pk_live_<base64(host$)>). */
export function clerkFrontendApi(env: Env): string {
  const pk = env.CLERK_PUBLISHABLE_KEY
  if (!pk) return CLERK_FAPI
  try {
    const host = atob(pk.split('_')[2] ?? '').replace(/\$$/, '')
    if (/^[a-z0-9.-]+$/i.test(host)) return `https://${host}`
  } catch {
    /* fall through */
  }
  return CLERK_FAPI
}

export const securityHeaders: MiddlewareHandler<AppEnv> = async (c, next) => {
  c.set('requestId', crypto.randomUUID())
  await next()
  const h = c.res.headers
  h.set('X-Request-Id', c.get('requestId'))
  h.set('X-Content-Type-Options', 'nosniff')
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  h.set('X-Frame-Options', 'DENY')
  h.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()')
  h.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups')
  if (c.env.ENVIRONMENT === 'production') h.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  const ct = h.get('Content-Type') ?? ''
  if (ct.includes('text/html')) h.set('Content-Security-Policy', contentSecurityPolicy(c.env))
  if (c.req.path.startsWith('/api/') && !h.has('Cache-Control')) h.set('Cache-Control', 'no-store')
}

export function allowedOrigins(env: Env): string[] {
  const list = [env.APP_ORIGIN ?? 'https://orsaven.biz.id', 'https://www.orsaven.biz.id']
  for (const o of (env.ALLOWED_ORIGINS ?? '').split(',')) if (o.trim()) list.push(o.trim())
  return list
}

/**
 * CSRF defence: state-changing API calls must originate from an allowed origin.
 * Auth uses Bearer tokens (not ambient cookies), which already blocks classic CSRF;
 * this is defence in depth. Webhooks are exempt (they are signature-verified).
 */
export const originGuard: MiddlewareHandler<AppEnv> = async (c, next) => {
  const m = c.req.method
  if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return next()
  if (c.req.path.startsWith('/api/v1/webhooks/')) return next()
  const origin = c.req.header('Origin')
  if (origin) {
    const self = new URL(c.req.url).origin
    if (origin !== self && !allowedOrigins(c.env).includes(origin)) {
      return c.json({ error: { code: 'origin_not_allowed', message: 'Cross-origin request rejected' } }, 403)
    }
  }
  return next()
}
