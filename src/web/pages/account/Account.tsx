import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useNavigate, useParams } from 'react-router'
import { useI18n, type Bilingual } from '../../i18n'
import { api, errorMessage, useApi } from '../../lib/api'
import { cn, formatBytes, formatDate } from '../../lib/cn'
import { useSession } from '../../lib/session'
import { formatIDR } from '../../../shared/domain'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import { Badge, Button, ButtonLink, ConfirmDialog, EmptyState, ErrorState, Field, Icon, Input, LoadingBlock, Notice, PageHeader, Select, StatusBadge, Table, td, th, useToast } from '../../components/ui'

/* ───────────── Layout ───────────── */

export function AccountLayout() {
  const { t } = useI18n()
  const links: [string, string][] = [
    ['/account', t('account.overview')],
    ['/account/orders', t('account.orders')],
    ['/account/library', t('account.library')],
    ['/account/downloads', t('account.downloads')],
    ['/account/inquiries', t('account.inquiries')],
    ['/account/settings', t('account.settings')],
  ]
  return (
    <div className="container-site grid gap-10 py-10 lg:grid-cols-12 lg:py-14">
      <aside className="lg:col-span-3">
        <nav aria-label={t('account.title')} className="flex gap-1 overflow-x-auto border-b border-ink/10 pb-2 lg:sticky lg:top-28 lg:flex-col lg:border-b-0 lg:pb-0">
          <p className="eyebrow mb-3 hidden lg:block">{t('account.title')}</p>
          {links.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === '/account'} className={({ isActive }) => cn('whitespace-nowrap rounded-xs px-3 py-2 text-sm transition-colors', isActive ? 'bg-forest-900 font-medium text-ivory-50' : 'text-forest-950 hover:bg-ink/5')}>
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 lg:col-span-9">
        <Outlet />
      </div>
    </div>
  )
}

/* ───────────── Types ───────────── */

interface OrderSummary {
  publicId: string
  status: string
  totalIdr: number
  itemCount: number
  createdAt: string
  completedAt: string | null
}
interface OrderDetailT {
  publicId: string
  status: string
  totalIdr: number
  paymentProvider: string
  createdAt: string
  paidAt: string | null
  completedAt: string | null
  deliveryAvailable: boolean
  items: { id: number; slug: string; title: Bilingual; family: string; version: string | null; license: string; licenseCode: string | null; unitPriceIdr: number }[]
  payments: { provider: string; status: string; amount_idr: number; created_at: string }[]
}
interface LibraryItem {
  orderItemId: number
  orderPublicId: string
  completedAt: string
  licenseCode: string
  license: string
  product: { id: number; slug: string; title: Bilingual; family: string; version: string | null }
  assets: { id: number; label: string; filename: string; contentType: string; sizeBytes: number; version: string | null; createdAt: string }[]
}

function OrderStatus({ status }: { status: string }) {
  const { t } = useI18n()
  return <StatusBadge status={status} label={t(`order.${status}` as 'order.paid')} />
}

/* ───────────── Overview ───────────── */

export function AccountOverview() {
  const { t, locale } = useI18n()
  const { me } = useSession()
  useDocumentTitle(t('account.title'))
  const orders = useApi<OrderSummary[]>('/account/orders?pageSize=5')
  const library = useApi<LibraryItem[]>('/account/library')
  return (
    <div className="flex flex-col gap-10">
      <PageHeader title={`${t('account.welcome')}${me?.profile.displayName ? `, ${me.profile.displayName}` : ''}`} description={me?.email ?? undefined} />
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1 rounded-sm bg-white p-5 hairline">
          <span className="text-xs text-stone-600">{t('account.orders')}</span>
          <span className="font-display text-3xl tabular-nums">{orders.meta?.total ?? '—'}</span>
        </div>
        <div className="flex flex-col gap-1 rounded-sm bg-white p-5 hairline">
          <span className="text-xs text-stone-600">{t('account.library')}</span>
          <span className="font-display text-3xl tabular-nums">{library.data?.length ?? '—'}</span>
        </div>
        <div className="flex flex-col gap-1 rounded-sm bg-white p-5 hairline">
          <span className="text-xs text-stone-600">{t('account.role')}</span>
          <span className="pt-2">
            <Badge tone={me?.role === 'customer' ? 'neutral' : 'forest'}>{me?.role.replace('_', ' ')}</Badge>
          </span>
        </div>
      </div>
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl">{t('account.orders')}</h2>
          <Link to="/account/orders" className="link-underline text-sm font-medium text-forest-800">
            {t('common.viewAll')}
          </Link>
        </div>
        {orders.loading ? <LoadingBlock /> : orders.error ? <ErrorState message={orders.error.message} onRetry={orders.reload} /> : orders.data?.length ? <OrdersTable rows={orders.data} locale={locale} /> : <EmptyState title={t('account.noOrders')} action={<ButtonLink to="/catalog">{t('hero.ctaPrimary')}</ButtonLink>} />}
      </section>
    </div>
  )
}

function OrdersTable({ rows, locale }: { rows: OrderSummary[]; locale: 'id' | 'en' }) {
  const { t } = useI18n()
  return (
    <Table caption={t('account.orders')}>
      <thead>
        <tr>
          <th className={th}>ID</th>
          <th className={th}>{t('common.date')}</th>
          <th className={th}>{t('common.items')}</th>
          <th className={th}>{t('common.total')}</th>
          <th className={th}>{t('common.status')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((o) => (
          <tr key={o.publicId}>
            <td className={td}>
              <Link to={`/account/orders/${o.publicId}`} className="font-mono text-xs font-semibold text-forest-800 underline-offset-4 hover:underline">
                {o.publicId}
              </Link>
            </td>
            <td className={td}>{formatDate(o.createdAt, locale)}</td>
            <td className={cn(td, 'tabular-nums')}>{o.itemCount}</td>
            <td className={cn(td, 'tabular-nums')}>{formatIDR(o.totalIdr, locale)}</td>
            <td className={td}>
              <OrderStatus status={o.status} />
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  )
}

/* ───────────── Orders ───────────── */

export function AccountOrders() {
  const { t, locale } = useI18n()
  useDocumentTitle(t('account.orders'))
  const orders = useApi<OrderSummary[]>('/account/orders?pageSize=50')
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t('account.orders')} />
      {orders.loading ? <LoadingBlock /> : orders.error ? <ErrorState message={orders.error.message} onRetry={orders.reload} /> : orders.data?.length ? <OrdersTable rows={orders.data} locale={locale} /> : <EmptyState title={t('account.noOrders')} action={<ButtonLink to="/catalog">{t('hero.ctaPrimary')}</ButtonLink>} />}
    </div>
  )
}

export function AccountOrderDetail() {
  const { publicId } = useParams()
  const { t, L, locale } = useI18n()
  const toast = useToast()
  const o = useApi<OrderDetailT>(`/account/orders/${encodeURIComponent(publicId ?? '')}`)
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  useDocumentTitle(publicId ?? '')
  if (o.loading) return <LoadingBlock rows={6} />
  if (o.error) return <ErrorState message={errorMessage(o.error)} onRetry={o.reload} />
  const d = o.data!
  const cancel = async () => {
    setBusy(true)
    try {
      await api(`/account/orders/${d.publicId}/cancel`, { method: 'POST' })
      toast.push('success', t('order.cancelled'))
      setConfirm(false)
      o.reload()
    } catch (e) {
      toast.push('error', errorMessage(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        breadcrumb={
          <Link to="/account/orders" className="text-xs text-stone-600 hover:text-forest-900">
            ← {t('account.orders')}
          </Link>
        }
        title={<span className="font-mono text-2xl">{d.publicId}</span>}
        actions={<OrderStatus status={d.status} />}
      />
      {d.status === 'pending_payment' && <Notice tone="warning">{t('account.orderPendingNote')}</Notice>}
      <dl className="grid gap-4 sm:grid-cols-4">
        {[
          [t('common.date'), formatDate(d.createdAt, locale, true)],
          [t('order.paid'), formatDate(d.paidAt, locale, true)],
          [t('order.completed'), formatDate(d.completedAt, locale, true)],
          [t('common.total'), formatIDR(d.totalIdr, locale)],
        ].map(([k, v]) => (
          <div key={k} className="flex flex-col gap-1 border-t border-forest-900 pt-3">
            <dt className="text-xs text-stone-600">{k}</dt>
            <dd className="text-sm font-medium tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      <Table caption={t('common.items')}>
        <thead>
          <tr>
            <th className={th}>{t('common.items')}</th>
            <th className={th}>{t('product.version')}</th>
            <th className={th}>{t('product.license')}</th>
            <th className={th}>{t('account.licenseCode')}</th>
            <th className={th}>{t('common.total')}</th>
          </tr>
        </thead>
        <tbody>
          {d.items.map((i) => (
            <tr key={i.id}>
              <td className={td}>
                <Link to={`/products/${i.slug}`} className="font-medium text-forest-900 hover:underline">
                  {L(i.title)}
                </Link>
              </td>
              <td className={td}>{i.version ?? '—'}</td>
              <td className={td}>{i.license || '—'}</td>
              <td className={cn(td, 'font-mono text-xs')}>{i.licenseCode ?? '••••-••••'}</td>
              <td className={cn(td, 'tabular-nums')}>{formatIDR(i.unitPriceIdr, locale)}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      <div className="flex flex-wrap gap-3">
        {d.deliveryAvailable && <ButtonLink to="/account/library">{t('account.library')}</ButtonLink>}
        {d.status === 'pending_payment' && (
          <Button variant="secondary" onClick={() => setConfirm(true)}>
            {t('account.cancelOrder')}
          </Button>
        )}
        <ButtonLink variant="ghost" to={`/contact?type=support`}>
          {t('account.inquiries')}
        </ButtonLink>
      </div>
      <ConfirmDialog open={confirm} title={t('account.cancelOrder')} body={t('account.cancelConfirm')} confirmLabel={t('account.cancelOrder')} tone="danger" loading={busy} onConfirm={cancel} onClose={() => setConfirm(false)} />
    </div>
  )
}

/* ───────────── Library / downloads ───────────── */

export function AccountLibrary() {
  const { t, L, locale } = useI18n()
  const toast = useToast()
  useDocumentTitle(t('account.library'))
  const lib = useApi<LibraryItem[]>('/account/library')
  const [busy, setBusy] = useState<number | null>(null)
  const download = async (orderItemId: number, assetId: number) => {
    setBusy(assetId)
    try {
      const r = await api<{ url: string }>('/account/downloads', { method: 'POST', body: { orderItemId, assetId } })
      if (r.data.url.startsWith('/api/v1/downloads/')) window.location.assign(r.data.url)
    } catch (e) {
      toast.push('error', errorMessage(e))
    } finally {
      setBusy(null)
    }
  }
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t('account.library')} />
      {lib.loading ? (
        <LoadingBlock />
      ) : lib.error ? (
        <ErrorState message={lib.error.message} onRetry={lib.reload} />
      ) : !lib.data?.length ? (
        <EmptyState title={t('account.noLibrary')} action={<ButtonLink to="/catalog">{t('hero.ctaPrimary')}</ButtonLink>} />
      ) : (
        <ul className="flex flex-col gap-5">
          {lib.data.map((it) => (
            <li key={it.orderItemId} className="rounded-sm bg-white hairline">
              <div className="flex flex-col gap-2 border-b border-ink/[0.07] p-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <Link to={`/products/${it.product.slug}`} className="font-display text-xl text-forest-950 hover:underline">
                    {L(it.product.title)}
                  </Link>
                  <p className="mt-1 text-xs text-stone-600">
                    {it.orderPublicId} · {formatDate(it.completedAt, locale)} · {t('product.version')} {it.product.version ?? '—'}
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-[0.6875rem] uppercase tracking-[0.12em] text-stone-500">{t('account.licenseCode')}</p>
                  <p className="font-mono text-sm font-semibold">{it.licenseCode}</p>
                  <p className="text-xs text-stone-600">{it.license}</p>
                </div>
              </div>
              <ul className="divide-y divide-ink/[0.07]">
                {it.assets.length === 0 && <li className="p-5 text-sm text-stone-600">{t('product.none')}</li>}
                {it.assets.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-4 px-5 py-3.5">
                    <Icon name="file" className="size-4 text-sage-500" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{a.label}</p>
                      <p className="text-xs text-stone-500">
                        {a.filename} · {formatBytes(a.sizeBytes)}
                        {a.version ? ` · v${a.version}` : ''}
                      </p>
                    </div>
                    <Button size="sm" variant="secondary" loading={busy === a.id} onClick={() => download(it.orderItemId, a.id)}>
                      <Icon name="download" className="size-3.5" />
                      {busy === a.id ? t('account.preparing') : t('account.download')}
                    </Button>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function AccountDownloads() {
  const { t, L, locale } = useI18n()
  useDocumentTitle(t('account.downloads'))
  const d = useApi<{ at: string; file: string; product: { slug: string; title: Bilingual } }[]>('/account/downloads')
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t('account.downloads')} />
      {d.loading ? (
        <LoadingBlock />
      ) : d.error ? (
        <ErrorState message={d.error.message} onRetry={d.reload} />
      ) : !d.data?.length ? (
        <EmptyState title={t('account.noDownloads')} />
      ) : (
        <Table caption={t('account.downloads')}>
          <thead>
            <tr>
              <th className={th}>{t('common.date')}</th>
              <th className={th}>{t('common.items')}</th>
              <th className={th}>File</th>
            </tr>
          </thead>
          <tbody>
            {d.data.map((r, i) => (
              <tr key={i}>
                <td className={td}>{formatDate(r.at, locale, true)}</td>
                <td className={td}>
                  <Link to={`/products/${r.product.slug}`} className="hover:underline">
                    {L(r.product.title)}
                  </Link>
                </td>
                <td className={td}>{r.file}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  )
}

export function AccountInquiries() {
  const { t, locale } = useI18n()
  useDocumentTitle(t('account.inquiries'))
  const d = useApi<{ publicId: string; serviceType: string; status: string; message: string; createdAt: string }[]>('/account/inquiries')
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t('account.inquiries')} actions={<ButtonLink to="/contact?type=support">{t('contact.submit')}</ButtonLink>} />
      {d.loading ? (
        <LoadingBlock />
      ) : d.error ? (
        <ErrorState message={d.error.message} onRetry={d.reload} />
      ) : !d.data?.length ? (
        <EmptyState title={t('account.noInquiries')} />
      ) : (
        <ul className="flex flex-col gap-3">
          {d.data.map((i) => (
            <li key={i.publicId} className="flex flex-col gap-2 rounded-sm bg-white p-5 hairline">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-xs font-semibold">{i.publicId}</span>
                <StatusBadge status={i.status} />
              </div>
              <p className="text-sm font-medium">{t(`service.${i.serviceType}` as 'service.other')}</p>
              <p className="line-clamp-2 text-sm text-stone-600">{i.message}</p>
              <p className="text-xs text-stone-500">{formatDate(i.createdAt, locale, true)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ───────────── Settings & onboarding ───────────── */

function ProfileForm({ onboarding, children }: { onboarding?: boolean; children?: (busy: boolean) => ReactNode }) {
  const { t, setLocale } = useI18n()
  const { me, refreshMe } = useSession()
  const toast = useToast()
  const navigate = useNavigate()
  const [f, setF] = useState({ displayName: '', company: '', phone: '', country: '', locale: 'id' as 'id' | 'en' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    if (me) setF({ displayName: me.profile.displayName, company: me.profile.company, phone: me.profile.phone, country: me.profile.country, locale: me.profile.locale })
  }, [me])
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)
    if (f.phone && !/^[+0-9 ()-]*$/.test(f.phone)) {
      setErr('Phone: + 0-9 ( ) - only')
      return
    }
    setBusy(true)
    try {
      await api('/account/profile', { method: 'PATCH', body: { ...f, completeOnboarding: onboarding || undefined } })
      setLocale(f.locale)
      await refreshMe()
      toast.push('success', t('account.saved'))
      if (onboarding) navigate('/account')
    } catch (e2) {
      setErr(errorMessage(e2))
    } finally {
      setBusy(false)
    }
  }
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }))
  return (
    <form onSubmit={submit} className="flex max-w-xl flex-col gap-5" noValidate>
      <Field label={t('account.displayName')}>{(p) => <Input {...p} value={f.displayName} onChange={set('displayName')} maxLength={120} autoComplete="name" />}</Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t('account.company')}>{(p) => <Input {...p} value={f.company} onChange={set('company')} maxLength={160} autoComplete="organization" />}</Field>
        <Field label={t('account.phone')}>{(p) => <Input {...p} type="tel" value={f.phone} onChange={set('phone')} maxLength={40} autoComplete="tel" />}</Field>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t('account.country')}>{(p) => <Input {...p} value={f.country} onChange={set('country')} maxLength={80} autoComplete="country-name" />}</Field>
        <Field label={t('account.preferredLanguage')}>
          {(p) => (
            <Select {...p} value={f.locale} onChange={(e) => setF((x) => ({ ...x, locale: e.target.value as 'id' | 'en' }))}>
              <option value="id">Bahasa Indonesia</option>
              <option value="en">English</option>
            </Select>
          )}
        </Field>
      </div>
      {err && (
        <p role="alert" className="text-sm font-medium text-danger">
          {err}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={busy}>
          {onboarding ? t('onboarding.continue') : t('account.save')}
        </Button>
        {children?.(busy)}
      </div>
    </form>
  )
}

export function AccountSettings() {
  const { t } = useI18n()
  const { openSecurity } = useSession()
  useDocumentTitle(t('account.settings'))
  return (
    <div className="flex flex-col gap-10">
      <PageHeader title={t('account.settings')} />
      <section className="flex flex-col gap-5">
        <h2 className="font-display text-xl">{t('account.profile')}</h2>
        <ProfileForm />
      </section>
      <section className="flex max-w-xl flex-col gap-3 border-t border-ink/10 pt-8">
        <h2 className="font-display text-xl">{t('account.security')}</h2>
        <p className="text-sm text-stone-600">{t('account.securityBody')}</p>
        <div>
          <Button variant="secondary" onClick={openSecurity}>
            {t('account.manageSecurity')}
            <Icon name="external" className="size-3.5" />
          </Button>
        </div>
      </section>
    </div>
  )
}

export function Onboarding() {
  const { t } = useI18n()
  const navigate = useNavigate()
  useDocumentTitle(t('onboarding.title'))
  return (
    <div className="container-site max-w-2xl py-16">
      <p className="eyebrow">ORSAVEN</p>
      <h1 className="mt-4 text-display-md text-forest-950">{t('onboarding.title')}</h1>
      <p className="mb-8 mt-3 text-stone-600">{t('onboarding.body')}</p>
      <ProfileForm onboarding>
        {(busy) => (
          <Button variant="ghost" disabled={busy} onClick={() => navigate('/account')}>
            {t('onboarding.skip')}
          </Button>
        )}
      </ProfileForm>
    </div>
  )
}
