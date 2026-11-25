import { useCallback, useEffect, useState } from 'react'

export interface Meta {
  page?: number
  pageSize?: number
  total?: number
  totalPages?: number
}

export class ApiClientError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message)
  }
}

type TokenGetter = () => Promise<string | null>
let tokenGetter: TokenGetter | null = null

/** Registered by the session provider so every request carries the Clerk session token. */
export function setTokenGetter(fn: TokenGetter | null) {
  tokenGetter = fn
}

interface RequestOptions {
  method?: string
  body?: unknown
  form?: FormData
  signal?: AbortSignal
}

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<{ data: T; meta?: Meta }> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  const token = tokenGetter ? await tokenGetter().catch(() => null) : null
  if (token) headers.Authorization = `Bearer ${token}`
  let body: BodyInit | undefined
  if (opts.form) body = opts.form
  else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(opts.body)
  }
  let res: Response
  try {
    res = await fetch(`/api/v1${path}`, { method: opts.method ?? 'GET', headers, body, signal: opts.signal, credentials: 'same-origin' })
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    throw new ApiClientError(0, 'network_error', 'Network error. Check your connection and try again.')
  }
  const isJson = (res.headers.get('Content-Type') ?? '').includes('json')
  const payload = isJson ? await res.json().catch(() => null) : null
  if (!res.ok) {
    const err = payload?.error ?? {}
    throw new ApiClientError(res.status, err.code ?? `http_${res.status}`, err.message ?? res.statusText, err.details)
  }
  return payload as { data: T; meta?: Meta }
}

/** Download a protected binary (e.g. CSV export) using the session token. */
export async function downloadAuthed(path: string, filename: string) {
  const token = tokenGetter ? await tokenGetter() : null
  const res = await fetch(`/api/v1${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  if (!res.ok) throw new ApiClientError(res.status, `http_${res.status}`, 'Download failed')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export interface QueryState<T> {
  data: T | null
  meta?: Meta
  error: ApiClientError | null
  loading: boolean
  reload: () => void
}

/** Minimal data hook. Pass `null` to skip. */
export function useApi<T>(path: string | null): QueryState<T> {
  const [state, setState] = useState<{ data: T | null; meta?: Meta; error: ApiClientError | null; loading: boolean }>({ data: null, error: null, loading: !!path })
  const [nonce, setNonce] = useState(0)
  useEffect(() => {
    if (!path) {
      setState({ data: null, error: null, loading: false })
      return
    }
    const ctrl = new AbortController()
    setState((s) => ({ ...s, loading: true, error: null }))
    api<T>(path, { signal: ctrl.signal })
      .then((r) => setState({ data: r.data, meta: r.meta, error: null, loading: false }))
      .catch((e) => {
        if ((e as Error).name === 'AbortError') return
        setState({ data: null, error: e instanceof ApiClientError ? e : new ApiClientError(0, 'unknown', String(e)), loading: false })
      })
    return () => ctrl.abort()
  }, [path, nonce])
  const reload = useCallback(() => setNonce((n) => n + 1), [])
  return { ...state, reload }
}

export function errorMessage(e: unknown, fallback = 'Something went wrong.'): string {
  if (e instanceof ApiClientError) {
    if (e.code === 'validation_failed' && Array.isArray(e.details)) {
      return (e.details as { path: string; message: string }[]).map((d) => `${d.path || 'input'}: ${d.message}`).join(' · ')
    }
    return HUMAN_ERRORS[e.code] ?? e.message ?? fallback
  }
  return fallback
}

const HUMAN_ERRORS: Record<string, string> = {
  unauthenticated: 'Please sign in to continue.',
  forbidden: 'You do not have permission for this action.',
  missing_permission: 'Your role does not include this permission.',
  checkout_disabled: 'Paid checkout is not enabled yet. You can send an inquiry instead.',
  payments_unavailable: 'No payment provider is active yet. No charge was made.',
  product_not_purchasable: 'This product is not available for purchase.',
  already_owned_or_pending: 'You already own this product or have a pending order for it.',
  rate_limited: 'Too many requests. Please wait a moment and try again.',
  approval_required: 'This product must be approved before publishing.',
  cannot_approve_own_submission: 'Another reviewer must approve your own submission.',
  slug_taken: 'That URL slug is already in use.',
  legal_documents_not_approved: 'All legal documents must be approved first.',
  no_payment_provider_configured: 'Configure and authorise a payment provider first.',
  download_expired: 'This download link has expired. Request a new one.',
  download_exhausted: 'This download link has been used up. Request a new one.',
  order_not_deliverable: 'Delivery becomes available after payment is verified.',
  last_super_admin: 'At least one Super Admin must remain.',
  cannot_change_own_role: 'You cannot change your own role.',
}
