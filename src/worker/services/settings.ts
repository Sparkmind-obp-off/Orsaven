import { many, one } from '../lib/db'

export async function getSetting<T>(db: D1Database, key: string, fallback: T): Promise<T> {
  const r = await one<{ value_json: string }>(db, 'SELECT value_json FROM site_settings WHERE key = ?', key)
  if (!r) return fallback
  try {
    return JSON.parse(r.value_json) as T
  } catch {
    return fallback
  }
}

export async function publicSettings(db: D1Database) {
  const rows = await many<{ key: string; value_json: string }>(db, 'SELECT key, value_json FROM site_settings WHERE is_public = 1')
  const out: Record<string, unknown> = {}
  for (const r of rows) {
    try {
      out[r.key] = JSON.parse(r.value_json)
    } catch {
      /* skip malformed */
    }
  }
  return out
}
