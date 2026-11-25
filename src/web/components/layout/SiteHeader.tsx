import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router'
import { FAMILIES } from '../../../shared/domain'
import { useI18n } from '../../i18n'
import { useSession } from '../../lib/session'
import { cn } from '../../lib/cn'
import { Button, ButtonLink, Dropdown, Icon, menuItemClass } from '../ui'
import { Wordmark } from './Brand'

function LocaleSwitch({ className }: { className?: string }) {
  const { locale, setLocale, t } = useI18n()
  return (
    <div role="group" aria-label={t('nav.language')} className={cn('flex items-center text-xs font-semibold tracking-[0.12em]', className)}>
      {(['id', 'en'] as const).map((l, i) => (
        <span key={l} className="flex items-center">
          {i > 0 && <span className="mx-1.5 h-3 w-px bg-current opacity-25" aria-hidden="true" />}
          <button type="button" onClick={() => setLocale(l)} aria-pressed={locale === l} className={cn('uppercase transition-opacity', locale === l ? 'opacity-100' : 'opacity-45 hover:opacity-80')}>
            {l}
          </button>
        </span>
      ))}
    </div>
  )
}

function AccountMenu() {
  const { t } = useI18n()
  const { authAvailable, loaded, signedIn, me, signOut, can } = useSession()
  if (!authAvailable) return null
  if (!loaded) return <span className="skeleton h-8 w-20 rounded-sm" aria-hidden="true" />
  if (!signedIn)
    return (
      <div className="flex items-center gap-1">
        <ButtonLink to="/sign-in" variant="ghost" size="sm">
          {t('nav.signIn')}
        </ButtonLink>
        <ButtonLink to="/sign-up" variant="primary" size="sm" className="hidden sm:inline-flex">
          {t('nav.signUp')}
        </ButtonLink>
      </div>
    )
  const name = me?.profile.displayName || me?.email || t('nav.account')
  return (
    <Dropdown
      label={t('nav.account')}
      trigger={({ open, toggle, id }) => (
        <button type="button" onClick={toggle} aria-expanded={open} aria-haspopup="menu" aria-controls={open ? id : undefined} className="flex h-9 items-center gap-2 rounded-sm px-2.5 text-sm font-medium text-forest-950 hover:bg-ink/5">
          <span className="grid size-6 place-items-center rounded-full bg-forest-900 text-[0.65rem] font-semibold uppercase text-ivory-50">{name.slice(0, 1)}</span>
          <span className="hidden max-w-36 truncate md:inline">{name}</span>
          <Icon name="chevronDown" className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
        </button>
      )}
    >
      {(close) => (
        <>
          <div className="border-b border-ink/10 px-3 pb-2 pt-1.5">
            <p className="truncate text-xs text-stone-600">{me?.email}</p>
          </div>
          <div className="py-1">
            <Link role="menuitem" to="/account" className={menuItemClass} onClick={close}>
              {t('nav.account')}
            </Link>
            <Link role="menuitem" to="/account/library" className={menuItemClass} onClick={close}>
              {t('account.library')}
            </Link>
            <Link role="menuitem" to="/account/orders" className={menuItemClass} onClick={close}>
              {t('account.orders')}
            </Link>
            {can('admin.access') && (
              <Link role="menuitem" to="/admin" className={menuItemClass} onClick={close}>
                {t('nav.admin')}
              </Link>
            )}
          </div>
          <div className="border-t border-ink/10 pt-1">
            <button
              role="menuitem"
              type="button"
              className={menuItemClass}
              onClick={() => {
                close()
                void signOut()
              }}
            >
              {t('nav.signOut')}
            </button>
          </div>
        </>
      )}
    </Dropdown>
  )
}

export function SiteHeader({ overlay = false }: { overlay?: boolean }) {
  const { t, L } = useI18n()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const location = useLocation()
  useEffect(() => setMobileOpen(false), [location.pathname])
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  const dark = overlay && !scrolled && !mobileOpen
  const navLink = ({ isActive }: { isActive: boolean }) => cn('link-underline py-1 text-[0.875rem] transition-colors', isActive ? 'font-semibold' : 'opacity-80 hover:opacity-100')

  return (
    <header className={cn('sticky top-0 z-40 transition-[background-color,box-shadow] duration-300', dark ? 'dark-surface bg-transparent text-ivory-50' : 'bg-ivory-50/92 text-forest-950 shadow-[0_1px_0_rgb(22_26_24/0.08)] backdrop-blur-md')}>
      <div className="container-site flex h-16 items-center justify-between gap-6 lg:h-[4.5rem]">
        <Link to="/" aria-label="ORSAVEN — home" className="shrink-0">
          <Wordmark tone={dark ? 'light' : 'dark'} />
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-7 lg:flex">
          <Dropdown
            label={t('nav.families')}
            align="left"
            trigger={({ open, toggle, id }) => (
              <button type="button" onClick={toggle} aria-expanded={open} aria-haspopup="menu" aria-controls={open ? id : undefined} className="flex items-center gap-1 py-1 text-[0.875rem] opacity-80 hover:opacity-100">
                {t('nav.catalog')}
                <Icon name="chevronDown" className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
              </button>
            )}
          >
            {(close) => (
              <div className="w-[22rem] p-1 text-ink">
                {FAMILIES.map((f, i) => (
                  <Link key={f.key} role="menuitem" to={`/catalog/${f.slug}`} onClick={close} className="group flex gap-4 rounded-xs px-3 py-3 hover:bg-ink/[0.04] focus:bg-ink/[0.04] focus:outline-none">
                    <span className="font-display text-sm tabular-nums text-brass-500">0{i + 1}</span>
                    <span className="flex flex-col gap-0.5">
                      <span className="text-sm font-semibold text-forest-950">{L(f.name)}</span>
                      <span className="text-xs leading-snug text-stone-600">{L(f.tagline)}</span>
                    </span>
                  </Link>
                ))}
                <div className="mt-1 border-t border-ink/10 pt-1">
                  <Link role="menuitem" to="/catalog" onClick={close} className={cn(menuItemClass, 'justify-between font-medium')}>
                    {t('nav.allProducts')}
                    <Icon name="arrowRight" className="size-3.5" />
                  </Link>
                </div>
              </div>
            )}
          </Dropdown>
          <NavLink to="/catalog/implementation-services" className={navLink}>
            {t('nav.services')}
          </NavLink>
          <NavLink to="/how-it-works" className={navLink}>
            {t('nav.how')}
          </NavLink>
          <NavLink to="/about" className={navLink}>
            {t('nav.about')}
          </NavLink>
          <NavLink to="/contact" className={navLink}>
            {t('nav.contact')}
          </NavLink>
        </nav>
        <div className="flex items-center gap-3">
          <LocaleSwitch className="hidden sm:flex" />
          <AccountMenu />
          <button type="button" className="-mr-2 grid size-10 place-items-center rounded-sm lg:hidden" aria-expanded={mobileOpen} aria-controls="mobile-nav" aria-label={mobileOpen ? t('nav.close') : t('nav.menu')} onClick={() => setMobileOpen((o) => !o)}>
            <Icon name={mobileOpen ? 'close' : 'menu'} className="size-5" />
          </button>
        </div>
      </div>
      {mobileOpen && (
        <div id="mobile-nav" className="animate-fade-up fixed inset-x-0 bottom-0 top-16 z-40 overflow-y-auto bg-ivory-50 text-forest-950 lg:hidden">
          <nav aria-label="Mobile" className="container-site flex flex-col py-6">
            <p className="eyebrow mb-3">{t('nav.families')}</p>
            {FAMILIES.map((f, i) => (
              <Link key={f.key} to={`/catalog/${f.slug}`} className="flex items-baseline gap-4 border-b border-ink/10 py-4">
                <span className="font-display text-sm text-brass-500">0{i + 1}</span>
                <span className="font-display text-2xl">{L(f.name)}</span>
              </Link>
            ))}
            <div className="mt-6 flex flex-col">
              {[
                ['/catalog', t('nav.allProducts')],
                ['/how-it-works', t('nav.how')],
                ['/about', t('nav.about')],
                ['/faq', t('nav.faq')],
                ['/contact', t('nav.contact')],
              ].map(([to, label]) => (
                <Link key={to} to={to} className="py-3 text-base">
                  {label}
                </Link>
              ))}
            </div>
            <div className="mt-6 flex items-center justify-between border-t border-ink/10 pt-6">
              <LocaleSwitch />
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}

export function SignOutButton() {
  const { t } = useI18n()
  const { signOut } = useSession()
  return (
    <Button variant="ghost" size="sm" onClick={() => void signOut()}>
      {t('nav.signOut')}
    </Button>
  )
}
