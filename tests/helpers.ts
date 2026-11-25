/**
 * Test harness: a D1-compatible adapter over better-sqlite3 that runs the REAL
 * migration files, plus fake Clerk deps. Tokens look like `t:<clerkId>:<email>`.
 */
import Database from 'better-sqlite3'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createApp } from '../src/worker/app'
import type { AuthDeps, Env } from '../src/worker/types'
import { hmacSha256, toHex } from '../src/worker/lib/crypto'

type Sqlite = InstanceType<typeof Database>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TestJson = { data?: any; error?: { code: string }; meta?: any }

function norm(v: unknown): unknown {
  if (v === undefined) return null
  if (typeof v === 'boolean') return v ? 1 : 0
  if (v instanceof Uint8Array && !Buffer.isBuffer(v)) return Buffer.from(v)
  if (v instanceof ArrayBuffer) return Buffer.from(new Uint8Array(v))
  return v
}

function outRow(r: Record<string, unknown> | undefined) {
  if (!r) return r
  for (const k of Object.keys(r)) if (Buffer.isBuffer(r[k])) r[k] = new Uint8Array(r[k] as Buffer)
  return r
}

class Stmt {
  private params: unknown[] = []
  constructor(
    private db: Sqlite,
    private sql: string,
  ) {}
  bind(...p: unknown[]) {
    this.params = p.map(norm)
    return this
  }
  async first<T>(col?: string): Promise<T | null> {
    const s = this.db.prepare(this.sql)
    const r = s.reader ? (outRow(s.get(...this.params) as Record<string, unknown>) ?? null) : (s.run(...this.params), null)
    if (r && col) return (r as Record<string, unknown>)[col] as T
    return r as T | null
  }
  async all<T>() {
    const s = this.db.prepare(this.sql)
    const results = (s.all(...this.params) as Record<string, unknown>[]).map((r) => outRow(r)) as T[]
    return { results, success: true, meta: {} }
  }
  async run() {
    const s = this.db.prepare(this.sql)
    if (s.reader) {
      s.all(...this.params)
      return { success: true, meta: { last_row_id: 0, changes: 0 } }
    }
    const r = s.run(...this.params)
    return { success: true, meta: { last_row_id: Number(r.lastInsertRowid), changes: r.changes } }
  }
}

export function createD1(): { d1: D1Database; raw: Sqlite } {
  const raw = new Database(':memory:')
  raw.pragma('foreign_keys = ON')
  const dir = join(__dirname, '..', 'migrations')
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) raw.exec(readFileSync(join(dir, f), 'utf8'))
  const d1 = {
    prepare: (sql: string) => new Stmt(raw, sql),
    batch: async (stmts: Stmt[]) => Promise.all(stmts.map((s) => s.run())),
    exec: async (sql: string) => raw.exec(sql),
  } as unknown as D1Database
  return { d1, raw }
}

export const fakeDeps: AuthDeps = {
  async verifySession(token) {
    const m = token.match(/^t:([^:]+):(.*)$/)
    return m ? { sub: m[1] } : null
  },
  async fetchIdentity(clerkUserId) {
    return { email: `${clerkUserId}@example.com`, emailVerified: true }
  },
}

export const TEST_PAYMENT_SECRET = 'test-secret-0123456789abcdef'

export function setup(overrides: Partial<Env> = {}) {
  const { d1, raw } = createD1()
  const env: Env = {
    DB: d1,
    ENVIRONMENT: 'test',
    APP_ORIGIN: 'https://orsaven.biz.id',
    SUPER_ADMIN_EMAILS: 'owner@example.com',
    IP_HASH_SALT: 'salt',
    PAYMENT_PROVIDER: 'test',
    TEST_PAYMENT_SECRET,
    ASSETS: {
      fetch: async () => new Response('<!doctype html><html><head><title>x</title><!--app-head--></head><body><div id="root"></div></body></html>', { headers: { 'Content-Type': 'text/html' } }),
    } as unknown as Fetcher,
    ...overrides,
  }
  const app = createApp(fakeDeps)
  const call = async (method: string, path: string, opts: { token?: string; body?: unknown; headers?: Record<string, string>; form?: FormData } = {}) => {
    const headers: Record<string, string> = { ...(opts.headers ?? {}) }
    if (opts.token) headers.Authorization = `Bearer ${opts.token}`
    let body: BodyInit | undefined
    if (opts.form) body = opts.form
    else if (opts.body !== undefined) {
      headers['Content-Type'] = 'application/json'
      body = JSON.stringify(opts.body)
    }
    const res = await app.request(`https://orsaven.biz.id${path}`, { method, headers, body }, env)
    const ct = res.headers.get('Content-Type') ?? ''
    const json = ct.includes('json') ? await res.json() : null
    return { res, status: res.status, json: json as TestJson }
  }
  return { env, raw, app, call }
}

/** Fake Clerk session tokens. Emails derive from the id (see fakeDeps). */
export const tokens = {
  owner: 't:owner:owner@example.com', // bootstraps as super_admin via SUPER_ADMIN_EMAILS
  admin: 't:admin1:',
  admin2: 't:admin2:',
  alice: 't:alice:',
  bob: 't:bob:',
}

export async function makeAdmin(ctx: ReturnType<typeof setup>, who: 'admin' | 'admin2') {
  // Ensure owner + target exist, then promote through the real API.
  await ctx.call('GET', '/api/v1/account', { token: tokens.owner })
  const me = await ctx.call('GET', '/api/v1/account', { token: tokens[who] })
  const r = await ctx.call('POST', `/api/v1/admin/users/${me.json.data!['id']}/role`, { token: tokens.owner, body: { role: 'administrator' } })
  if (r.status !== 200) throw new Error(`promote failed ${r.status}`)
}

export function productBody(over: Record<string, unknown> = {}) {
  return {
    slug: 'sample-kit',
    family: 'business_kits',
    title_id: 'Kit Contoh',
    title_en: 'Sample Kit',
    summary_id: 'Ringkasan',
    summary_en: 'Summary',
    pricing_model: 'one_time',
    price_idr: 150000,
    maturity: 'available',
    license_id: 1,
    ...over,
  }
}

export async function signTestWebhook(payload: object) {
  const raw = JSON.stringify(payload)
  return { raw, sig: toHex(await hmacSha256(TEST_PAYMENT_SECRET, raw)) }
}

/** Create + approve + publish a product with one deliverable file; returns product id + asset id. */
export async function publishedProduct(ctx: ReturnType<typeof setup>, over: Record<string, unknown> = {}) {
  const created = await ctx.call('POST', '/api/v1/admin/products', { token: tokens.owner, body: productBody(over) })
  if (created.status !== 201) throw new Error(`create failed ${JSON.stringify(created.json)}`)
  const id = created.json.data!['id'] as number
  const form = new FormData()
  form.set('file', new File([new TextEncoder().encode('hello deliverable')], 'guide.pdf', { type: 'application/pdf' }))
  form.set('label', 'Guide')
  const up = await ctx.call('POST', `/api/v1/admin/products/${id}/assets`, { token: tokens.owner, form })
  if (up.status !== 201) throw new Error(`upload failed ${JSON.stringify(up.json)}`)
  for (const action of ['submit', 'approve', 'publish']) {
    const r = await ctx.call('POST', `/api/v1/admin/products/${id}/transition`, { token: tokens.owner, body: { action } })
    if (r.status !== 200) throw new Error(`${action} failed ${JSON.stringify(r.json)}`)
  }
  return { id, assetId: up.json.data!['id'] as number }
}
