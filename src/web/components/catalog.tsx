import { Link } from 'react-router'
import { familyByKey, formatIDR } from '../../shared/domain'
import { useI18n, type Bilingual } from '../i18n'
import { cn } from '../lib/cn'
import { Badge, Icon } from './ui'

export interface PublicProduct {
  id: number
  slug: string
  family: string
  category: { slug: string; name: Bilingual } | null
  title: Bilingual
  summary: Bilingual
  description: Bilingual
  audience: Bilingual
  includes: Bilingual<string[]>
  excludes: Bilingual<string[]>
  requirements: Bilingual<string[]>
  delivery: Bilingual
  support: Bilingual
  preview: Bilingual
  formats: string
  pricing: { model: 'one_time' | 'free' | 'quote'; priceIdr: number | null; currency: string }
  license: { key: string; name: Bilingual; summary: Bilingual; status: string } | null
  version: string | null
  versionReleasedAt: string | null
  maturity: string
  status: string
  isDemo: boolean
  isFeatured: boolean
  purchasable: boolean
  updatedAt: string
}

export function PriceLabel({ p, className }: { p: PublicProduct; className?: string }) {
  const { t, locale } = useI18n()
  const text = p.pricing.model === 'one_time' ? formatIDR(p.pricing.priceIdr, locale) : t(`pricing.${p.pricing.model}`)
  return <span className={cn('tabular-nums', className)}>{text}</span>
}

export function MaturityBadge({ maturity }: { maturity: string }) {
  const { t } = useI18n()
  const tone = maturity === 'available' ? 'success' : maturity === 'beta' ? 'sage' : maturity === 'retired' ? 'neutral' : 'brass'
  return <Badge tone={tone}>{t(`maturity.${maturity}` as 'maturity.beta')}</Badge>
}

/** Editorial product card — typographic, no fake imagery. */
export function ProductCard({ p, index, variant = 'default' }: { p: PublicProduct; index?: number; variant?: 'default' | 'feature' }) {
  const { t, L } = useI18n()
  const fam = familyByKey(p.family)
  return (
    <article className={cn('group relative flex h-full flex-col rounded-sm bg-white transition-shadow duration-300 hairline hover:shadow-(--shadow-lift)', variant === 'feature' && 'md:min-h-[22rem]')}>
      <div className="flex items-center justify-between gap-3 border-b border-ink/[0.07] px-5 py-3.5">
        <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-sage-600">{fam ? L(fam.name) : p.family}</span>
        {index !== undefined && <span className="font-display text-sm tabular-nums text-brass-500">{String(index + 1).padStart(2, '0')}</span>}
      </div>
      <div className="flex flex-1 flex-col gap-3 px-5 pb-5 pt-5">
        <div className="flex flex-wrap gap-1.5">
          {p.isDemo && <Badge tone="brass">{t('badge.demo')}</Badge>}
          <MaturityBadge maturity={p.maturity} />
          {p.category && <Badge tone="neutral">{L(p.category.name)}</Badge>}
        </div>
        <h3 className={cn('text-balance font-display text-forest-950', variant === 'feature' ? 'text-display-sm' : 'text-xl leading-snug')}>
          <Link to={`/products/${p.slug}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
            {L(p.title)}
          </Link>
        </h3>
        <p className="line-clamp-3 text-sm leading-relaxed text-stone-600">{L(p.summary)}</p>
        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
          <div className="flex flex-col">
            <PriceLabel p={p} className="text-[0.9375rem] font-semibold text-forest-950" />
            {p.formats && <span className="text-xs text-stone-500">{p.formats}</span>}
          </div>
          <span className="grid size-9 place-items-center rounded-full text-forest-900 shadow-[inset_0_0_0_1px_rgb(19_34_27/0.2)] transition-all duration-300 group-hover:bg-forest-900 group-hover:text-ivory-50">
            <Icon name="arrowRight" className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
      {/* Focus ring for the stretched link */}
      <span className="pointer-events-none absolute inset-0 rounded-sm group-has-[a:focus-visible]:outline-2 group-has-[a:focus-visible]:outline-offset-2 group-has-[a:focus-visible]:outline-brass-500" aria-hidden="true" />
    </article>
  )
}

export function ProductCardSkeleton() {
  return (
    <div className="flex h-72 flex-col gap-3 rounded-sm bg-white p-5 hairline" aria-hidden="true">
      <div className="skeleton h-3 w-24 rounded-xs" />
      <div className="skeleton mt-4 h-6 w-3/4 rounded-xs" />
      <div className="skeleton h-3 w-full rounded-xs" />
      <div className="skeleton h-3 w-5/6 rounded-xs" />
      <div className="skeleton mt-auto h-4 w-20 rounded-xs" />
    </div>
  )
}
