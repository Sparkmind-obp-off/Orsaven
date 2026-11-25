import type { Env } from '../types'

export interface AuditEntry {
  actorUserId: number | null
  actorRole: string
  action: string
  entityType: string
  entityId?: string
  metadata?: Record<string, unknown>
  ipHash?: string
}

const SENSITIVE = /secret|password|token|key|authorization/i

function scrub(m: Record<string, unknown> = {}): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(m)) out[k] = SENSITIVE.test(k) ? '[redacted]' : v
  return out
}

/** Append-only audit trail. There is intentionally no update/delete API for audit_logs. */
export async function audit(env: Env, e: AuditEntry) {
  await env.DB.prepare(
    `INSERT INTO audit_logs (actor_user_id, actor_role, action, entity_type, entity_id, metadata_json, ip_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(e.actorUserId, e.actorRole, e.action, e.entityType, e.entityId ?? '', JSON.stringify(scrub(e.metadata)).slice(0, 8000), e.ipHash ?? '')
    .run()
}
