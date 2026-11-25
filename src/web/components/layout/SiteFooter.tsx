import { Link } from 'react-router'
import { FAMILIES } from '../../../shared/domain'
import { useI18n } from '../../i18n'
import { Wordmark } from './Brand'

export function SiteFooter() {
  const { t, L, locale } = useI18n()
  const legal = [
    ['/legal/privacy', locale === 'id' ? 'Kebijakan Privasi' : 'Privacy Policy'],
    ['/legal/terms', locale === 'id' ? 'Ketentuan Layanan' : 'Terms of Service'],
    ['/legal/refund', locale === 'id' ? 'Pengembalian Dana' : 'Refund Policy'],
    ['/legal/delivery', locale === 'id' ? 'Pengiriman' : 'Delivery Policy'],
  ]
  return (
    <footer className="dark-surface grain relative bg-forest-950 text-ivory-100">
      <div className="container-site grid gap-12 pb-10 pt-16 md:grid-cols-12 lg:pt-20">
        <div className="flex flex-col gap-5 md:col-span-5">
          <Wordmark tone="light" />
          <p className="max-w-sm font-display text-2xl leading-snug text-ivory-50">{t('footer.tagline')}</p>
          <p className="max-w-sm text-sm leading-relaxed text-ivory-100/60">{t('footer.independent')}</p>
        </div>
        <nav aria-label={t('footer.catalog')} className="flex flex-col gap-3 md:col-span-3">
          <p className="eyebrow">{t('footer.catalog')}</p>
          {FAMILIES.map((f) => (
            <Link key={f.key} to={`/catalog/${f.slug}`} className="link-underline w-fit text-sm text-ivory-100/80 hover:text-ivory-50">
              {L(f.name)}
            </Link>
          ))}
        </nav>
        <nav aria-label={t('footer.company')} className="flex flex-col gap-3 md:col-span-2">
          <p className="eyebrow">{t('footer.company')}</p>
          {[
            ['/about', t('nav.about')],
            ['/how-it-works', t('nav.how')],
            ['/faq', t('nav.faq')],
            ['/contact', t('nav.contact')],
          ].map(([to, label]) => (
            <Link key={to} to={to} className="link-underline w-fit text-sm text-ivory-100/80 hover:text-ivory-50">
              {label}
            </Link>
          ))}
        </nav>
        <nav aria-label={t('footer.legal')} className="flex flex-col gap-3 md:col-span-2">
          <p className="eyebrow">{t('footer.legal')}</p>
          {legal.map(([to, label]) => (
            <Link key={to} to={to} className="link-underline w-fit text-sm text-ivory-100/80 hover:text-ivory-50">
              {label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="container-site flex flex-col gap-2 border-t border-ivory-50/10 py-6 text-xs text-ivory-100/50 sm:flex-row sm:justify-between">
        <span>{t('footer.rights', { year: new Date().getFullYear() })}</span>
        <span>orsaven.biz.id</span>
      </div>
    </footer>
  )
}
