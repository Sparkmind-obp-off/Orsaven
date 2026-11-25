import { z } from 'zod'
import { FAMILY_KEYS, MATURITY_LABELS, PRICING_MODELS, type ProductStatus } from '../../shared/domain'
import { likeEscape, many, one, pageParams, parseJsonField, type Row } from '../lib/db'

/* ---------------- Validation ---------------- */

const text = (max: number) => z.string().trim().max(max)
const bilingualList = z.object({ id: z.array(text(300)).max(40), en: z.array(text(300)).max(40) })
const bilingualText = (max: number) => z.object({ id: text(max), en: text(max) })

export const productInput = z.object({
  slug: z.string().trim().min(3).max(90).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'lowercase-kebab-case'),
  family: z.enum(FAMILY_KEYS as [string, ...string[]]),
  category_id: z.number().int().positive().nullable().optional(),
  license_id: z.number().int().positive().nullable().optional(),
  title_id: text(160).min(2),
  title_en: text(160).min(2),
  summary_id: text(400).default(''),
  summary_en: text(400).default(''),
  description_id: text(12000).default(''),
  description_en: text(12000).default(''),
  audience_id: text(1000).default(''),
  audience_en: text(1000).default(''),
  includes: bilingualList.default({ id: [], en: [] }),
  excludes: bilingualList.default({ id: [], en: [] }),
  requirements: bilingualList.default({ id: [], en: [] }),
  delivery: bilingualText(2000).default({ id: '', en: '' }),
  support: bilingualText(2000).default({ id: '', en: '' }),
  preview: bilingualText(4000).default({ id: '', en: '' }),
  formats: text(200).default(''),
  pricing_model: z.enum(PRICING_MODELS),
  price_idr: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
  maturity: z.enum(MATURITY_LABELS),
  is_demo: z.boolean().default(false),
  is_featured: z.boolean().default(false),
  seo_title: text(160).default(''),
  seo_description: text(300).default(''),
  internal_notes: text(4000).default(''),
})
export type ProductInput = z.infer<typeof productInput>

export function validatePricing(p: Pick<ProductInput, 'pricing_model' | 'price_idr' | 'family'>): string | null {
  if (p.pricing_model === 'one_time' && !(p.price_idr && p.price_idr > 0)) return 'price_required'
  if (p.pricing_model === 'free' && p.price_idr) return 'free_must_have_no_price'
  if (p.family === 'implementation_services' && p.pricing_model !== 'quote') return 'services_require_quote_pricing'
  return null
}

export function productToDb(p: ProductInput) {
  return {
    slug: p.slug,
    family: p.family,
    category_id: p.category_id ?? null,
    license_id: p.license_id ?? null,
    title_id: p.title_id,
    title_en: p.title_en,
    summary_id: p.summary_id,
    summary_en: p.summary_en,
    description_id: p.description_id,
    description_en: p.description_en,
    audience_id: p.audience_id,
    audience_en: p.audience_en,
    includes_json: JSON.stringify(p.includes),
    excludes_json: JSON.stringify(p.excludes),
    requirements_json: JSON.stringify(p.requirements),
    delivery_json: JSON.stringify(p.delivery),
    support_json: JSON.stringify(p.support),
    preview_json: JSON.stringify(p.preview),
    formats: p.formats,
    pricing_model: p.pricing_model,
    price_idr: p.pricing_model === 'one_time' ? (p.price_idr ?? null) : null,
    maturity: p.maturity,
    is_demo: p.is_demo ? 1 : 0,
    is_featured: p.is_featured ? 1 : 0,
    seo_title: p.seo_title,
    seo_description: p.seo_description,
    internal_notes: p.internal_notes,
  }
}

/* ---------------- Serialisation ---------------- */

const SELECT_PRODUCT = `
  SELECT p.*, c.slug AS category_slug, c.name_id AS category_name_id, c.name_en AS category_name_en,
         l.key AS license_key, l.name_id AS license_name_id, l.name_en AS license_name_en,
         l.summary_id AS license_summary_id, l.summary_en AS license_summary_en, l.status AS license_status,
         v.version AS current_version, v.released_at AS current_version_released_at,
         (SELECT COUNT(*) FROM product_assets a WHERE a.product_id = p.id AND a.kind = 'deliverable' AND a.is_active = 1) AS deliverable_count
  FROM products p
  LEFT JOIN product_categories c ON c.id = p.category_id
  LEFT JOIN product_licenses l ON l.id = p.license_id
  LEFT JOIN product_versions v ON v.id = p.current_version_id`

export function isPurchasable(r: Row): boolean {
  return (
    r.status === 'published' &&
    !r.is_demo &&
    (r.maturity === 'beta' || r.maturity === 'available') &&
    r.family !== 'implementation_services' &&
    r.pricing_model !== 'quote' &&
    Number(r.deliverable_count ?? 0) > 0
  )
}

export function serializePublic(r: Row) {
  return {
    id: r.id as number,
    slug: r.slug as string,
    family: r.family as string,
    category: r.category_slug ? { slug: r.category_slug, name: { id: r.category_name_id, en: r.category_name_en } } : null,
    title: { id: r.title_id as string, en: r.title_en as string },
    summary: { id: r.summary_id as string, en: r.summary_en as string },
    description: { id: r.description_id as string, en: r.description_en as string },
    audience: { id: r.audience_id as string, en: r.audience_en as string },
    includes: parseJsonField(r.includes_json, { id: [], en: [] }),
    excludes: parseJsonField(r.excludes_json, { id: [], en: [] }),
    requirements: parseJsonField(r.requirements_json, { id: [], en: [] }),
    delivery: parseJsonField(r.delivery_json, { id: '', en: '' }),
    support: parseJsonField(r.support_json, { id: '', en: '' }),
    preview: parseJsonField(r.preview_json, { id: '', en: '' }),
    formats: r.formats as string,
    pricing: { model: r.pricing_model as string, priceIdr: (r.price_idr as number | null) ?? null, currency: 'IDR' },
    license: r.license_key
      ? { key: r.license_key, name: { id: r.license_name_id, en: r.license_name_en }, summary: { id: r.license_summary_id, en: r.license_summary_en }, status: r.license_status }
      : null,
    version: (r.current_version as string | null) ?? null,
    versionReleasedAt: (r.current_version_released_at as string | null) ?? null,
    maturity: r.maturity as string,
    status: r.status as ProductStatus,
    isDemo: !!r.is_demo,
    isFeatured: !!r.is_featured,
    purchasable: isPurchasable(r),
    seo: { title: r.seo_title as string, description: r.seo_description as string },
    publishedAt: r.published_at as string | null,
    updatedAt: r.updated_at as string,
  }
}

export function serializeAdmin(r: Row) {
  return {
    ...serializePublic(r),
    categoryId: r.category_id as number | null,
    licenseId: r.license_id as number | null,
    currentVersionId: r.current_version_id as number | null,
    deliverableCount: Number(r.deliverable_count ?? 0),
    internalNotes: r.internal_notes as string,
    submittedAt: r.submitted_at,
    approvedAt: r.approved_at,
    approvedBy: r.approved_by,
    archivedAt: r.archived_at,
    createdAt: r.created_at,
  }
}

/* ---------------- Queries ---------------- */

export const catalogQuery = z.object({
  q: z.string().trim().max(100).optional(),
  family: z.enum(FAMILY_KEYS as [string, ...string[]]).optional(),
  category: z.string().trim().max(90).optional(),
  pricing: z.enum(PRICING_MODELS).optional(),
  sort: z.enum(['newest', 'title', 'price_asc', 'price_desc', 'featured']).default('featured'),
  page: z.coerce.number().optional(),
  pageSize: z.coerce.number().optional(),
  status: z.string().optional(),
})

const SORTS: Record<string, string> = {
  newest: 'p.published_at DESC, p.id DESC',
  title: 'p.title_en COLLATE NOCASE ASC',
  price_asc: 'CASE WHEN p.price_idr IS NULL THEN 1 ELSE 0 END, p.price_idr ASC, p.id DESC',
  price_desc: 'CASE WHEN p.price_idr IS NULL THEN 1 ELSE 0 END, p.price_idr DESC, p.id DESC',
  featured: 'p.is_featured DESC, p.published_at DESC, p.id DESC',
}

export async function listProducts(db: D1Database, q: z.infer<typeof catalogQuery>, opts: { admin: boolean }) {
  const where: string[] = []
  const params: unknown[] = []
  if (!opts.admin) where.push("p.status = 'published'")
  else if (q.status && q.status !== 'all') {
    where.push('p.status = ?')
    params.push(q.status)
  }
  if (q.family) {
    where.push('p.family = ?')
    params.push(q.family)
  }
  if (q.category) {
    where.push('c.slug = ?')
    params.push(q.category)
  }
  if (q.pricing) {
    where.push('p.pricing_model = ?')
    params.push(q.pricing)
  }
  if (q.q) {
    const term = `%${likeEscape(q.q)}%`
    where.push(
      "(p.title_id LIKE ? ESCAPE '\\' OR p.title_en LIKE ? ESCAPE '\\' OR p.summary_id LIKE ? ESCAPE '\\' OR p.summary_en LIKE ? ESCAPE '\\' OR p.formats LIKE ? ESCAPE '\\')",
    )
    params.push(term, term, term, term, term)
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const { page, pageSize, offset } = pageParams(q.page, q.pageSize, opts.admin ? 100 : 48)
  const sort = opts.admin && !q.sort ? 'p.updated_at DESC' : (SORTS[q.sort] ?? SORTS.featured)
  const total = await one<{ n: number }>(
    db,
    `SELECT COUNT(*) AS n FROM products p LEFT JOIN product_categories c ON c.id = p.category_id ${whereSql}`,
    ...params,
  )
  const rows = await many(db, `${SELECT_PRODUCT} ${whereSql} ORDER BY ${sort} LIMIT ? OFFSET ?`, ...params, pageSize, offset)
  const n = total?.n ?? 0
  return { rows, meta: { page, pageSize, total: n, totalPages: Math.max(1, Math.ceil(n / pageSize)) } }
}

export async function getProductBySlug(db: D1Database, slug: string, opts: { admin: boolean }) {
  const r = await one(db, `${SELECT_PRODUCT} WHERE p.slug = ?`, slug)
  if (!r) return null
  if (!opts.admin && r.status !== 'published') return null
  return r
}

export async function getProductById(db: D1Database, id: number) {
  return one(db, `${SELECT_PRODUCT} WHERE p.id = ?`, id)
}

export async function relatedProducts(db: D1Database, r: Row, limit = 3) {
  return many(
    db,
    `${SELECT_PRODUCT} WHERE p.status = 'published' AND p.id != ? AND p.family = ?
     ORDER BY CASE WHEN p.category_id = ? THEN 0 ELSE 1 END, p.is_featured DESC, p.published_at DESC LIMIT ?`,
    r.id,
    r.family,
    r.category_id ?? -1,
    limit,
  )
}
