import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { ZodError, type ZodTypeAny, type z } from 'zod'

/** Every API error is thrown as ApiError and serialised consistently. */
export class ApiError extends Error {
  constructor(
    public status: ContentfulStatusCode,
    public code: string,
    message?: string,
    public details?: unknown,
  ) {
    super(message ?? code)
  }
}

export const badRequest = (code: string, details?: unknown) => new ApiError(400, code, code, details)
export const unauthorized = () => new ApiError(401, 'unauthenticated', 'Authentication required')
export const forbidden = (code = 'forbidden') => new ApiError(403, code, 'You do not have permission for this action')
export const notFound = (code = 'not_found') => new ApiError(404, code, 'Resource not found')
export const conflict = (code: string, details?: unknown) => new ApiError(409, code, code, details)

/** Response envelope: { data, meta? } for success, { error: { code, message, details?, requestId } } for errors. */
export function ok<T>(c: Context, data: T, meta?: Record<string, unknown>, status: ContentfulStatusCode = 200) {
  return c.json(meta ? { data, meta } : { data }, status)
}

export function parse<S extends ZodTypeAny>(schema: S, input: unknown): z.infer<S> {
  const r = schema.safeParse(input)
  if (!r.success) throw badRequest('validation_failed', flattenZod(r.error))
  return r.data
}

export async function parseJson<S extends ZodTypeAny>(c: Context, schema: S): Promise<z.infer<S>> {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    throw badRequest('invalid_json')
  }
  return parse(schema, body)
}

export function flattenZod(e: ZodError) {
  return e.issues.map((i) => ({ path: i.path.join('.'), message: i.message }))
}
