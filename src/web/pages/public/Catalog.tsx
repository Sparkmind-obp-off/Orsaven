import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { FAMILIES, familyBySlug } from '../../../shared/domain'
import { useI18n, type Bilingual } from '../../i18n'
import { useApi } from '../../lib/api'
import { Button, ButtonLink, Dialog, EmptyState, ErrorState, Icon, Input, Pagination, Select } from '../../components/ui'
import { ProductCard, ProductCardSkeleton, type PublicProduct } from '../../components/catalog'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import NotFound from './NotFound'

interface Category {
  id: number
  family: string
  slug: string
  name: Bilingual
  productCount: number
}

export default function Catalog() {
  const { t, L } = useI18n()
  const { family: familySlug } = useParams()
  const fam = familySlug ? familyBySlug(familySlug) : undefined
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState(params.get('q') ?? '')
  const [filtersOpen, setFiltersOpen] = useState(false)
  useDocumentTitle(fam ? L(fam.name) : t('catalog.title'))

  const category = params.get('category') ?? ''
  const pricing = params.get('pricing') ?? ''
  const sort = params.get('sort') ?? 'featured'
  const page = Number(params.get('page') ?? '1') || 1

  // Debounced search → URL
  useEffect(() => {
    const id = setTimeout(() => {
      const cur = params.get('q') ?? ''
      if (q.trim() === cur) return
      const next = new URLSearchParams(params)
      if (q.trim()) next.set('q', q.trim())
      else next.delete('q')
      next.delete('page')
      setParams(next, { replace: true })
    }, 300)
    return () => clearTimeout(id)
  }, [q, params, setParams])

  const query = useMemo(() => {
    const s = new URLSearchParams()
    if (fam) s.set('family', fam.key)
    for (const k of ['q', 'category', 'pricing', 'sort', 'page']) {
      const v = params.get(k)
      if (v) s.set(k, v)
    }
    s.set('pageSize', '12')
    return `/catalog/products?${s.toString()}`
  }, [fam, params])

  const products = useApi<PublicProduct[]>(query)
  const categories = useApi<Category[]>('/catalog/categories')
  const famCategories = (categories.data ?? []).filter((c) => !fam || c.family === fam.key)

  if (familySlug && !fam) return <NotFound />

  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(params)
    if (v) next.set(k, v)
    else next.delete(k)
    if (k !== 'page') next.delete('page')
    setParams(next)
  }
  const clear = () => {
    setQ('')
    setParams(new URLSearchParams())
  }
  const hasFilters = !!(params.get('q') || category || pricing)
  const total = products.meta?.total ?? 0

  const filterControls = (
    <>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="filter-category" className="text-xs font-medium text-stone-600">
          {t('catalog.category')}
        </label>
        <Select id="filter-category" value={category} onChange={(e) => setParam('category', e.target.value)}>
          <option value="">{t('catalog.allCategories')}</option>
          {famCategories.map((c) => (
            <option key={c.id} value={c.slug}>
              {L(c.name)}
              {c.productCount ? ` (${c.productCount})` : ''}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="filter-pricing" className="text-xs font-medium text-stone-600">
          {t('catalog.pricing')}
        </label>
        <Select id="filter-pricing" value={pricing} onChange={(e) => setParam('pricing', e.target.value)}>
          <option value="">{t('catalog.anyPricing')}</option>
          <option value="one_time">{t('pricing.one_time')}</option>
          <option value="free">{t('pricing.free')}</option>
          <option value="quote">{t('pricing.quote')}</option>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="filter-sort" className="text-xs font-medium text-stone-600">
          {t('catalog.sort')}
        </label>
        <Select id="filter-sort" value={sort} onChange={(e) => setParam('sort', e.target.value === 'featured' ? '' : e.target.value)}>
          {(['featured', 'newest', 'title', 'price_asc', 'price_desc'] as const).map((s) => (
            <option key={s} value={s}>
              {t(`catalog.sort.${s}`)}
            </option>
          ))}
        </Select>
      </div>
    </>
  )

  return (
    <>
      <section className="border-b border-ink/10 bg-ivory-100">
        <div className="container-site flex flex-col gap-8 pb-10 pt-14 lg:pb-14 lg:pt-20">
          <nav aria-label="Breadcrumb" className="text-xs text-stone-600">
            <ol className="flex items-center gap-2">
              <li>
                <a href="/" className="hover:text-forest-900">
                  ORSAVEN
                </a>
              </li>
              <li aria-hidden="true">/</li>
              <li>{fam ? <a href="/catalog" className="hover:text-forest-900">{t('catalog.title')}</a> : <span aria-current="page">{t('catalog.title')}</span>}</li>
              {fam && (
                <>
                  <li aria-hidden="true">/</li>
                  <li aria-current="page">{L(fam.name)}</li>
                </>
              )}
            </ol>
          </nav>
          <div className="grid gap-6 lg:grid-cols-12 lg:items-end">
            <div className="flex flex-col gap-4 lg:col-span-8">
              {fam && <p className="eyebrow">0{FAMILIES.findIndex((f) => f.key === fam.key) + 1} — {t('nav.families')}</p>}
              <h1 className="text-balance text-display-lg font-light text-forest-950">{fam ? L(fam.name) : t('catalog.title')}</h1>
              <p className="max-w-2xl text-lg leading-relaxed text-stone-600">{fam ? L(fam.tagline) : t('catalog.subtitle')}</p>
            </div>
            {fam?.key === 'implementation_services' && (
              <div className="lg:col-span-4 lg:text-right">
                <ButtonLink to="/contact?type=system_implementation">{t('home.services.cta')}</ButtonLink>
              </div>
            )}
          </div>
          {/* Family switcher */}
          <nav aria-label={t('nav.families')} className="-mb-px flex gap-6 overflow-x-auto border-b border-ink/10 text-sm">
            <a href="/catalog" aria-current={!fam ? 'page' : undefined} className={`-mb-px whitespace-nowrap border-b-2 pb-3 ${!fam ? 'border-forest-900 font-semibold text-forest-950' : 'border-transparent text-stone-600 hover:text-forest-900'}`}>
              {t('nav.allProducts')}
            </a>
            {FAMILIES.map((f) => (
              <a key={f.key} href={`/catalog/${f.slug}`} aria-current={fam?.key === f.key ? 'page' : undefined} className={`-mb-px whitespace-nowrap border-b-2 pb-3 ${fam?.key === f.key ? 'border-forest-900 font-semibold text-forest-950' : 'border-transparent text-stone-600 hover:text-forest-900'}`}>
                {L(f.name)}
              </a>
            ))}
          </nav>
        </div>
      </section>

      <section className="container-site py-10 lg:py-14" aria-label={t('catalog.title')}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="relative flex-1">
            <label htmlFor="search-input" className="sr-only">
              {t('catalog.search')}
            </label>
            <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-stone-500" />
            <Input id="search-input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('catalog.searchPlaceholder')} className="h-12 pl-10 text-[0.9375rem]" maxLength={100} />
          </div>
          <div className="hidden gap-3 lg:grid lg:w-[34rem] lg:grid-cols-3">{filterControls}</div>
          <Button variant="secondary" className="lg:hidden" onClick={() => setFiltersOpen(true)}>
            <Icon name="filter" />
            {t('catalog.filters')}
          </Button>
        </div>

        <div className="mt-6 flex items-center justify-between gap-4 text-sm text-stone-600" aria-live="polite">
          <span>{products.loading ? t('common.loading') : total === 1 ? t('catalog.result') : t('catalog.results', { n: total })}</span>
          {hasFilters && (
            <button type="button" onClick={clear} className="link-underline font-medium text-forest-800">
              {t('catalog.clear')}
            </button>
          )}
        </div>

        <div className="mt-6">
          {products.error ? (
            <ErrorState message={products.error.message} onRetry={products.reload} />
          ) : products.loading ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          ) : products.data && products.data.length > 0 ? (
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {products.data.map((p, i) => (
                <li key={p.id}>
                  <ProductCard p={p} index={(page - 1) * 12 + i} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title={t('catalog.empty.title')}
              body={t('catalog.empty.body')}
              action={
                <div className="flex flex-wrap gap-3">
                  {hasFilters && (
                    <Button variant="secondary" onClick={clear}>
                      {t('catalog.clear')}
                    </Button>
                  )}
                  <ButtonLink to="/contact?type=product_question">{t('product.ask')}</ButtonLink>
                </div>
              }
            />
          )}
        </div>
        <div className="mt-10">
          <Pagination page={products.meta?.page ?? page} totalPages={products.meta?.totalPages ?? 1} onChange={(p) => setParam('page', p > 1 ? String(p) : '')} />
        </div>
      </section>

      <Dialog
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title={t('catalog.filters')}
        footer={
          <>
            {hasFilters && (
              <Button variant="ghost" onClick={clear}>
                {t('catalog.clear')}
              </Button>
            )}
            <Button onClick={() => setFiltersOpen(false)}>{t('catalog.applyFilters')}</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">{filterControls}</div>
      </Dialog>
    </>
  )
}
