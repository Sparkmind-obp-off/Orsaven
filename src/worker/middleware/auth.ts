import type { MiddlewareHandler } from 'hono'
import { createClerkClient, verifyToken } from '@clerk/backend'
import type { AppEnv, AuthDeps, CurrentUser, Env, Identity, SessionClaims } from '../types'
import { ROLES, type Permission, type Role } from '../../shared/domain'
import { exec, many, nowIso, one } from '../lib/db'
import { forbidden, unauthorized } from '../lib/http'
import { audit } from '../services/audit'
import { allowedOrigins } from './security'

/* ---------------- Clerk production dependencies ---------------- */

export const clerkDeps: AuthDeps = {
  async verifySession(token, env) {
    if (!env.CLERK_SECRET_KEY && !env.CLERK_JWT_KEY) return null
    try {
      const payload = await verifyToken(token, {
        secretKey: env.CLERK_SECRET_KEY,
        jwtKey: env.CLERK_JWT_KEY || undefined,
        authorizedParties: authorizedParties(env),
      })
      if (!payload?.sub) return null
      return { sub: payload.sub, sid: payload.sid as string | undefined }
    } catch {
      return null
    }
  },
  async fetchIdentity(clerkUserId, env): Promise<Identity> {
    if (!env.CLERK_SECRET_KEY) return { email: null, emailVerified: false }
    const clerk = createClerkClient({ secretKey: env.CLERK_SECRET_KEY })
    const u = await clerk.users.getUser(clerkUserId)
    const primary = u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId) ?? u.emailAddresses[0]
    return {
      email: primary?.emailAddress?.toLowerCase() ?? null,
      emailVerified: primary?.verification?.status === 'verified',
    }
  },
}

export function authorizedParties(env: Env): string[] {
  return (env.CLERK_AUTHORIZED_PARTIES ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .concat(allowedOrigins(env))
}

/* ---------------- User mapping ---------------- */

const IDENTITY_REFRESH_MS = 6 * 60 * 60 * 1000

function superAdminEmails(env: Env): string[] {
  return (env.SUPER_ADMIN_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

async function loadPermissions(db: D1Database, role: Role): Promise<Set<Permission>> {
  const rows = await many<{ permission_key: Permission }>(
    db,
    'SELECT permission_key FROM role_permissions WHERE role_id = ?',
    role,
  )
  return new Set(rows.map((r) => r.permission_key))
}

type UserRow = { id: number; clerk_user_id: string; email: string | null; email_verified: number; role_id: Role; status: string; updated_at: string }

/**
 * Map a verified Clerk session to a local user. Role is ALWAYS read from our DB,
 * never from the browser. Super-admin bootstrap only applies to verified emails
 * listed in the SUPER_ADMIN_EMAILS server secret/var.
 */
export async function resolveUser(env: Env, deps: AuthDeps, claims: SessionClaims): Promise<CurrentUser> {
  const db = env.DB
  let row = await one<UserRow>(db, 'SELECT * FROM users WHERE clerk_user_id = ?', claims.sub)
  const stale = !row || Date.now() - Date.parse(row.updated_at) > IDENTITY_REFRESH_MS
  if (stale) {
    let identity: Identity = { email: row?.email ?? null, emailVerified: !!row?.email_verified }
    try {
      identity = await deps.fetchIdentity(claims.sub, env)
    } catch {
      /* keep cached identity if Clerk API is unreachable */
    }
    if (!row) {
      await exec(
        db,
        `INSERT INTO users (clerk_user_id, email, email_verified, role_id) VALUES (?, ?, ?, 'customer')
         ON CONFLICT(clerk_user_id) DO NOTHING`,
        claims.sub,
        identity.email,
        identity.emailVerified ? 1 : 0,
      )
      row = await one<UserRow>(db, 'SELECT * FROM users WHERE clerk_user_id = ?', claims.sub)
      if (!row) throw unauthorized()
      await exec(db, 'INSERT OR IGNORE INTO user_profiles (user_id) VALUES (?)', row.id)
      await audit(env, { actorUserId: row.id, actorRole: 'customer', action: 'user.created', entityType: 'user', entityId: String(row.id) })
    } else {
      await exec(
        db,
        'UPDATE users SET email = ?, email_verified = ?, updated_at = ? WHERE id = ?',
        identity.email,
        identity.emailVerified ? 1 : 0,
        nowIso(),
        row.id,
      )
      row = { ...row, email: identity.email, email_verified: identity.emailVerified ? 1 : 0 }
    }
    if (identity.emailVerified && identity.email && superAdminEmails(env).includes(identity.email) && row.role_id !== 'super_admin') {
      await exec(db, "UPDATE users SET role_id = 'super_admin' WHERE id = ?", row.id)
      await audit(env, {
        actorUserId: row.id,
        actorRole: 'system',
        action: 'user.role_bootstrap',
        entityType: 'user',
        entityId: String(row.id),
        metadata: { from: row.role_id, to: 'super_admin', reason: 'SUPER_ADMIN_EMAILS' },
      })
      row = { ...row, role_id: 'super_admin' }
    }
  }
  const role: Role = (ROLES as readonly string[]).includes(row!.role_id) ? row!.role_id : 'customer'
  return {
    id: row!.id,
    clerkUserId: row!.clerk_user_id,
    email: row!.email,
    role,
    status: row!.status,
    permissions: await loadPermissions(db, role),
  }
}

/* ---------------- Middleware ---------------- */

/** Attempts to authenticate; never rejects. Sets c.var.user when a valid session exists. */
export const authenticate: MiddlewareHandler<AppEnv> = async (c, next) => {
  c.set('user', null)
  c.set('claims', null)
  const header = c.req.header('Authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (token) {
    const claims = await c.get('deps').verifySession(token, c.env)
    if (claims) {
      c.set('claims', claims)
      const user = await resolveUser(c.env, c.get('deps'), claims)
      if (user.status === 'active') c.set('user', user)
    }
  }
  return next()
}

export const requireUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!c.get('user')) throw unauthorized()
  return next()
}

export function requirePermission(...perms: Permission[]): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const u = c.get('user')
    if (!u) throw unauthorized()
    for (const p of perms) if (!u.permissions.has(p)) throw forbidden('missing_permission')
    return next()
  }
}

export function hasPermission(u: CurrentUser | null, p: Permission) {
  return !!u && u.permissions.has(p)
}
