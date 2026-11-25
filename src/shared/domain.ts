/**
 * ORSAVEN shared domain model.
 * Single source of truth for catalog families, statuses, roles, permissions
 * and state machines. Imported by both the Worker (authoritative) and the web
 * client (display only — the browser never decides authorization).
 */

export const FAMILIES = [
  {
    key: 'digital_assets',
    slug: 'digital-assets',
    name: { id: 'Digital Assets', en: 'Digital Assets' },
    tagline: {
      id: 'Template, dokumen, dan sumber daya siap pakai untuk membuat, mengatur, dan berkomunikasi.',
      en: 'Ready-to-use templates, documents, and resources to create, organize, and communicate.',
    },
  },
  {
    key: 'business_kits',
    slug: 'business-system-kits',
    name: { id: 'Business & System Kits', en: 'Business & System Kits' },
    tagline: {
      id: 'Paket terstruktur untuk membangun atau memperbaiki proses bisnis yang dapat diulang.',
      en: 'Structured bundles to establish or improve repeatable business processes.',
    },
  },
  {
    key: 'agentic_solutions',
    slug: 'agentic-solutions',
    name: { id: 'Agentic Solutions', en: 'Agentic Solutions' },
    tagline: {
      id: 'Konfigurasi agen, alur kerja agentik, dan paket otomasi dengan batasan yang jelas.',
      en: 'Agent configurations, agentic workflows, and automation packages with clear boundaries.',
    },
  },
  {
    key: 'implementation_services',
    slug: 'implementation-services',
    name: { id: 'Implementation Services', en: 'Implementation Services' },
    tagline: {
      id: 'Layanan terbatas waktu untuk mengonfigurasi, menyesuaikan, mengintegrasikan, atau menerapkan.',
      en: 'Time-bounded services to configure, adapt, integrate, or deploy.',
    },
  },
] as const

export type FamilyKey = (typeof FAMILIES)[number]['key']
export const FAMILY_KEYS = FAMILIES.map((f) => f.key) as FamilyKey[]
export const familyBySlug = (slug: string) => FAMILIES.find((f) => f.slug === slug)
export const familyByKey = (key: string) => FAMILIES.find((f) => f.key === key)

/* ---------------- Product publishing workflow ---------------- */

export const PRODUCT_STATUSES = ['draft', 'review', 'published', 'archived', 'unavailable'] as const
export type ProductStatus = (typeof PRODUCT_STATUSES)[number]

export const MATURITY_LABELS = ['concept', 'prototype', 'beta', 'available', 'retired'] as const
export type Maturity = (typeof MATURITY_LABELS)[number]

export const PRICING_MODELS = ['one_time', 'free', 'quote'] as const
export type PricingModel = (typeof PRICING_MODELS)[number]

export type ProductAction = 'submit' | 'approve' | 'reject' | 'publish' | 'archive' | 'mark_unavailable' | 'restore_draft'

/** Allowed transitions. `approve` keeps status=review but records approval. */
export const PRODUCT_TRANSITIONS: Record<ProductAction, { from: ProductStatus[]; to: ProductStatus }> = {
  submit: { from: ['draft'], to: 'review' },
  approve: { from: ['review'], to: 'review' },
  reject: { from: ['review'], to: 'draft' },
  publish: { from: ['review', 'unavailable'], to: 'published' },
  archive: { from: ['draft', 'review', 'published', 'unavailable'], to: 'archived' },
  mark_unavailable: { from: ['published'], to: 'unavailable' },
  restore_draft: { from: ['archived', 'unavailable'], to: 'draft' },
}

export function canTransitionProduct(action: ProductAction, from: ProductStatus): boolean {
  const t = PRODUCT_TRANSITIONS[action]
  return !!t && t.from.includes(from)
}

/* ---------------- Order lifecycle ---------------- */

export const ORDER_STATUSES = ['pending_payment', 'paid', 'completed', 'cancelled', 'failed', 'refunded'] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

/**
 * Product Selection → Checkout → pending_payment → paid (verified by provider)
 * → completed → delivery available.
 * `paid` can ONLY be entered from a verified provider event (see payments service).
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending_payment: ['paid', 'cancelled', 'failed'],
  paid: ['completed', 'refunded'],
  completed: ['refunded'],
  cancelled: [],
  failed: [],
  refunded: [],
}

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from]?.includes(to) ?? false
}

export const DELIVERABLE_ORDER_STATUSES: OrderStatus[] = ['completed']

/* ---------------- Roles & permissions ---------------- */

export const ROLES = ['super_admin', 'administrator', 'customer'] as const
export type Role = (typeof ROLES)[number]

export const PERMISSIONS = [
  'admin.access',
  'product.read_all',
  'product.write',
  'product.submit',
  'product.approve',
  'product.publish',
  'product.archive',
  'category.write',
  'asset.write',
  'order.read_all',
  'order.update',
  'payment.read',
  'customer.read',
  'inquiry.read',
  'inquiry.update',
  'download.read',
  'audit.read',
  'settings.write',
  'legal.write',
  'legal.approve',
  'user.role_assign',
  'export.data',
] as const
export type Permission = (typeof PERMISSIONS)[number]

const ADMIN_EXCLUDED: Permission[] = ['product.approve', 'product.publish', 'legal.approve', 'user.role_assign']

/** Mirrors migrations seed. Backend reads from DB; this is for fallbacks & display. */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  super_admin: [...PERMISSIONS],
  administrator: PERMISSIONS.filter((p) => !ADMIN_EXCLUDED.includes(p)),
  customer: [],
}

/* ---------------- Inquiries ---------------- */

export const INQUIRY_STATUSES = ['new', 'in_review', 'responded', 'closed', 'spam'] as const
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number]

export const SERVICE_TYPES = [
  'system_implementation',
  'workflow_configuration',
  'technical_setup',
  'integration',
  'customization',
  'deployment_assistance',
  'product_question',
  'support',
  'other',
] as const

/* ---------------- Legal ---------------- */

export const LEGAL_SLUGS = ['privacy', 'terms', 'refund', 'delivery'] as const
export type LegalSlug = (typeof LEGAL_SLUGS)[number]

/* ---------------- Formatting ---------------- */

export function formatIDR(amount: number | null | undefined, locale: 'id' | 'en' = 'id'): string {
  if (amount == null) return '—'
  return new Intl.NumberFormat(locale === 'id' ? 'id-ID' : 'en-US', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount)
}

/* ---------------- Upload validation ---------------- */

export const ALLOWED_UPLOAD_TYPES: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'application/zip': ['.zip'],
  'application/x-zip-compressed': ['.zip'],
  'application/json': ['.json'],
  'text/markdown': ['.md'],
  'text/plain': ['.txt', '.md'],
  'text/csv': ['.csv'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/webp': ['.webp'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
}
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024

export function validateUpload(filename: string, contentType: string, size: number): string | null {
  const exts = ALLOWED_UPLOAD_TYPES[contentType]
  if (!exts) return 'unsupported_type'
  const lower = filename.toLowerCase()
  if (!exts.some((e) => lower.endsWith(e))) return 'extension_mismatch'
  if (/[\\/]|\.\./.test(filename) || filename.length > 180) return 'invalid_filename'
  if (size <= 0) return 'empty_file'
  if (size > MAX_UPLOAD_BYTES) return 'file_too_large'
  return null
}
