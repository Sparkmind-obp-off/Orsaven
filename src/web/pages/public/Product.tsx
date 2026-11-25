import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { familyByKey } from '../../../shared/domain'
import { useI18n } from '../../i18n'
import { api, errorMessage, useApi } from '../../lib/api'
import { formatBytes, formatDate } from '../../lib/cn'
import { useSession } from '../../lib/session'
import { Markdown } from '../../lib/markdown'
import { Badge, Button, ButtonLink, Checkbox, ErrorState, Icon, LoadingBlock, Notice, useToast } from '../../components/ui'
import { MaturityBadge, PriceLabel, ProductCard, type PublicProduct } from '../../components/catalog'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import NotFound from './NotFound'

type Detail = PublicProduct & { deliverables: { label: string; contentType: string; sizeBytes: number }[]; related: PublicProduct[] }

function ListBlock({ title, items, empty, icon }: { title: string; items: string[]; empty: string; icon: 'check' | 'close' | 'arrowRight' }) {
  return (
    <section className="flex flex-col gap-4 border-t border-forest-900 pt-5">
      <h2 className="font-display text-xl text-forest-950">{title}</h2>
      {items.length ? (
        <ul className="flex flex-col gap-2.5">
          {items.map((x, i) => (
            <li key={i} className="flex gap-3 text-[0.9375rem] leading-relaxed text-ink/85">
              <Icon name={icon} className={`mt-1 size-4 ${icon === 'close' ? 'text-stone-500' : 'text-sage-500'}`} />
              <span>{x}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-stone-500">{empty}</p>
      )}
    </section>
  )
}

export default function Product() {
  const { slug } = useParams()
  const { t, L, locale } = useI18n()
  const { data: p, loading, error, reload } = useApi<Detail>(`/catalog/products/${encodeURIComponent(slug ?? '')}`)
  const session = useSession()
  const toast = useToast()
  const navigate = useNavigate()
  const [accept, setAccept] = useState(false)
  const [busy, setBusy] = useState(false)
  useDocumentTitle(p ? L(p.title) : null)

  if (loading)
    return (
      <div className="container-site py-20">
        <LoadingBlock rows={6} />
      </div>
    )
  if (error?.status === 404) return <NotFound message={t('product.notFound')} />
  if (error || !p)
    return (
      <div className="container-site py-20">
        <ErrorState message={error?.message} onRetry={reload} />
      </div>
    )

  const fam = familyByKey(p.family)
  const isService = p.family === 'implementation_services' || p.pricing.model === 'quote'

  const checkout = async () => {
    setBusy(true)
    try {
      const r = await api<{ publicId: string; status: string; checkoutUrl: string | null }>('/account/checkout', { method: 'POST', body: { productIds: [p.id], acceptTerms: true } })
      if (r.data.checkoutUrl && /^https:\/\//.test(r.data.checkoutUrl)) {
        window.location.assign(r.data.checkoutUrl)
        return
      }
      toast.push('success', `${r.data.publicId} — ${t(`order.${r.data.status}` as 'order.completed')}`)
      navigate(r.data.status === 'completed' ? '/account/library' : `/account/orders/${r.data.publicId}`)
    } catch (e) {
      toast.push('error', errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const purchasePanel = (
    <div className="flex flex-col gap-5 rounded-sm bg-white p-6 hairline">
      <div className="flex items-baseline justify-between gap-4">
        <PriceLabel p={p} className="font-display text-3xl text-forest-950" />
        <span className="text-xs text-stone-500">{p.pricing.model === 'one_time' ? t('pricing.one_time') : ''}</span>
      </div>
      {p.isDemo ? (
        <Notice tone="warning" title={t('badge.demo')}>
          {t('badge.demoLong')}
        </Notice>
      ) : isService ? (
        <ButtonLink to={`/contact?type=system_implementation&product=${p.slug}`} size="lg">
          {t('product.inquire')}
        </ButtonLink>
      ) : p.purchasable ? (
        session.signedIn ? (
          <>
            <Checkbox checked={accept} onChange={(e) => setAccept(e.target.checked)} label={t('product.acceptTerms')} />
            <Button size="lg" disabled={!accept} loading={busy} onClick={checkout}>
              {p.pricing.model === 'free' ? t('product.claimFree') : t('product.buy')}
            </Button>
            <p className="text-xs leading-relaxed text-stone-600">{t('product.checkoutNote')}</p>
          </>
        ) : session.authAvailable ? (
          <ButtonLink to={`/sign-in?redirect_url=${encodeURIComponent(`/products/${p.slug}`)}`} size="lg">
            {t('product.signInToBuy')}
          </ButtonLink>
        ) : (
          <Notice>{t('auth.notConfigured')}</Notice>
        )
      ) : (
        <Notice title={t('product.notPurchasable')}>{t('product.notPurchasableBody')}</Notice>
      )}
      {!isService && (
        <ButtonLink to={`/contact?type=product_question&product=${p.slug}`} variant="secondary">
          {t('product.ask')}
        </ButtonLink>
      )}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-4 border-t border-ink/10 pt-5 text-sm">
        <div>
          <dt className="text-xs text-stone-500">{t('product.version')}</dt>
          <dd className="font-medium tabular-nums text-forest-950">{p.version ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-stone-500">{t('product.updated')}</dt>
          <dd className="font-medium text-forest-950">{formatDate(p.updatedAt, locale)}</dd>
        </div>
        <div>
          <dt className="text-xs text-stone-500">{t('product.formats')}</dt>
          <dd className="font-medium text-forest-950">{p.formats || '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-stone-500">{t('product.license')}</dt>
          <dd className="font-medium text-forest-950">{p.license ? L(p.license.name) : '—'}</dd>
        </div>
      </dl>
    </div>
  )

  return (
    <>
      {p.isDemo && (
        <div className="bg-brass-300/40 text-center text-xs font-semibold uppercase tracking-[0.14em] text-brass-700">
          <p className="container-site py-2.5">{t('badge.demoLong')}</p>
        </div>
      )}
      <article>
        <header className="border-b border-ink/10 bg-ivory-100">
          <div className="container-site grid gap-10 pb-12 pt-10 lg:grid-cols-12 lg:pb-16 lg:pt-14">
            <div className="flex flex-col gap-6 lg:col-span-7">
              <nav aria-label="Breadcrumb" className="text-xs text-stone-600">
                <ol className="flex flex-wrap items-center gap-2">
                  <li>
                    <Link to="/catalog" className="hover:text-forest-900">
                      {t('catalog.title')}
                    </Link>
                  </li>
                  <li aria-hidden="true">/</li>
                  <li>
                    <Link to={`/catalog/${fam?.slug}`} className="hover:text-forest-900">
                      {fam ? L(fam.name) : p.family}
                    </Link>
                  </li>
                  {p.category && (
                    <>
                      <li aria-hidden="true">/</li>
                      <li>
                        <Link to={`/catalog/${fam?.slug}?category=${p.category.slug}`} className="hover:text-forest-900">
                          {L(p.category.name)}
                        </Link>
                      </li>
                    </>
                  )}
                </ol>
              </nav>
              <div className="flex flex-wrap gap-1.5">
                {p.isDemo && <Badge tone="brass">{t('badge.demo')}</Badge>}
                <MaturityBadge maturity={p.maturity} />
              </div>
              <h1 className="text-balance text-display-lg font-light text-forest-950">{L(p.title)}</h1>
              <p className="max-w-2xl text-lg leading-relaxed text-stone-600">{L(p.summary)}</p>
            </div>
            <div className="lg:col-span-5 lg:pt-8">
              <div className="lg:hidden">{purchasePanel}</div>
            </div>
          </div>
        </header>

        <div className="container-site grid gap-12 py-12 lg:grid-cols-12 lg:py-16">
          <div className="flex flex-col gap-12 lg:col-span-7">
            {L(p.description) && <Markdown source={L(p.description)} />}
            {L(p.audience) && (
              <section className="flex flex-col gap-3 border-t border-forest-900 pt-5">
                <h2 className="font-display text-xl text-forest-950">{t('product.audience')}</h2>
                <p className="text-[0.9375rem] leading-relaxed text-ink/85">{L(p.audience)}</p>
              </section>
            )}
            <div className="grid gap-10 md:grid-cols-2">
              <ListBlock title={t('product.included')} items={L(p.includes) ?? []} empty={t('product.none')} icon="check" />
              <ListBlock title={t('product.excluded')} items={L(p.excludes) ?? []} empty={t('product.none')} icon="close" />
            </div>
            <ListBlock title={t('product.requirements')} items={L(p.requirements) ?? []} empty={t('product.none')} icon="arrowRight" />
            {L(p.preview) && (
              <section className="flex flex-col gap-3 border-t border-forest-900 pt-5">
                <h2 className="font-display text-xl text-forest-950">{t('product.preview')}</h2>
                <div className="rounded-sm bg-ivory-100 p-5 hairline">
                  <Markdown source={L(p.preview)} className="prose-orsaven text-[0.9375rem]" />
                </div>
              </section>
            )}
            <div className="grid gap-10 md:grid-cols-2">
              <section className="flex flex-col gap-3 border-t border-forest-900 pt-5">
                <h2 className="font-display text-xl text-forest-950">{t('product.delivery')}</h2>
                <p className="text-[0.9375rem] leading-relaxed text-ink/85">{L(p.delivery) || t('product.none')}</p>
                {p.deliverables.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-2">
                    {p.deliverables.map((d, i) => (
                      <li key={i} className="flex items-center gap-3 text-sm text-ink/80">
                        <Icon name="file" className="size-4 text-sage-500" />
                        <span className="flex-1">{d.label}</span>
                        <span className="tabular-nums text-xs text-stone-500">{formatBytes(d.sizeBytes)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <section className="flex flex-col gap-3 border-t border-forest-900 pt-5">
                <h2 className="font-display text-xl text-forest-950">{t('product.support')}</h2>
                <p className="text-[0.9375rem] leading-relaxed text-ink/85">{L(p.support) || t('product.none')}</p>
              </section>
            </div>
            {p.license && (
              <section className="flex flex-col gap-3 border-t border-forest-900 pt-5">
                <h2 className="font-display text-xl text-forest-950">
                  {t('product.license')}: {L(p.license.name)}
                </h2>
                <p className="text-[0.9375rem] leading-relaxed text-ink/85">{L(p.license.summary)}</p>
                {p.license.status !== 'approved' && <Notice tone="warning">{t('product.licenseDraft')}</Notice>}
              </section>
            )}
          </div>
          <aside className="hidden lg:col-span-5 lg:block" aria-label={t('product.buy')}>
            <div className="sticky top-28">{purchasePanel}</div>
          </aside>
        </div>
      </article>

      {p.related.length > 0 && (
        <section className="border-t border-ink/10 bg-ivory-100" aria-labelledby="related-title">
          <div className="container-site py-16">
            <h2 id="related-title" className="text-display-sm text-forest-950">
              {t('product.related')}
            </h2>
            <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {p.related.map((r) => (
                <li key={r.id}>
                  <ProductCard p={r} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </>
  )
}
