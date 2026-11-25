const enc = new TextEncoder()

export function toHex(buf: ArrayBuffer | Uint8Array): string {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let s = ''
  for (const x of b) s += x.toString(16).padStart(2, '0')
  return s
}

export async function sha256Hex(data: string | ArrayBuffer | Uint8Array): Promise<string> {
  const bytes = typeof data === 'string' ? enc.encode(data) : data
  return toHex(await crypto.subtle.digest('SHA-256', bytes as BufferSource))
}

export async function sha512Hex(data: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-512', enc.encode(data)))
}

export async function hmacSha256(key: string | Uint8Array, message: string): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey(
    'raw',
    (typeof key === 'string' ? enc.encode(key) : key) as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(message)))
}

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function randomCode(len: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(len))
  let s = ''
  for (const b of bytes) s += ALPHABET[b % ALPHABET.length]
  return s
}

export function randomToken(bytes = 32): string {
  const b = crypto.getRandomValues(new Uint8Array(bytes))
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export const newOrderId = () => `ORS-${randomCode(10)}`
export const newInquiryId = () => `INQ-${randomCode(10)}`
export const newLicenseCode = () => `${randomCode(4)}-${randomCode(4)}-${randomCode(4)}-${randomCode(4)}`

export async function hashIp(ip: string | undefined, salt = ''): Promise<string> {
  if (!ip) return ''
  return (await sha256Hex(`${salt}:${ip}`)).slice(0, 32)
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export function bytesToBase64(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}
