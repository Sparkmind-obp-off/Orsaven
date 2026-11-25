import { Link } from 'react-router'
import { FAMILIES } from '../../../shared/domain'
import { useI18n } from '../../i18n'
import { useApi } from '../../lib/api'
import { ButtonLink, Icon, SectionHeading } from '../../components/ui'
import { ProductCard, ProductCardSkeleton, type PublicProduct } from '../../components/catalog'
import { FAQ } from '../../content'
import { useDocumentTitle } from '../../lib/useDocumentTitle'

export default function Home() {
  const { t, L } = useI18n()
  useDocumentTitle(null)
  const featured = useApi<PublicProduct[]>('/catalog/products?sort=featured&pageSize=3')
  const families = useApi<{ key: string; productCount: number }[]>('/catalog/families')

  return (
    <>
      {/* ───────── Hero ───────── */}
      <section id="hero-section" aria-labelledby="hero-title" className="dark-surface grain relative -mt-16 overflow-hidden bg-forest-950 pt-16 text-ivory-50 lg:-mt-[4.5rem] lg:pt-[4.5rem]">
        <div className="container-site grid gap-12 pb-16 pt-16 md:pb-24 md:pt-24 lg:grid-cols-12 lg:gap-8 lg:pb-28 lg:pt-28">
          <div className="animate-fade-up flex flex-col gap-7 lg:col-span-8">
            <p className="eyebrow">{t('hero.eyebrow')}</p>
            <h1 id="hero-title" className="text-balance text-display-xl font-light text-ivory-50" style={{ fontVariationSettings: "'opsz' 144, 'SOFT' 50" }}>
              {t('hero.title')}
            </h1>
            <p className="max-w-xl text-pretty text-lg leading-relaxed text-ivory-100/75">{t('hero.subtitle')}</p>
            <div className="flex flex-wrap gap-3 pt-2">
              <ButtonLink to="/catalog" variant="inverse" size="lg">
                {t('hero.ctaPrimary')}
                <Icon name="arrowRight" />
              </ButtonLink>
              <ButtonLink to="/contact?type=system_implementation" variant="ghost" size="lg" className="text-ivory-50 shadow-[inset_0_0_0_1px_rgb(251_248_241/0.3)] hover:bg-ivory-50/10">
                {t('hero.ctaSecondary')}
              </ButtonLink>
            </div>
          </div>
          <aside className="flex flex-col justify-end lg:col-span-4" aria-label={t('nav.families')}>
            <ol className="flex flex-col border-t border-ivory-50/15">
              {FAMILIES.map((f, i) => (
                <li key={f.key} className="border-b border-ivory-50/15">
                  <Link to={`/catalog/${f.slug}`} className="group flex items-baseline justify-between gap-4 py-4">
                    <span className="flex items-baseline gap-4">
                      <span className="font-display text-sm tabular-nums text-brass-400">0{i + 1}</span>
                      <span className="font-display text-xl text-ivory-50 transition-colors group-hover:text-brass-300">{L(f.name)}</span>
                    </span>
                    <Icon name="arrowRight" className="size-4 text-ivory-100/40 transition-all group-hover:translate-x-1 group-hover:text-brass-300" />
                  </Link>
                </li>
              ))}
            </ol>
            <p className="mt-6 font-display text-base italic text-ivory-100/60">{t('hero.promise')}</p>
          </aside>
        </div>
      </section>

      {/* ───────── Positioning ───────── */}
      <section id="positioning-section" aria-labelledby="positioning-title" className="container-site grid gap-10 py-20 md:grid-cols-12 lg:py-28">
        <p className="eyebrow md:col-span-3">{t('home.positioning.eyebrow')}</p>
        <div className="flex flex-col gap-6 md:col-span-9">
          <h2 id="positioning-title" className="text-balance text-display-lg font-light text-forest-950">
            {t('home.positioning.title')}
          </h2>
          <p className="max-w-2xl text-lg leading-relaxed text-stone-600">{t('home.positioning.body')}</p>
        </div>
      </section>

      {/* ───────── Families ───────── */}
      <section id="families-section" aria-labelledby="families-title" className="border-y border-ink/10 bg-ivory-100">
        <div className="container-site py-20 lg:py-24">
          <SectionHeading eyebrow={t('home.families.eyebrow')} title={<span id="families-title">{t('home.families.title')}</span>} />
          <div className="mt-12 grid gap-px overflow-hidden rounded-sm bg-ink/10 hairline sm:grid-cols-2">
            {FAMILIES.map((f, i) => {
              const count = families.data?.find((x) => x.key === f.key)?.productCount
              return (
                <Link key={f.key} to={`/catalog/${f.slug}`} className="group flex min-h-64 flex-col gap-5 bg-ivory-50 p-7 transition-colors hover:bg-white lg:p-9">
                  <div className="flex items-center justify-between">
                    <span className="font-display text-sm tabular-nums text-brass-500">0{i + 1}</span>
                    {count !== undefined && <span className="text-xs tabular-nums text-stone-500">{count === 1 ? t('catalog.result') : t('catalog.results', { n: count })}</span>}
                  </div>
                  <h3 className="font-display text-display-sm text-forest-950">{L(f.name)}</h3>
                  <p className="max-w-md text-sm leading-relaxed text-stone-600">{L(f.tagline)}</p>
                  <span className="mt-auto inline-flex items-center gap-2 text-sm font-medium text-forest-800">
                    <span className="link-underline">{t('common.viewAll')}</span>
                    <Icon name="arrowRight" className="size-3.5 transition-transform group-hover:translate-x-1" />
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      {/* ───────── Featured ───────── */}
      <section id="featured-section" aria-labelledby="featured-title" className="container-site py-20 lg:py-24">
        <SectionHeading
          eyebrow={t('home.featured.eyebrow')}
          title={<span id="featured-title">{t('home.featured.title')}</span>}
          action={
            <ButtonLink to="/catalog" variant="secondary">
              {t('hero.ctaPrimary')}
              <Icon name="arrowRight" className="size-3.5" />
            </ButtonLink>
          }
        />
        <div className="mt-10">
          {featured.loading ? (
            <div className="grid gap-5 md:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          ) : featured.data && featured.data.length > 0 ? (
            <div className="grid gap-5 md:grid-cols-3">
              {featured.data.map((p, i) => (
                <ProductCard key={p.id} p={p} index={i} variant={i === 0 ? 'feature' : 'default'} />
              ))}
            </div>
          ) : (
            <p className="max-w-xl border-t border-ink/10 pt-6 text-sm leading-relaxed text-stone-600">{t('home.featured.empty')}</p>
          )}
        </div>
      </section>

      {/* ───────── How it works ───────── */}
      <section id="how-section" aria-labelledby="how-title" className="dark-surface bg-forest-900 text-ivory-50">
        <div className="container-site py-20 lg:py-28">
          <div className="grid gap-10 lg:grid-cols-12">
            <div className="flex flex-col gap-4 lg:col-span-4">
              <p className="eyebrow">{t('home.how.eyebrow')}</p>
              <h2 id="how-title" className="text-balance text-display-md font-light">
                {t('home.how.title')}
              </h2>
            </div>
            <ol className="grid gap-px bg-ivory-50/10 sm:grid-cols-2 lg:col-span-8">
              {(['s1', 's2', 's3', 's4'] as const).map((s, i) => (
                <li key={s} className="flex flex-col gap-3 bg-forest-900 p-6 lg:p-8">
                  <span className="font-display text-3xl font-light text-brass-400">{String(i + 1).padStart(2, '0')}</span>
                  <h3 className="font-display text-xl">{t(`home.how.${s}.title`)}</h3>
                  <p className="text-sm leading-relaxed text-ivory-100/70">{t(`home.how.${s}.body`)}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ───────── Principles ───────── */}
      <section id="principles-section" aria-labelledby="principles-title" className="container-site py-20 lg:py-28">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="flex flex-col gap-4 lg:col-span-5">
            <p className="eyebrow">{t('home.principles.eyebrow')}</p>
            <h2 id="principles-title" className="text-balance text-display-md text-forest-950">
              {t('home.principles.title')}
            </h2>
          </div>
          <dl className="grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:col-span-7">
            {(['p1', 'p2', 'p3', 'p4'] as const).map((p) => (
              <div key={p} className="flex flex-col gap-2 border-t border-forest-900 pt-5">
                <dt className="font-display text-lg text-forest-950">{t(`home.${p}.title`)}</dt>
                <dd className="text-sm leading-relaxed text-stone-600">{t(`home.${p}.body`)}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ───────── Implementation services ───────── */}
      <section id="services-section" aria-labelledby="services-title" className="container-site pb-20 lg:pb-28">
        <div className="grid overflow-hidden rounded-sm bg-ivory-100 hairline md:grid-cols-12">
          <div className="flex flex-col gap-5 p-8 md:col-span-7 lg:p-12">
            <p className="eyebrow">{t('home.services.eyebrow')}</p>
            <h2 id="services-title" className="text-balance text-display-md text-forest-950">
              {t('home.services.title')}
            </h2>
            <p className="max-w-xl leading-relaxed text-stone-600">{t('home.services.body')}</p>
            <div className="flex flex-wrap gap-3 pt-2">
              <ButtonLink to="/contact?type=system_implementation">{t('home.services.cta')}</ButtonLink>
              <ButtonLink to="/catalog/implementation-services" variant="secondary">
                {t('common.viewAll')}
              </ButtonLink>
            </div>
          </div>
          <ul className="flex flex-col justify-center gap-0 border-t border-ink/10 p-8 md:col-span-5 md:border-l md:border-t-0 lg:p-12">
            {(['system_implementation', 'workflow_configuration', 'technical_setup', 'integration', 'customization', 'deployment_assistance'] as const).map((s) => (
              <li key={s} className="flex items-center justify-between border-b border-ink/10 py-3 text-sm text-forest-950 last:border-0">
                {t(`service.${s}`)}
                <Icon name="check" className="size-4 text-sage-500" />
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ───────── FAQ ───────── */}
      <section id="faq-section" aria-labelledby="faq-title" className="border-t border-ink/10">
        <div className="container-site grid gap-10 py-20 lg:grid-cols-12 lg:py-24">
          <div className="flex flex-col gap-4 lg:col-span-4">
            <p className="eyebrow">FAQ</p>
            <h2 id="faq-title" className="text-display-md text-forest-950">
              {t('home.faq.title')}
            </h2>
            <Link to="/faq" className="link-underline mt-2 w-fit text-sm font-medium text-forest-800">
              {t('home.faq.more')} →
            </Link>
          </div>
          <div className="lg:col-span-8">
            <FaqList items={FAQ.slice(0, 4)} />
          </div>
        </div>
      </section>

      {/* ───────── CTA ───────── */}
      <section id="cta-section" aria-labelledby="cta-title" className="dark-surface grain bg-forest-950 text-ivory-50">
        <div className="container-site flex flex-col items-start gap-8 py-20 md:flex-row md:items-end md:justify-between lg:py-24">
          <div className="flex max-w-2xl flex-col gap-4">
            <h2 id="cta-title" className="text-balance text-display-lg font-light">
              {t('home.cta.title')}
            </h2>
            <p className="text-ivory-100/70">{t('home.cta.body')}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <ButtonLink to="/catalog" variant="inverse" size="lg">
              {t('hero.ctaPrimary')}
            </ButtonLink>
            <ButtonLink to="/contact" variant="ghost" size="lg" className="text-ivory-50 shadow-[inset_0_0_0_1px_rgb(251_248_241/0.3)] hover:bg-ivory-50/10">
              {t('nav.contact')}
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  )
}

export function FaqList({ items }: { items: typeof FAQ }) {
  const { L } = useI18n()
  return (
    <div className="border-t border-ink/15">
      {items.map((f, i) => (
        <details key={i} className="group border-b border-ink/15 [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-left font-display text-lg text-forest-950 hover:text-forest-700">
            {L(f.q)}
            <span className="grid size-7 shrink-0 place-items-center rounded-full shadow-[inset_0_0_0_1px_rgb(19_34_27/0.2)] transition-transform duration-300 group-open:rotate-45">
              <Icon name="plus" className="size-3.5" />
            </span>
          </summary>
          <p className="max-w-2xl pb-6 pr-12 text-[0.9375rem] leading-relaxed text-stone-600">{L(f.a)}</p>
        </details>
      ))}
    </div>
  )
}
