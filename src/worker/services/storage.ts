import type { Env } from '../types'

/**
 * Private object storage abstraction.
 * - `r2`: used only when a PRIVATE_FILES R2 binding is explicitly configured.
 * - `d1`: free-tier fallback storing small blobs in a private D1 table.
 * Storage keys are opaque and are never returned to browsers.
 */
export interface StorageDriver {
  name: 'r2' | 'd1'
  maxBytes: number
  put(key: string, data: Uint8Array, contentType: string): Promise<void>
  get(key: string): Promise<Uint8Array | null>
  delete(key: string): Promise<void>
}

/** D1 rows are capped (~2 MB); keep a safe margin. */
export const D1_MAX_BYTES = 1_800_000

export function d1Storage(db: D1Database): StorageDriver {
  return {
    name: 'd1',
    maxBytes: D1_MAX_BYTES,
    async put(key, data) {
      // D1 binds ArrayBuffer as BLOB.
      const buf = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
      await db.prepare('INSERT INTO asset_blobs (storage_key, data) VALUES (?, ?)').bind(key, buf).run()
    },
    async get(key) {
      const row = await db.prepare('SELECT data FROM asset_blobs WHERE storage_key = ?').bind(key).first<{ data: ArrayBuffer | number[] | Uint8Array }>()
      if (!row) return null
      const d = row.data
      if (d instanceof Uint8Array) return d
      if (d instanceof ArrayBuffer) return new Uint8Array(d)
      return Uint8Array.from(d as number[])
    },
    async delete(key) {
      await db.prepare('DELETE FROM asset_blobs WHERE storage_key = ?').bind(key).run()
    },
  }
}

export function r2Storage(bucket: R2Bucket): StorageDriver {
  return {
    name: 'r2',
    maxBytes: 50 * 1024 * 1024,
    async put(key, data, contentType) {
      await bucket.put(key, data, { httpMetadata: { contentType } })
    },
    async get(key) {
      const o = await bucket.get(key)
      return o ? new Uint8Array(await o.arrayBuffer()) : null
    },
    async delete(key) {
      await bucket.delete(key)
    },
  }
}

export function storageFor(env: Env, driver?: 'r2' | 'd1'): StorageDriver {
  const want = driver ?? (env.PRIVATE_FILES ? 'r2' : 'd1')
  if (want === 'r2') {
    if (!env.PRIVATE_FILES) throw new Error('r2_not_configured')
    return r2Storage(env.PRIVATE_FILES)
  }
  return d1Storage(env.DB)
}
