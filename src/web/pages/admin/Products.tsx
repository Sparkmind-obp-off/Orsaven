import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { FAMILIES, formatIDR, MATURITY_LABELS, PRODUCT_STATUSES } from '../../../shared/domain'
import { api, errorMessage, useApi } from '../../lib/api'
import { cn, formatBytes, formatDate } from '../../lib/cn'
import { useSession } from '../../lib/session'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import { Badge, Button, ButtonLink, Checkbox, ConfirmDialog, Dialog, EmptyState, ErrorState, Field, Input, LoadingBlock, Notice, PageHeader, Pagination, Select, StatusBadge, Table, Tabs, Textarea, td, th, useToast } from '../../components/ui'

type Bi = { id: string; en: string }
type BiList = { id: string[]; en: string[] }

interface AdminProduct {
  id: number
  slug: string
  family: string
  status: string
  maturity: string
  title: Bi
  summary: Bi
  description: Bi
  audience: Bi
  includes: BiList
  excludes: BiList
  requirements: BiList
  delivery: Bi
  support: Bi
  preview: Bi
  formats: string
  pricing: { model: 'one_time' | 'free' | 'quote'; priceIdr: number | null }
  categoryId: number | null
  licenseId: number | null
  isDemo: boolean
  isFeatured: boolean
  seo: { title: string; description: string }
  internalNotes: string
  version: string | null
  deliverableCount: number
  approvedAt: string | null
  submittedAt: string | null
  updatedAt: string
  purchasable: boolean
  versions?: { id: number; version: string; status: string; changelog: string; released_at: string | null; created_at: string }[]
  assets?: { id: number; version_id: number | null; kind: string; label: string; filename: string; content_type: string; size_bytes: number; sha256: string; storage_driver: string; is_active: number; created_at: string }[]
  history?: { action: string; actor_role: string; metadata_json: string; created_at: string }[]
}

const famName = (k: string) => FAMILIES.find((f) => f.key === k)?.name.en ?? k

/* ───────────── List ───────────── */

export function AdminProducts({ approvals = false }: { approvals?: boolean }) {
  useDocumentTitle(approvals ? 'Publishing approvals' : 'Products')
  const { can } = useSession()
  const [params, setParams] = useSearchParams()
  const status = approvals ? 'review' : (params.get('status') ?? 'all')
  const q = params.get('q') ?? ''
  const family = params.get('family') ?? ''
  const page = Number(params.get('page') ?? '1') || 1
  const [search, setSearch] = useState(q)
  useEffect(() => {
    const id = setTimeout(() => {
      if (search === q) return
      const n = new URLSearchParams(params)
      if (search) n.set('q', search)
      else n.delete('q')
      n.delete('page')
      setParams(n, { replace: true })
    }, 300)
    return () => clearTimeout(id)
  }, [search, q, params, setParams])
  const path = useMemo(() => {
    const s = new URLSearchParams({ status, page: String(page), pageSize: '25' })
    if (q) s.set('q', q)
    if (family) s.set('family', family)
    return `/admin/products?${s}`
  }, [status, page, q, family])
  const list = useApi<AdminProduct[]>(path)
  const setP = (k: string, v: string) => {
    const n = new URLSearchParams(params)
    if (v && v !== 'all') n.set(k, v)
    else n.delete(k)
    if (k !== 'page') n.delete('page')
    setParams(n)
  }
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={approvals ? 'Publishing approvals' : 'Products'}
        description={approvals ? 'Products submitted for review. Approval and publishing require the Super Admin role, and a reviewer cannot approve their own submission (except Super Admin).' : 'All products in every status. Only Published products are publicly visible.'}
        actions={can('product.write') && <ButtonLink to="/admin/products/new">New product</ButtonLink>}
      />
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input aria-label="Search products" placeholder="Search title, summary, format…" value={search} onChange={(e) => setSearch(e.target.value)} className="sm:max-w-xs" />
        {!approvals && (
          <Select aria-label="Status" value={status} onChange={(e) => setP('status', e.target.value)}>
            <option value="all">All statuses</option>
            {PRODUCT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        )}
        <Select aria-label="Family" value={family} onChange={(e) => setP('family', e.target.value)}>
          <option value="">All families</option>
          {FAMILIES.map((f) => (
            <option key={f.key} value={f.key}>
              {f.name.en}
            </option>
          ))}
        </Select>
      </div>
      {list.loading ? (
        <LoadingBlock />
      ) : list.error ? (
        <ErrorState message={errorMessage(list.error)} onRetry={list.reload} />
      ) : !list.data?.length ? (
        <EmptyState title={approvals ? 'Nothing awaiting review' : 'No products yet'} body={approvals ? undefined : 'Create a draft, upload deliverables, then submit it for review.'} action={!approvals && can('product.write') ? <ButtonLink to="/admin/products/new">New product</ButtonLink> : undefined} />
      ) : (
        <div className="rounded-sm bg-white p-4 hairline">
          <Table caption="Products">
            <thead>
              <tr>
                <th className={th}>Product</th>
                <th className={th}>Family</th>
                <th className={th}>Status</th>
                <th className={th}>Maturity</th>
                <th className={th}>Price</th>
                <th className={th}>Files</th>
                <th className={th}>Updated</th>
              </tr>
            </thead>
            <tbody>
              {list.data.map((p) => (
                <tr key={p.id} className="hover:bg-ivory-50">
                  <td className={td}>
                    <Link to={`/admin/products/${p.id}`} className="font-medium text-forest-900 hover:underline">
                      {p.title.en}
                    </Link>
                    <div className="mt-0.5 flex flex-wrap gap-1 text-xs text-stone-500">
                      /{p.slug}
                      {p.isDemo && <Badge tone="brass">demo</Badge>}
                      {p.isFeatured && <Badge tone="sage">featured</Badge>}
                      {p.status === 'review' && p.approvedAt && <Badge tone="success">approved</Badge>}
                    </div>
                  </td>
                  <td className={td}>{famName(p.family)}</td>
                  <td className={td}>
                    <StatusBadge status={p.status} />
                  </td>
                  <td className={td}>{p.maturity}</td>
                  <td className={cn(td, 'tabular-nums')}>{p.pricing.model === 'one_time' ? formatIDR(p.pricing.priceIdr, 'en') : p.pricing.model}</td>
                  <td className={cn(td, 'tabular-nums')}>{p.deliverableCount}</td>
                  <td className={cn(td, 'whitespace-nowrap text-xs')}>{formatDate(p.updatedAt, 'en')}</td>
                </tr>
              ))}
            </tbody>
          </Table>
          <div className="mt-4">
            <Pagination page={list.meta?.page ?? 1} totalPages={list.meta?.totalPages ?? 1} onChange={(p) => setP('page', String(p))} />
          </div>
        </div>
      )}
    </div>
  )
}

/* ───────────── Editor ───────────── */

interface FormState {
  slug: string
  family: string
  category_id: number | null
  license_id: number | null
  title_id: string
  title_en: string
  summary_id: string
  summary_en: string
  description_id: string
  description_en: string
  audience_id: string
  audience_en: string
  includes: { id: string; en: string }
  excludes: { id: string; en: string }
  requirements: { id: string; en: string }
  delivery: Bi
  support: Bi
  preview: Bi
  formats: string
  pricing_model: 'one_time' | 'free' | 'quote'
  price_idr: string
  maturity: string
  is_demo: boolean
  is_featured: boolean
  seo_title: string
  seo_description: string
  internal_notes: string
}

const emptyForm: FormState = {
  slug: '',
  family: 'digital_assets',
  category_id: null,
  license_id: null,
  title_id: '',
  title_en: '',
  summary_id: '',
  summary_en: '',
  description_id: '',
  description_en: '',
  audience_id: '',
  audience_en: '',
  includes: { id: '', en: '' },
  excludes: { id: '', en: '' },
  requirements: { id: '', en: '' },
  delivery: { id: '', en: '' },
  support: { id: '', en: '' },
  preview: { id: '', en: '' },
  formats: '',
  pricing_model: 'one_time',
  price_idr: '',
  maturity: 'concept',
  is_demo: false,
  is_featured: false,
  seo_title: '',
  seo_description: '',
  internal_notes: '',
}

const lines = (s: string) =>
  s
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean)

function fromProduct(p: AdminProduct): FormState {
  return {
    slug: p.slug,
    family: p.family,
    category_id: p.categoryId,
    license_id: p.licenseId,
    title_id: p.title.id,
    title_en: p.title.en,
    summary_id: p.summary.id,
    summary_en: p.summary.en,
    description_id: p.description.id,
    description_en: p.description.en,
    audience_id: p.audience.id,
    audience_en: p.audience.en,
    includes: { id: p.includes.id.join('\n'), en: p.includes.en.join('\n') },
    excludes: { id: p.excludes.id.join('\n'), en: p.excludes.en.join('\n') },
    requirements: { id: p.requirements.id.join('\n'), en: p.requirements.en.join('\n') },
    delivery: p.delivery,
    support: p.support,
    preview: p.preview,
    formats: p.formats,
    pricing_model: p.pricing.model,
    price_idr: p.pricing.priceIdr != null ? String(p.pricing.priceIdr) : '',
    maturity: p.maturity,
    is_demo: p.isDemo,
    is_featured: p.isFeatured,
    seo_title: p.seo.title,
    seo_description: p.seo.description,
    internal_notes: p.internalNotes,
  }
}

function toPayload(f: FormState) {
  return {
    ...f,
    includes: { id: lines(f.includes.id), en: lines(f.includes.en) },
    excludes: { id: lines(f.excludes.id), en: lines(f.excludes.en) },
    requirements: { id: lines(f.requirements.id), en: lines(f.requirements.en) },
    price_idr: f.pricing_model === 'one_time' && f.price_idr ? Number(f.price_idr) : null,
  }
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 90)

const ACTION_LABEL: Record<string, string> = {
  submit: 'Submit for review',
  approve: 'Approve',
  reject: 'Return to draft',
  publish: 'Publish',
  archive: 'Archive',
  mark_unavailable: 'Mark unavailable',
  restore_draft: 'Restore to draft',
}
const ACTIONS_BY_STATUS: Record<string, { action: string; perm: string; tone?: 'danger' }[]> = {
  draft: [
    { action: 'submit', perm: 'product.submit' },
    { action: 'archive', perm: 'product.archive', tone: 'danger' },
  ],
  review: [
    { action: 'approve', perm: 'product.approve' },
    { action: 'publish', perm: 'product.publish' },
    { action: 'reject', perm: 'product.approve' },
    { action: 'archive', perm: 'product.archive', tone: 'danger' },
  ],
  published: [
    { action: 'mark_unavailable', perm: 'product.publish' },
    { action: 'archive', perm: 'product.archive', tone: 'danger' },
  ],
  unavailable: [
    { action: 'publish', perm: 'product.publish' },
    { action: 'restore_draft', perm: 'product.write' },
    { action: 'archive', perm: 'product.archive', tone: 'danger' },
  ],
  archived: [{ action: 'restore_draft', perm: 'product.write' }],
}

export function AdminProductEditor() {
  const { id } = useParams()
  const isNew = id === 'new'
  const navigate = useNavigate()
  const toast = useToast()
  const { can } = useSession()
  const product = useApi<AdminProduct>(isNew ? null : `/admin/products/${id}`)
  const categories = useApi<{ id: number; family: string; slug: string; name_en: string }[]>('/admin/categories')
  const licenses = useApi<{ id: number; key: string; name_en: string; status: string }[]>('/admin/licenses')
  const [f, setF] = useState<FormState>(emptyForm)
  const [tab, setTab] = useState<'content' | 'details' | 'pricing' | 'files' | 'history'>('content')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [slugTouched, setSlugTouched] = useState(!isNew)
  const [pending, setPending] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [acting, setActing] = useState(false)
  useDocumentTitle(isNew ? 'New product' : (product.data?.title.en ?? 'Product'))

  useEffect(() => {
    if (product.data) setF(fromProduct(product.data))
  }, [product.data])

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((x) => ({ ...x, [k]: v }))
  const setBi = (k: 'includes' | 'excludes' | 'requirements' | 'delivery' | 'support' | 'preview', lang: 'id' | 'en', v: string) => setF((x) => ({ ...x, [k]: { ...x[k], [lang]: v } }))
  const canWrite = can('product.write')

  const save = async () => {
    setErr(null)
    setSaving(true)
    try {
      const body = toPayload(f)
      if (isNew) {
        const r = await api<AdminProduct>('/admin/products', { method: 'POST', body })
        toast.push('success', 'Draft saved')
        navigate(`/admin/products/${r.data.id}`, { replace: true })
      } else {
        await api(`/admin/products/${id}`, { method: 'PUT', body })
        toast.push('success', 'Changes saved')
        product.reload()
      }
    } catch (e) {
      setErr(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const transition = async () => {
    if (!pending) return
    setActing(true)
    try {
      await api(`/admin/products/${id}/transition`, { method: 'POST', body: { action: pending, note } })
      toast.push('success', `${ACTION_LABEL[pending]} — done`)
      setPending(null)
      setNote('')
      product.reload()
    } catch (e) {
      toast.push('error', errorMessage(e))
    } finally {
      setActing(false)
    }
  }

  if (!isNew && product.loading) return <LoadingBlock rows={8} />
  if (!isNew && product.error) return <ErrorState message={errorMessage(product.error)} onRetry={product.reload} />
  const p = product.data
  const cats = (categories.data ?? []).filter((c) => c.family === f.family)

  const biField = (label: string, idKey: keyof FormState, enKey: keyof FormState, opts: { textarea?: boolean; rows?: number; hint?: string; required?: boolean } = {}) => (
    <div className="grid gap-4 md:grid-cols-2">
      {(['id', 'en'] as const).map((lang) => {
        const k = lang === 'id' ? idKey : enKey
        const v = f[k] as string
        return (
          <Field key={lang} label={`${label} (${lang.toUpperCase()})`} hint={opts.hint} required={opts.required}>
            {(props) =>
              opts.textarea ? (
                <Textarea {...props} rows={opts.rows ?? 4} value={v} disabled={!canWrite} onChange={(e) => set(k, e.target.value as never)} />
              ) : (
                <Input
                  {...props}
                  value={v}
                  disabled={!canWrite}
                  onChange={(e) => {
                    set(k, e.target.value as never)
                    if (k === 'title_en' && !slugTouched) set('slug', slugify(e.target.value))
                  }}
                />
              )
            }
          </Field>
        )
      })}
    </div>
  )
  const biList = (label: string, k: 'includes' | 'excludes' | 'requirements' | 'delivery' | 'support' | 'preview', hint: string, rows = 4) => (
    <div className="grid gap-4 md:grid-cols-2">
      {(['id', 'en'] as const).map((lang) => (
        <Field key={lang} label={`${label} (${lang.toUpperCase()})`} hint={hint}>
          {(props) => <Textarea {...props} rows={rows} value={f[k][lang]} disabled={!canWrite} onChange={(e) => setBi(k, lang, e.target.value)} />}
        </Field>
      ))}
    </div>
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        breadcrumb={
          <Link to="/admin/products" className="text-xs text-stone-600 hover:text-forest-900">
            ← Products
          </Link>
        }
        title={isNew ? 'New product' : (p?.title.en ?? '')}
        description={p ? `/${p.slug} · ${famName(p.family)}` : 'Products are created as Draft and are not public until approved and published.'}
        actions={
          <>
            {p && <StatusBadge status={p.status} />}
            {p?.status === 'published' && (
              <ButtonLink to={`/products/${p.slug}`} variant="secondary" size="sm" target="_blank">
                View public page
              </ButtonLink>
            )}
          </>
        }
      />

      {p && (
        <section aria-label="Workflow" className="flex flex-col gap-3 rounded-sm bg-white p-4 hairline sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-xs text-stone-600">
            {['draft', 'review', 'published'].map((s, i) => (
              <span key={s} className="flex items-center gap-2">
                {i > 0 && <span className="h-px w-5 bg-ink/20" aria-hidden="true" />}
                <span className={cn('rounded-xs px-2 py-1 font-semibold uppercase tracking-wider', p.status === s ? 'bg-forest-900 text-ivory-50' : 'bg-ink/5')}>{s}</span>
              </span>
            ))}
            {p.status === 'review' && <span className="ml-2">{p.approvedAt ? `Approved ${formatDate(p.approvedAt, 'en', true)}` : 'Awaiting approval'}</span>}
          </div>
          <div className="flex flex-wrap gap-2">
            {(ACTIONS_BY_STATUS[p.status] ?? [])
              .filter((a) => can(a.perm))
              .filter((a) => !(a.action === 'approve' && p.approvedAt))
              .map((a) => (
                <Button key={a.action} size="sm" variant={a.tone === 'danger' ? 'ghost' : a.action === 'publish' || a.action === 'approve' ? 'primary' : 'secondary'} className={a.tone === 'danger' ? 'text-danger' : ''} onClick={() => setPending(a.action)}>
                  {ACTION_LABEL[a.action]}
                </Button>
              ))}
          </div>
        </section>
      )}

      <Tabs
        label="Product sections"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'content', label: 'Content' },
          { value: 'details', label: 'Scope & delivery' },
          { value: 'pricing', label: 'Pricing & status' },
          ...(isNew ? [] : [{ value: 'files' as const, label: `Files & versions` }, { value: 'history' as const, label: 'History' }]),
        ]}
      />

      <div className="rounded-sm bg-white p-5 hairline lg:p-7">
        {tab === 'content' && (
          <div className="flex flex-col gap-6">
            {biField('Title', 'title_id', 'title_en', { required: true })}
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="URL slug" required hint="lowercase-kebab-case">
                {(props) => (
                  <Input
                    {...props}
                    value={f.slug}
                    disabled={!canWrite}
                    onChange={(e) => {
                      setSlugTouched(true)
                      set('slug', e.target.value)
                    }}
                  />
                )}
              </Field>
              <Field label="Family" required>
                {(props) => (
                  <Select
                    {...props}
                    value={f.family}
                    disabled={!canWrite}
                    onChange={(e) => {
                      const fam = e.target.value
                      setF((x) => ({ ...x, family: fam, category_id: null, pricing_model: fam === 'implementation_services' ? 'quote' : x.pricing_model }))
                    }}
                  >
                    {FAMILIES.map((x) => (
                      <option key={x.key} value={x.key}>
                        {x.name.en}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Category">
                {(props) => (
                  <Select {...props} value={f.category_id ?? ''} disabled={!canWrite} onChange={(e) => set('category_id', e.target.value ? Number(e.target.value) : null)}>
                    <option value="">—</option>
                    {cats.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name_en}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
            {biField('Summary (one-sentence outcome)', 'summary_id', 'summary_en', { textarea: true, rows: 2 })}
            {biField('Description', 'description_id', 'description_en', { textarea: true, rows: 8, hint: 'Supports ## headings, - lists, **bold**, [links](https://…).' })}
            {biField('Intended customer & use case', 'audience_id', 'audience_en', { textarea: true, rows: 3 })}
          </div>
        )}
        {tab === 'details' && (
          <div className="flex flex-col gap-6">
            {biList('What is included', 'includes', 'One item per line.')}
            {biList('What is not included', 'excludes', 'One item per line.')}
            {biList('Requirements & compatibility', 'requirements', 'One item per line. For Agentic Solutions list providers, permissions, human approval points, usage costs.')}
            {biList('Delivery method & timing', 'delivery', 'Plain text.', 3)}
            {biList('Support & update policy', 'support', 'Plain text.', 3)}
            {biList('Preview / sample', 'preview', 'Markdown. Use real sample content only.', 5)}
            <Field label="File formats" hint="e.g. PDF, XLSX, Notion template">
              {(props) => <Input {...props} value={f.formats} disabled={!canWrite} onChange={(e) => set('formats', e.target.value)} />}
            </Field>
          </div>
        )}
        {tab === 'pricing' && (
          <div className="flex flex-col gap-6">
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Pricing model" required hint={f.family === 'implementation_services' ? 'Services must use quote pricing.' : undefined}>
                {(props) => (
                  <Select {...props} value={f.pricing_model} disabled={!canWrite} onChange={(e) => set('pricing_model', e.target.value as FormState['pricing_model'])}>
                    <option value="one_time">One-time</option>
                    <option value="free">Free</option>
                    <option value="quote">By quote</option>
                  </Select>
                )}
              </Field>
              <Field label="Price (IDR)" hint="Whole rupiah, tax-inclusive policy pending review.">
                {(props) => <Input {...props} type="number" min={0} step={1000} inputMode="numeric" value={f.price_idr} disabled={!canWrite || f.pricing_model !== 'one_time'} onChange={(e) => set('price_idr', e.target.value)} />}
              </Field>
              <Field label="License">
                {(props) => (
                  <Select {...props} value={f.license_id ?? ''} disabled={!canWrite} onChange={(e) => set('license_id', e.target.value ? Number(e.target.value) : null)}>
                    <option value="">—</option>
                    {(licenses.data ?? []).map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name_en} ({l.status})
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
            <Field label="Maturity label" required hint="Only mark Available after the delivery checklist and quality review pass.">
              {(props) => (
                <Select {...props} value={f.maturity} disabled={!canWrite} onChange={(e) => set('maturity', e.target.value)}>
                  {MATURITY_LABELS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <div className="flex flex-col gap-3">
              <Checkbox checked={f.is_demo} disabled={!canWrite} onChange={(e) => set('is_demo', e.target.checked)} label="Example / demo listing — clearly labelled, never purchasable, excluded from sitemap." />
              <Checkbox checked={f.is_featured} disabled={!canWrite} onChange={(e) => set('is_featured', e.target.checked)} label="Feature on the homepage" />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="SEO title">{(props) => <Input {...props} value={f.seo_title} maxLength={160} disabled={!canWrite} onChange={(e) => set('seo_title', e.target.value)} />}</Field>
              <Field label="SEO description">{(props) => <Input {...props} value={f.seo_description} maxLength={300} disabled={!canWrite} onChange={(e) => set('seo_description', e.target.value)} />}</Field>
            </div>
            <Field label="Internal notes (never public)" hint="Provenance, owner, rights review, cost notes.">
              {(props) => <Textarea {...props} rows={4} value={f.internal_notes} disabled={!canWrite} onChange={(e) => set('internal_notes', e.target.value)} />}
            </Field>
            {p && !p.purchasable && p.status === 'published' && (
              <Notice tone="warning">
                Not purchasable: requires a non-demo product with maturity Beta/Available, one-time or free pricing, and at least one active deliverable file.
              </Notice>
            )}
          </div>
        )}
        {tab === 'files' && p && <FilesPanel product={p} onChange={product.reload} />}
        {tab === 'history' && p && (
          <ol className="flex flex-col">
            {(p.history ?? []).map((h, i) => (
              <li key={i} className="flex flex-col gap-0.5 border-b border-ink/[0.07] py-3 sm:flex-row sm:justify-between">
                <span className="text-sm font-medium">{h.action}</span>
                <span className="text-xs text-stone-600">
                  {h.actor_role} · {formatDate(h.created_at, 'en', true)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>

      {canWrite && tab !== 'files' && tab !== 'history' && (
        <div className="sticky bottom-0 z-10 -mx-1 flex flex-col gap-2 border-t border-ink/10 bg-ivory-100/95 px-1 py-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs text-stone-600">{p?.status === 'published' && !can('product.publish') ? 'Saving a published product as Administrator returns it to Review.' : isNew ? 'Saved as Draft.' : `Last updated ${formatDate(p?.updatedAt, 'en', true)}`}</span>
          <div className="flex items-center gap-3">
            {err && (
              <span role="alert" className="max-w-md text-xs font-medium text-danger">
                {err}
              </span>
            )}
            <Button onClick={save} loading={saving}>
              {isNew ? 'Save draft' : 'Save changes'}
            </Button>
          </div>
        </div>
      )}

      <Dialog
        open={!!pending}
        onClose={() => setPending(null)}
        title={pending ? ACTION_LABEL[pending] : ''}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button variant={pending === 'archive' ? 'danger' : 'primary'} loading={acting} onClick={transition}>
              Confirm
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink/80">This action is recorded in the audit log.</p>
          <Field label="Note (optional)">{(props) => <Textarea {...props} rows={3} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
        </div>
      </Dialog>
    </div>
  )
}

function FilesPanel({ product, onChange }: { product: AdminProduct; onChange: () => void }) {
  const toast = useToast()
  const { can } = useSession()
  const fileRef = useRef<HTMLInputElement>(null)
  const [label, setLabel] = useState('')
  const [kind, setKind] = useState('deliverable')
  const [versionId, setVersionId] = useState('')
  const [uploading, setUploading] = useState(false)
  const [ver, setVer] = useState({ version: '', changelog: '', release: true })
  const [creating, setCreating] = useState(false)
  const [toggle, setToggle] = useState<{ id: number; active: boolean } | null>(null)

  const upload = async (e: React.FormEvent) => {
    e.preventDefault()
    const file = fileRef.current?.files?.[0]
    if (!file) return toast.push('error', 'Choose a file first')
    const form = new FormData()
    form.set('file', file)
    form.set('label', label)
    form.set('kind', kind)
    if (versionId) form.set('versionId', versionId)
    setUploading(true)
    try {
      await api(`/admin/products/${product.id}/assets`, { method: 'POST', form })
      toast.push('success', `${file.name} uploaded`)
      setLabel('')
      if (fileRef.current) fileRef.current.value = ''
      onChange()
    } catch (err) {
      toast.push('error', errorMessage(err))
    } finally {
      setUploading(false)
    }
  }
  const createVersion = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    try {
      await api(`/admin/products/${product.id}/versions`, { method: 'POST', body: ver })
      toast.push('success', `Version ${ver.version} created`)
      setVer({ version: '', changelog: '', release: true })
      onChange()
    } catch (err) {
      toast.push('error', errorMessage(err))
    } finally {
      setCreating(false)
    }
  }
  const release = async (vid: number) => {
    try {
      await api(`/admin/products/${product.id}/versions/${vid}/release`, { method: 'POST' })
      toast.push('success', 'Version released')
      onChange()
    } catch (err) {
      toast.push('error', errorMessage(err))
    }
  }
  const doToggle = async () => {
    if (!toggle) return
    try {
      await api(`/admin/assets/${toggle.id}`, { method: 'PATCH', body: { isActive: toggle.active } })
      onChange()
    } catch (err) {
      toast.push('error', errorMessage(err))
    } finally {
      setToggle(null)
    }
  }

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4">
        <h2 className="font-display text-lg">Versions</h2>
        {product.versions?.length ? (
          <Table caption="Versions">
            <thead>
              <tr>
                <th className={th}>Version</th>
                <th className={th}>Status</th>
                <th className={th}>Changelog</th>
                <th className={th}>Released</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody>
              {product.versions.map((v) => (
                <tr key={v.id}>
                  <td className={cn(td, 'font-mono')}>{v.version}</td>
                  <td className={td}>
                    <StatusBadge status={v.status} />
                  </td>
                  <td className={cn(td, 'max-w-xs text-xs text-stone-600')}>{v.changelog || '—'}</td>
                  <td className={cn(td, 'text-xs')}>{formatDate(v.released_at, 'en')}</td>
                  <td className={td}>
                    {v.status !== 'released' && can('product.write') && (
                      <Button size="sm" variant="secondary" onClick={() => release(v.id)}>
                        Release
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <p className="text-sm text-stone-600">No versions yet.</p>
        )}
        {can('product.write') && (
          <form onSubmit={createVersion} className="grid gap-3 rounded-sm bg-ivory-100 p-4 md:grid-cols-[8rem_1fr_auto_auto] md:items-end">
            <Field label="Version" required hint="e.g. 1.0.0">
              {(p) => <Input {...p} value={ver.version} onChange={(e) => setVer({ ...ver, version: e.target.value })} />}
            </Field>
            <Field label="Changelog">{(p) => <Input {...p} value={ver.changelog} onChange={(e) => setVer({ ...ver, changelog: e.target.value })} />}</Field>
            <Checkbox checked={ver.release} onChange={(e) => setVer({ ...ver, release: e.target.checked })} label="Release now" className="pb-2.5" />
            <Button type="submit" loading={creating} disabled={!ver.version}>
              Add version
            </Button>
          </form>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="font-display text-lg">Private files</h2>
          <p className="mt-1 text-xs text-stone-600">Files are stored privately and only delivered through short-lived, use-limited links after a completed order. Allowed: PDF, ZIP, JSON, MD, TXT, CSV, PNG, JPG, WEBP, DOCX, XLSX, PPTX. Free-tier D1 storage limit ≈ 1.8 MB per file.</p>
        </div>
        {product.assets?.length ? (
          <Table caption="Files">
            <thead>
              <tr>
                <th className={th}>File</th>
                <th className={th}>Kind</th>
                <th className={th}>Size</th>
                <th className={th}>SHA-256</th>
                <th className={th}>Status</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody>
              {product.assets.map((a) => (
                <tr key={a.id}>
                  <td className={td}>
                    <p className="font-medium">{a.label || a.filename}</p>
                    <p className="text-xs text-stone-500">{a.filename}</p>
                  </td>
                  <td className={td}>{a.kind}</td>
                  <td className={cn(td, 'tabular-nums')}>{formatBytes(a.size_bytes)}</td>
                  <td className={cn(td, 'font-mono text-[0.6875rem] text-stone-500')}>{a.sha256.slice(0, 12)}…</td>
                  <td className={td}>
                    <StatusBadge status={a.is_active ? 'published' : 'archived'} label={a.is_active ? 'active' : 'inactive'} />
                  </td>
                  <td className={td}>
                    {can('asset.write') && (
                      <Button size="sm" variant="ghost" onClick={() => setToggle({ id: a.id, active: !a.is_active })}>
                        {a.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <p className="text-sm text-stone-600">No files uploaded.</p>
        )}
        {can('asset.write') && (
          <form onSubmit={upload} className="grid gap-3 rounded-sm bg-ivory-100 p-4 md:grid-cols-2 lg:grid-cols-[1fr_1fr_9rem_9rem_auto] lg:items-end">
            <Field label="File" required>
              {(p) => <input {...p} ref={fileRef} type="file" className="block w-full text-sm file:mr-3 file:rounded-xs file:border-0 file:bg-forest-900 file:px-3 file:py-2 file:text-xs file:font-medium file:text-ivory-50" />}
            </Field>
            <Field label="Label">{(p) => <Input {...p} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Main guide (PDF)" />}</Field>
            <Field label="Kind">
              {(p) => (
                <Select {...p} value={kind} onChange={(e) => setKind(e.target.value)}>
                  <option value="deliverable">Deliverable</option>
                  <option value="preview">Preview</option>
                </Select>
              )}
            </Field>
            <Field label="Version">
              {(p) => (
                <Select {...p} value={versionId} onChange={(e) => setVersionId(e.target.value)}>
                  <option value="">—</option>
                  {(product.versions ?? []).map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.version}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Button type="submit" loading={uploading}>
              Upload
            </Button>
          </form>
        )}
      </section>
      <ConfirmDialog open={!!toggle} title={toggle?.active ? 'Activate file' : 'Deactivate file'} body={toggle?.active ? 'Customers with completed orders will be able to download this file.' : 'Customers will no longer be able to download this file. Existing download links stop working.'} confirmLabel="Confirm" onConfirm={doToggle} onClose={() => setToggle(null)} tone={toggle?.active ? 'primary' : 'danger'} />
    </div>
  )
}
