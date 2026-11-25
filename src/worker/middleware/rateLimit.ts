import type { MiddlewareHandler } from 'hono'
import type { AppEnv } from '../types'
import { hashIp } from '../lib/crypto'

/**
 * Fixed-window rate limiter backed by D1 (free tier, no KV needed).
 * Applied only to abuse-prone endpoints to conserve D1 write quota.
 */
export function rateLimit(bucket: string, limit: number, windowSec: number): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const user = c.get('user')
    const subject = user ? `u:${user.id}` : `ip:${await hashIp(c.req.header('CF-Connecting-IP') ?? 'local', c.env.IP_HASH_SALT)}`
    const now = Math.floor(Date.now() / 1000)
    const windowStart = now - (now % windowSec)
    const key = `${bucket}:${subject}`
    const row = await c.env.DB.prepare(
      `INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)
       ON CONFLICT(key) DO UPDATE SET
         count = CASE WHEN rate_limits.window_start = excluded.window_start THEN rate_limits.count + 1 ELSE 1 END,
         window_start = excluded.window_start
       RETURNING count`,
    )
      .bind(key, windowStart)
      .first<{ count: number }>()
    const count = row?.count ?? 1
    c.header('X-RateLimit-Limit', String(limit))
    c.header('X-RateLimit-Remaining', String(Math.max(0, limit - count)))
    if (count > limit) {
      c.header('Retry-After', String(windowStart + windowSec - now))
      return c.json({ error: { code: 'rate_limited', message: 'Too many requests. Please try again later.' } }, 429)
    }
    return next()
  }
}
