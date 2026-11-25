import type { Permission, Role } from '../shared/domain'

export interface Env {
  DB: D1Database
  ASSETS?: Fetcher
  /** Optional private bucket. Only bound when explicitly authorised. */
  PRIVATE_FILES?: R2Bucket
  ENVIRONMENT?: string // 'production' | 'development' | 'test'
  APP_ORIGIN?: string // e.g. https://orsaven.biz.id
  ALLOWED_ORIGINS?: string // comma-separated extra origins
  CLERK_PUBLISHABLE_KEY?: string
  CLERK_SECRET_KEY?: string
  CLERK_JWT_KEY?: string
  CLERK_WEBHOOK_SECRET?: string
  CLERK_AUTHORIZED_PARTIES?: string
  SUPER_ADMIN_EMAILS?: string
  IP_HASH_SALT?: string
  PAYMENT_PROVIDER?: string // none | midtrans
  MIDTRANS_SERVER_KEY?: string
  MIDTRANS_IS_PRODUCTION?: string
  TEST_PAYMENT_SECRET?: string // only honoured when ENVIRONMENT === 'test'
}

export interface SessionClaims {
  sub: string
  sid?: string
}

export interface Identity {
  email: string | null
  emailVerified: boolean
}

export interface CurrentUser {
  id: number
  clerkUserId: string
  email: string | null
  role: Role
  status: string
  permissions: Set<Permission>
}

export interface AuthDeps {
  verifySession: (token: string, env: Env) => Promise<SessionClaims | null>
  fetchIdentity: (clerkUserId: string, env: Env) => Promise<Identity>
}

export type Vars = {
  requestId: string
  claims: SessionClaims | null
  user: CurrentUser | null
  deps: AuthDeps
}

export type AppEnv = { Bindings: Env; Variables: Vars }
