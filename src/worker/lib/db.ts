/** Thin data-access helpers over D1. All queries use bound parameters (no string interpolation of user input). */

export type Row = Record<string, unknown>

export async function one<T = Row>(db: D1Database, sql: string, ...params: unknown[]): Promise<T | null> {
  return (await db.prepare(sql).bind(...params).first<T>()) ?? null
}

export async function many<T = Row>(db: D1Database, sql: string, ...params: unknown[]): Promise<T[]> {
  const r = await db.prepare(sql).bind(...params).all<T>()
  return r.results ?? []
}

export async function exec(db: D1Database, sql: string, ...params: unknown[]) {
  const r = await db.prepare(sql).bind(...params).run()
  return { lastId: Number(r.meta.last_row_id), changes: Number(r.meta.changes) }
}

export const nowIso = () => new Date().toISOString()

export function parseJsonField<T>(v: unknown, fallback: T): T {
  if (typeof v !== 'string') return fallback
  try {
    return JSON.parse(v) as T
  } catch {
    return fallback
  }
}

/** Escape LIKE wildcards; use with `ESCAPE '\\'`. */
export function likeEscape(s: string): string {
  return s.replace(/[\\%_]/g, (m) => `\\${m}`)
}

export function pageParams(page: unknown, size: unknown, maxSize = 50) {
  const p = Math.max(1, Math.min(10_000, Number.parseInt(String(page ?? '1'), 10) || 1))
  const s = Math.max(1, Math.min(maxSize, Number.parseInt(String(size ?? '12'), 10) || 12))
  return { page: p, pageSize: s, offset: (p - 1) * s }
}
