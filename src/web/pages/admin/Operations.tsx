import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { FAMILIES, formatIDR, INQUIRY_STATUSES, ORDER_STATUSES, ROLES } from '../../../shared/domain'
import { api, downloadAuthed, errorMessage, useApi } from '../../lib/api'
import { cn, formatDate } from '../../lib/cn'
import { useSession } from '../../lib/session'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import { Markdown } from '../../lib/markdown'
import { Badge, Button, Checkbox, ConfirmDialog, Dialog, EmptyState, ErrorState, Field, Input, LoadingBlock, Notice, PageHeader, Pagination, Select, StatCard, StatusBadge, Table, Tabs, Textarea, td, th, useToast } from '../../components/ui'

type Row = Record<string, unknown>
const s = (v: unknown) => (v == null ? '' : String(v))

function useListParams() {
  const [params, setParams] = useSearchParams()
  const set = (k: string, v: string) => {
    const n = new URLSearchParams(params)
    if (v && v !== 'all') n.set(k, v)
    else n.delete(k)
    if (k !== 'page') n.delete('page')
    setParams(n)
  }
  return { params, set, page: Number(params.get('page') ?? '1') || 1 }
}

function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('rounded-sm bg-white p-4 hairline lg:p-5', className)}>{children}</div>
}

/* ───────────── Overview ───────────── */

interface Overview {
  products: Record<string, number>
  orders: Record<string, { count: number; totalIdr: number }>
  inquiries: Record<string, number>
  activeUsers: number
  downloads30d: number
  recentActivity: { action: string; entity_type: string; entity_id: string; actor_role: string; created_at: string }[]
  paymentProvider: string
  storageDriver: string
}

export function AdminOverview() {
  useDocumentTitle('Admin')
  const o = useApi<Overview>('/admin/overview')
  const { config } = useSession()
  if (o.loading) return <LoadingBlock rows={6} />
  if (o.error) return <ErrorState message={errorMessage(o.error)} onRetry={o.reload} />
  const d = o.data!
  const sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0)
  const completed = d.orders.completed
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Overview" description="Operational snapshot. All figures are live counts from the database — nothing is estimated." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Published products" value={d.products.published ?? 0} hint={`${sum(d.products)} total · ${d.products.review ?? 0} in review`} />
        <StatCard label="Completed orders" value={completed?.count ?? 0} hint={`${formatIDR(completed?.totalIdr ?? 0, 'en')} · ${d.orders.pending_payment?.count ?? 0} pending`} />
        <StatCard label="Open inquiries" value={(d.inquiries.new ?? 0) + (d.inquiries.in_review ?? 0)} hint={`${sum(d.inquiries)} total`} />
        <StatCard label="Active accounts" value={d.activeUsers} hint={`${d.downloads30d} downloads in 30 days`} />
      </div>
      <div className="grid gap-6 lg:grid-cols-5">
        <Panel className="lg:col-span-3">
          <h2 className="mb-3 font-display text-lg">Recent activity</h2>
          {d.recentActivity.length === 0 ? (
            <p className="text-sm text-stone-600">No activity yet.</p>
          ) : (
            <ol className="flex flex-col">
              {d.recentActivity.map((a, i) => (
                <li key={i} className="flex justify-between gap-4 border-b border-ink/[0.07] py-2.5 text-sm last:border-0">
                  <span>
                    <span className="font-medium">{a.action}</span> <span className="text-stone-500">{a.entity_type} {a.entity_id}</span>
                  </span>
                  <span className="whitespace-nowrap text-xs text-stone-500">{formatDate(a.created_at, 'en', true)}</span>
                </li>
              ))}
            </ol>
          )}
          <Link to="/admin/audit" className="link-underline mt-3 inline-block text-xs font-medium text-forest-800">
            Full audit log →
          </Link>
        </Panel>
        <Panel className="lg:col-span-2">
          <h2 className="mb-3 font-display text-lg">Platform status</h2>
          <dl className="flex flex-col text-sm">
            {[
              ['Authentication', config?.authConfigured ? 'Clerk (production instance)' : 'Not configured'],
              ['Payment provider', d.paymentProvider === 'none' ? 'None — checkout cannot collect payment' : d.paymentProvider],
              ['File storage', d.storageDriver === 'r2' ? 'Cloudflare R2 (private)' : 'D1 private blobs (free tier, ≤1.8 MB/file)'],
              ['Environment', config?.environment ?? '—'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-b border-ink/[0.07] py-2.5 last:border-0">
                <dt className="text-stone-600">{k}</dt>
                <dd className="text-right font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>
    </div>
  )
}

/* ───────────── Categories ───────────── */

interface CategoryRow {
  id: number
  family: string
  slug: string
  name_id: string
  name_en: string
  description_id: string
  description_en: string
  sort_order: number
  is_active: number
  product_count: number
}

export function AdminCategories() {
  useDocumentTitle('Categories')
  const { can } = useSession()
  const toast = useToast()
  const list = useApi<CategoryRow[]>('/admin/categories')
  const [edit, setEdit] = useState<Partial<CategoryRow> | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const save = async () => {
    if (!edit) return
    setBusy(true)
    setErr(null)
    const body = {
      family: edit.family,
      slug: edit.slug,
      name_id: edit.name_id,
      name_en: edit.name_en,
      description_id: edit.description_id ?? '',
      description_en: edit.description_en ?? '',
      sort_order: Number(edit.sort_order ?? 0),
      is_active: edit.is_active === undefined ? true : !!edit.is_active,
    }
    try {
      if (edit.id) await api(`/admin/categories/${edit.id}`, { method: 'PUT', body })
      else await api('/admin/categories', { method: 'POST', body })
      toast.push('success', 'Category saved')
      setEdit(null)
      list.reload()
    } catch (e) {
      setErr(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Categories" description="Categories belong to one of the four approved product families." actions={can('category.write') && <Button onClick={() => setEdit({ family: 'digital_assets', is_active: 1, sort_order: 0 })}>New category</Button>} />
      {list.loading ? (
        <LoadingBlock />
      ) : list.error ? (
        <ErrorState message={errorMessage(list.error)} onRetry={list.reload} />
      ) : (
        FAMILIES.map((f) => (
          <Panel key={f.key}>
            <h2 className="mb-2 font-display text-lg">{f.name.en}</h2>
            <Table caption={f.name.en}>
              <thead>
                <tr>
                  <th className={th}>Name (EN / ID)</th>
                  <th className={th}>Slug</th>
                  <th className={th}>Order</th>
                  <th className={th}>Products</th>
                  <th className={th}>Status</th>
                  <th className={th} />
                </tr>
              </thead>
              <tbody>
                {(list.data ?? [])
                  .filter((c) => c.family === f.key)
                  .map((c) => (
                    <tr key={c.id}>
                      <td className={td}>
                        <p className="font-medium">{c.name_en}</p>
                        <p className="text-xs text-stone-500">{c.name_id}</p>
                      </td>
                      <td className={cn(td, 'font-mono text-xs')}>{c.slug}</td>
                      <td className={cn(td, 'tabular-nums')}>{c.sort_order}</td>
                      <td className={cn(td, 'tabular-nums')}>{c.product_count}</td>
                      <td className={td}>
                        <StatusBadge status={c.is_active ? 'published' : 'archived'} label={c.is_active ? 'active' : 'hidden'} />
                      </td>
                      <td className={td}>
                        {can('category.write') && (
                          <Button size="sm" variant="ghost" onClick={() => setEdit(c)}>
                            Edit
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </Table>
          </Panel>
        ))
      )}
      <Dialog
        open={!!edit}
        onClose={() => setEdit(null)}
        title={edit?.id ? 'Edit category' : 'New category'}
        size="lg"
        footer={
          <>
            {err && <span className="mr-auto text-xs font-medium text-danger">{err}</span>}
            <Button variant="ghost" onClick={() => setEdit(null)}>
              Cancel
            </Button>
            <Button onClick={save} loading={busy}>
              Save
            </Button>
          </>
        }
      >
        {edit && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Family" required>
              {(p) => (
                <Select {...p} value={edit.family} onChange={(e) => setEdit({ ...edit, family: e.target.value })}>
                  {FAMILIES.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.name.en}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Slug" required>{(p) => <Input {...p} value={s(edit.slug)} onChange={(e) => setEdit({ ...edit, slug: e.target.value })} />}</Field>
            <Field label="Name (EN)" required>{(p) => <Input {...p} value={s(edit.name_en)} onChange={(e) => setEdit({ ...edit, name_en: e.target.value })} />}</Field>
            <Field label="Name (ID)" required>{(p) => <Input {...p} value={s(edit.name_id)} onChange={(e) => setEdit({ ...edit, name_id: e.target.value })} />}</Field>
            <Field label="Description (EN)">{(p) => <Textarea {...p} rows={3} value={s(edit.description_en)} onChange={(e) => setEdit({ ...edit, description_en: e.target.value })} />}</Field>
            <Field label="Description (ID)">{(p) => <Textarea {...p} rows={3} value={s(edit.description_id)} onChange={(e) => setEdit({ ...edit, description_id: e.target.value })} />}</Field>
            <Field label="Sort order">{(p) => <Input {...p} type="number" min={0} value={s(edit.sort_order)} onChange={(e) => setEdit({ ...edit, sort_order: Number(e.target.value) })} />}</Field>
            <Checkbox className="self-end pb-2" checked={!!edit.is_active} onChange={(e) => setEdit({ ...edit, is_active: e.target.checked ? 1 : 0 })} label="Visible in catalog" />
          </div>
        )}
      </Dialog>
    </div>
  )
}

/* ───────────── Orders ───────────── */

export function AdminOrders() {
  useDocumentTitle('Orders')
  const { params, set, page } = useListParams()
  const status = params.get('status') ?? 'all'
  const q = params.get('q') ?? ''
  const [search, setSearch] = useState(q)
  useEffect(() => {
    const id = setTimeout(() => search !== q && set('q', search), 300)
    return () => clearTimeout(id)
  })
  const path = useMemo(() => `/admin/orders?${new URLSearchParams({ status, page: String(page), pageSize: '25', ...(q ? { q } : {}) })}`, [status, page, q])
  const list = useApi<Row[]>(path)
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Orders" description="Orders move to Paid only through verified payment-provider webhooks. Administrators can cancel unpaid orders and add notes, never mark them paid." />
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input aria-label="Search orders" placeholder="Order ID or customer email" value={search} onChange={(e) => setSearch(e.target.value)} className="sm:max-w-xs" />
        <Select aria-label="Status" value={status} onChange={(e) => set('status', e.target.value)}>
          <option value="all">All statuses</option>
          {ORDER_STATUSES.map((x) => (
            <option key={x} value={x}>
              {x.replace('_', ' ')}
            </option>
          ))}
        </Select>
      </div>
      {list.loading ? (
        <LoadingBlock />
      ) : list.error ? (
        <ErrorState message={errorMessage(list.error)} onRetry={list.reload} />
      ) : !list.data?.length ? (
        <EmptyState title="No orders" />
      ) : (
        <Panel>
          <Table caption="Orders">
            <thead>
              <tr>
                <th className={th}>Order</th>
                <th className={th}>Customer</th>
                <th className={th}>Items</th>
                <th className={th}>Total</th>
                <th className={th}>Provider</th>
                <th className={th}>Status</th>
                <th className={th}>Created</th>
              </tr>
            </thead>
            <tbody>
              {list.data.map((o) => (
                <tr key={s(o.public_id)}>
                  <td className={td}>
                    <Link to={`/admin/orders/${s(o.public_id)}`} className="font-mono text-xs font-semibold text-forest-800 hover:underline">
                      {s(o.public_id)}
                    </Link>
                  </td>
                  <td className={td}>{s(o.email) || '—'}</td>
                  <td className={cn(td, 'tabular-nums')}>{s(o.item_count)}</td>
                  <td className={cn(td, 'tabular-nums')}>{formatIDR(Number(o.total_idr), 'en')}</td>
                  <td className={td}>{s(o.payment_provider)}</td>
                  <td className={td}>
                    <StatusBadge status={s(o.status)} />
                  </td>
                  <td className={cn(td, 'whitespace-nowrap text-xs')}>{formatDate(s(o.created_at), 'en', true)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
          <div className="mt-4">
            <Pagination page={page} totalPages={Math.max(1, Math.ceil((list.meta?.total ?? 0) / 25))} onChange={(p) => set('page', String(p))} />
          </div>
        </Panel>
      )}
    </div>
  )
}

export function AdminOrderDetail() {
  const { publicId } = useParams()
  useDocumentTitle(publicId ?? 'Order')
  const toast = useToast()
  const { can } = useSession()
  const o = useApi<Row & { items: Row[]; payments: Row[]; history: Row[]; customer: Row | null; adminNote: string }>(`/admin/orders/${publicId}`)
  const [note, setNote] = useState('')
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (o.data) setNote(o.data.adminNote ?? '')
  }, [o.data])
  if (o.loading) return <LoadingBlock rows={6} />
  if (o.error) return <ErrorState message={errorMessage(o.error)} onRetry={o.reload} />
  const d = o.data!
  const act = async (action: 'cancel' | 'note') => {
    setBusy(true)
    try {
      await api(`/admin/orders/${publicId}/action`, { method: 'POST', body: { action, note } })
      toast.push('success', action === 'cancel' ? 'Order cancelled' : 'Note saved')
      setConfirmCancel(false)
      o.reload()
    } catch (e) {
      toast.push('error', errorMessage(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        breadcrumb={
          <Link to="/admin/orders" className="text-xs text-stone-600 hover:text-forest-900">
            ← Orders
          </Link>
        }
        title={<span className="font-mono">{s(d.publicId)}</span>}
        actions={<StatusBadge status={s(d.status)} />}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <h2 className="mb-3 font-display text-lg">Items</h2>
          <Table caption="Items">
            <thead>
              <tr>
                <th className={th}>Product</th>
                <th className={th}>License code</th>
                <th className={th}>Price</th>
              </tr>
            </thead>
            <tbody>
              {d.items.map((i) => (
                <tr key={s(i.id)}>
                  <td className={td}>{(i.title as { en: string }).en}</td>
                  <td className={cn(td, 'font-mono text-xs')}>{s(i.licenseCode)}</td>
                  <td className={cn(td, 'tabular-nums')}>{formatIDR(Number(i.unitPriceIdr), 'en')}</td>
                </tr>
              ))}
            </tbody>
          </Table>
          <h2 className="mb-3 mt-6 font-display text-lg">Payments</h2>
          {d.payments.length === 0 ? (
            <p className="text-sm text-stone-600">No payment records.</p>
          ) : (
            <ul className="text-sm">
              {d.payments.map((p, i) => (
                <li key={i} className="flex justify-between border-b border-ink/[0.07] py-2">
                  <span>
                    {s(p.provider)} · {formatIDR(Number(p.amount_idr), 'en')}
                  </span>
                  <StatusBadge status={s(p.status)} />
                </li>
              ))}
            </ul>
          )}
          <h2 className="mb-3 mt-6 font-display text-lg">State history</h2>
          <ol className="text-sm">
            {d.history.map((h, i) => (
              <li key={i} className="flex justify-between gap-4 border-b border-ink/[0.07] py-2">
                <span>
                  <span className="font-medium">{s(h.action)}</span> <span className="text-xs text-stone-500">by {s(h.actor_role)}</span>
                </span>
                <span className="text-xs text-stone-500">{formatDate(s(h.created_at), 'en', true)}</span>
              </li>
            ))}
          </ol>
        </Panel>
        <div className="flex flex-col gap-6">
          <Panel>
            <h2 className="mb-3 font-display text-lg">Customer</h2>
            {d.customer ? (
              <Link to={`/admin/customers/${s(d.customer.id)}`} className="text-sm font-medium text-forest-800 hover:underline">
                {s(d.customer.email) || `User #${s(d.customer.id)}`}
              </Link>
            ) : (
              '—'
            )}
            <dl className="mt-4 flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-stone-600">Total</dt>
                <dd className="tabular-nums">{formatIDR(Number(d.totalIdr), 'en')}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-stone-600">Provider</dt>
                <dd>{s(d.paymentProvider)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-stone-600">Created</dt>
                <dd>{formatDate(s(d.createdAt), 'en', true)}</dd>
              </div>
            </dl>
          </Panel>
          {can('order.update') && (
            <Panel>
              <Field label="Internal note">{(p) => <Textarea {...p} rows={4} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" loading={busy} onClick={() => act('note')}>
                  Save note
                </Button>
                {d.status === 'pending_payment' && (
                  <Button size="sm" variant="ghost" className="text-danger" onClick={() => setConfirmCancel(true)}>
                    Cancel order
                  </Button>
                )}
              </div>
              <p className="mt-3 text-xs text-stone-500">Payment status cannot be changed manually.</p>
            </Panel>
          )}
        </div>
      </div>
      <ConfirmDialog open={confirmCancel} title="Cancel order" body="Cancel this unpaid order? This is recorded in the audit log." confirmLabel="Cancel order" tone="danger" loading={busy} onConfirm={() => act('cancel')} onClose={() => setConfirmCancel(false)} />
    </div>
  )
}

/* ───────────── Payments & downloads ───────────── */

export function AdminPayments() {
  useDocumentTitle('Payments')
  const d = useApi<{ payments: Row[]; webhooks: Row[]; provider: string }>('/admin/payments')
  if (d.loading) return <LoadingBlock />
  if (d.error) return <ErrorState message={errorMessage(d.error)} onRetry={d.reload} />
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Payments" description="Provider-independent payment records. Webhook signatures are verified before any state change; replays are idempotent." />
      {d.data!.provider === 'none' && (
        <Notice tone="warning" title="No payment provider active">
          Paid checkout cannot collect money. A Midtrans adapter is prepared but inactive; activating it requires owner authorisation, merchant credentials, and approved legal documents.
        </Notice>
      )}
      <Panel>
        <h2 className="mb-3 font-display text-lg">Payment records</h2>
        {d.data!.payments.length === 0 ? (
          <p className="text-sm text-stone-600">No payment records.</p>
        ) : (
          <Table caption="Payments">
            <thead>
              <tr>
                <th className={th}>Order</th>
                <th className={th}>Provider</th>
                <th className={th}>Amount</th>
                <th className={th}>Status</th>
                <th className={th}>Verified</th>
              </tr>
            </thead>
            <tbody>
              {d.data!.payments.map((p, i) => (
                <tr key={i}>
                  <td className={cn(td, 'font-mono text-xs')}>{s(p.public_id)}</td>
                  <td className={td}>{s(p.provider)}</td>
                  <td className={cn(td, 'tabular-nums')}>{formatIDR(Number(p.amount_idr), 'en')}</td>
                  <td className={td}>
                    <StatusBadge status={s(p.status)} />
                  </td>
                  <td className={cn(td, 'text-xs')}>{formatDate(s(p.verified_at), 'en', true)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>
      <Panel>
        <h2 className="mb-3 font-display text-lg">Webhook events</h2>
        {d.data!.webhooks.length === 0 ? (
          <p className="text-sm text-stone-600">No webhook events received.</p>
        ) : (
          <ul className="text-sm">
            {d.data!.webhooks.map((w, i) => (
              <li key={i} className="flex justify-between gap-4 border-b border-ink/[0.07] py-2">
                <span className="font-mono text-xs">{s(w.event_key)}</span>
                <span>{s(w.outcome)}</span>
                <span className="text-xs text-stone-500">{formatDate(s(w.received_at), 'en', true)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}

export function AdminDownloads() {
  useDocumentTitle('Download activity')
  const d = useApi<{ events: Row[]; grantsIssued: number }>('/admin/downloads')
  if (d.loading) return <LoadingBlock />
  if (d.error) return <ErrorState message={errorMessage(d.error)} onRetry={d.reload} />
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Download activity" description={`${d.data!.grantsIssued} download grants issued. Each grant is short-lived and use-limited; IP addresses are stored only as salted hashes.`} />
      {d.data!.events.length === 0 ? (
        <EmptyState title="No downloads yet" />
      ) : (
        <Panel>
          <Table caption="Downloads">
            <thead>
              <tr>
                <th className={th}>When</th>
                <th className={th}>Customer</th>
                <th className={th}>Product</th>
                <th className={th}>File</th>
              </tr>
            </thead>
            <tbody>
              {d.data!.events.map((e, i) => (
                <tr key={i}>
                  <td className={cn(td, 'whitespace-nowrap text-xs')}>{formatDate(s(e.created_at), 'en', true)}</td>
                  <td className={td}>{s(e.email)}</td>
                  <td className={td}>{s(e.title_en)}</td>
                  <td className={td}>{s(e.filename)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Panel>
      )}
    </div>
  )
}

/* ───────────── Customers ───────────── */

export function AdminCustomers() {
  useDocumentTitle('Customers')
  const { params, set, page } = useListParams()
  const q = params.get('q') ?? ''
  const role = params.get('role') ?? ''
  const [search, setSearch] = useState(q)
  useEffect(() => {
    const id = setTimeout(() => search !== q && set('q', search), 300)
    return () => clearTimeout(id)
  })
  const list = useApi<Row[]>(`/admin/customers?${new URLSearchParams({ page: String(page), pageSize: '25', ...(q ? { q } : {}), ...(role ? { role } : {}) })}`)
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Customers" description="Accounts are created on first sign-in via Clerk. Viewing a customer record is audited." />
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input aria-label="Search customers" placeholder="Email or name" value={search} onChange={(e) => setSearch(e.target.value)} className="sm:max-w-xs" />
        <Select aria-label="Role" value={role} onChange={(e) => set('role', e.target.value)}>
          <option value="">All roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r.replace('_', ' ')}
            </option>
          ))}
        </Select>
      </div>
      {list.loading ? (
        <LoadingBlock />
      ) : list.error ? (
        <ErrorState message={errorMessage(list.error)} onRetry={list.reload} />
      ) : !list.data?.length ? (
        <EmptyState title="No accounts found" />
      ) : (
        <Panel>
          <Table caption="Customers">
            <thead>
              <tr>
                <th className={th}>Account</th>
                <th className={th}>Role</th>
                <th className={th}>Orders</th>
                <th className={th}>Country</th>
                <th className={th}>Joined</th>
              </tr>
            </thead>
            <tbody>
              {list.data.map((u) => (
                <tr key={s(u.id)}>
                  <td className={td}>
                    <Link to={`/admin/customers/${s(u.id)}`} className="font-medium text-forest-900 hover:underline">
                      {s(u.email) || `User #${s(u.id)}`}
                    </Link>
                    <p className="text-xs text-stone-500">
                      {s(u.display_name)} {u.email_verified ? '' : '· unverified email'}
                    </p>
                  </td>
                  <td className={td}>
                    <Badge tone={u.role_id === 'customer' ? 'neutral' : 'forest'}>{s(u.role_id).replace('_', ' ')}</Badge>
                  </td>
                  <td className={cn(td, 'tabular-nums')}>{s(u.order_count)}</td>
                  <td className={td}>{s(u.country) || '—'}</td>
                  <td className={cn(td, 'text-xs')}>{formatDate(s(u.created_at), 'en')}</td>
                </tr>
              ))}
            </tbody>
          </Table>
          <div className="mt-4">
            <Pagination page={page} totalPages={Math.max(1, Math.ceil((list.meta?.total ?? 0) / 25))} onChange={(p) => set('page', String(p))} />
          </div>
        </Panel>
      )}
    </div>
  )
}

export function AdminCustomerDetail() {
  const { id } = useParams()
  useDocumentTitle('Customer')
  const toast = useToast()
  const { can, me } = useSession()
  const d = useApi<{ user: Row; orders: Row[]; inquiries: Row[] }>(`/admin/customers/${id}`)
  const [role, setRole] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (d.data) setRole(s(d.data.user.role_id))
  }, [d.data])
  if (d.loading) return <LoadingBlock />
  if (d.error) return <ErrorState message={errorMessage(d.error)} onRetry={d.reload} />
  const u = d.data!.user
  const changeRole = async () => {
    setBusy(true)
    try {
      await api(`/admin/users/${id}/role`, { method: 'POST', body: { role } })
      toast.push('success', 'Role updated')
      setConfirm(false)
      d.reload()
    } catch (e) {
      toast.push('error', errorMessage(e))
    } finally {
      setBusy(false)
    }
  }
  const self = Number(id) === me?.id
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        breadcrumb={
          <Link to="/admin/customers" className="text-xs text-stone-600 hover:text-forest-900">
            ← Customers
          </Link>
        }
        title={s(u.email) || `User #${s(u.id)}`}
        description={`${s(u.display_name)} ${s(u.company) ? `· ${s(u.company)}` : ''}`}
        actions={<Badge tone="forest">{s(u.role_id).replace('_', ' ')}</Badge>}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <h2 className="mb-3 font-display text-lg">Orders</h2>
          {d.data!.orders.length === 0 ? (
            <p className="text-sm text-stone-600">No orders.</p>
          ) : (
            <ul className="text-sm">
              {d.data!.orders.map((o) => (
                <li key={s(o.public_id)} className="flex justify-between gap-4 border-b border-ink/[0.07] py-2">
                  <Link to={`/admin/orders/${s(o.public_id)}`} className="font-mono text-xs text-forest-800 hover:underline">
                    {s(o.public_id)}
                  </Link>
                  <span className="tabular-nums">{formatIDR(Number(o.total_idr), 'en')}</span>
                  <StatusBadge status={s(o.status)} />
                </li>
              ))}
            </ul>
          )}
          <h2 className="mb-3 mt-6 font-display text-lg">Inquiries</h2>
          {d.data!.inquiries.length === 0 ? (
            <p className="text-sm text-stone-600">No inquiries.</p>
          ) : (
            <ul className="text-sm">
              {d.data!.inquiries.map((i) => (
                <li key={s(i.public_id)} className="flex justify-between gap-4 border-b border-ink/[0.07] py-2">
                  <span className="font-mono text-xs">{s(i.public_id)}</span>
                  <span>{s(i.service_type)}</span>
                  <StatusBadge status={s(i.status)} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel>
          <dl className="flex flex-col gap-2 text-sm">
            {[
              ['Email verified', u.email_verified ? 'Yes' : 'No'],
              ['Status', s(u.status)],
              ['Phone', s(u.phone) || '—'],
              ['Country', s(u.country) || '—'],
              ['Locale', s(u.locale) || '—'],
              ['Joined', formatDate(s(u.created_at), 'en')],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <dt className="text-stone-600">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          {can('user.role_assign') && !self && (
            <div className="mt-5 flex flex-col gap-3 border-t border-ink/10 pt-5">
              <Field label="Role" hint="Role changes are audited. The last Super Admin cannot be demoted.">
                {(p) => (
                  <Select {...p} value={role} onChange={(e) => setRole(e.target.value)}>
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r.replace('_', ' ')}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Button size="sm" disabled={role === u.role_id} onClick={() => setConfirm(true)}>
                Change role
              </Button>
            </div>
          )}
        </Panel>
      </div>
      <ConfirmDialog open={confirm} title="Change role" body={`Change role to “${role.replace('_', ' ')}”? This immediately changes what this account can access.`} confirmLabel="Change role" loading={busy} onConfirm={changeRole} onClose={() => setConfirm(false)} />
    </div>
  )
}

/* ───────────── Inquiries ───────────── */

export function AdminInquiries() {
  useDocumentTitle('Service inquiries')
  const toast = useToast()
  const { can } = useSession()
  const { params, set, page } = useListParams()
  const status = params.get('status') ?? 'all'
  const list = useApi<Row[]>(`/admin/inquiries?${new URLSearchParams({ status, page: String(page), pageSize: '25' })}`)
  const [open, setOpen] = useState<Row | null>(null)
  const [edit, setEdit] = useState({ status: 'new', adminNote: '' })
  const [busy, setBusy] = useState(false)
  const save = async () => {
    if (!open) return
    setBusy(true)
    try {
      await api(`/admin/inquiries/${s(open.public_id)}`, { method: 'PATCH', body: edit })
      toast.push('success', 'Inquiry updated')
      setOpen(null)
      list.reload()
    } catch (e) {
      toast.push('error', errorMessage(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Service inquiries" description="Submitted through the public contact form. Reply to customers by email; track status here." />
      <Tabs label="Inquiry status" value={status} onChange={(v) => set('status', v)} tabs={[{ value: 'all', label: 'All' }, ...INQUIRY_STATUSES.map((x) => ({ value: x, label: x.replace('_', ' ') }))]} />
      {list.loading ? (
        <LoadingBlock />
      ) : list.error ? (
        <ErrorState message={errorMessage(list.error)} onRetry={list.reload} />
      ) : !list.data?.length ? (
        <EmptyState title="No inquiries" />
      ) : (
        <Panel>
          <Table caption="Inquiries">
            <thead>
              <tr>
                <th className={th}>Reference</th>
                <th className={th}>From</th>
                <th className={th}>Topic</th>
                <th className={th}>Product</th>
                <th className={th}>Status</th>
                <th className={th}>Received</th>
              </tr>
            </thead>
            <tbody>
              {list.data.map((i) => (
                <tr key={s(i.public_id)}>
                  <td className={td}>
                    <button
                      type="button"
                      className="font-mono text-xs font-semibold text-forest-800 hover:underline"
                      onClick={() => {
                        setOpen(i)
                        setEdit({ status: s(i.status), adminNote: s(i.admin_note) })
                      }}
                    >
                      {s(i.public_id)}
                    </button>
                  </td>
                  <td className={td}>
                    <p className="font-medium">{s(i.name)}</p>
                    <p className="text-xs text-stone-500">{s(i.email)}</p>
                  </td>
                  <td className={td}>{s(i.service_type).replace(/_/g, ' ')}</td>
                  <td className={td}>{s(i.product_title) || '—'}</td>
                  <td className={td}>
                    <StatusBadge status={s(i.status)} />
                  </td>
                  <td className={cn(td, 'whitespace-nowrap text-xs')}>{formatDate(s(i.created_at), 'en', true)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
          <div className="mt-4">
            <Pagination page={page} totalPages={Math.max(1, Math.ceil((list.meta?.total ?? 0) / 25))} onChange={(p) => set('page', String(p))} />
          </div>
        </Panel>
      )}
      <Dialog
        open={!!open}
        onClose={() => setOpen(null)}
        title={s(open?.public_id)}
        size="lg"
        footer={
          can('inquiry.update') ? (
            <>
              <Button variant="ghost" onClick={() => setOpen(null)}>
                Close
              </Button>
              <Button loading={busy} onClick={save}>
                Save
              </Button>
            </>
          ) : undefined
        }
      >
        {open && (
          <div className="flex flex-col gap-4 text-sm">
            <dl className="grid gap-2 sm:grid-cols-2">
              {[
                ['Name', open.name],
                ['Email', open.email],
                ['Company', open.company || '—'],
                ['Topic', s(open.service_type).replace(/_/g, ' ')],
                ['Budget', open.budget_range || '—'],
                ['Language', open.locale],
              ].map(([k, v]) => (
                <div key={s(k)}>
                  <dt className="text-xs text-stone-500">{s(k)}</dt>
                  <dd className="font-medium">{s(v)}</dd>
                </div>
              ))}
            </dl>
            <div className="whitespace-pre-wrap rounded-sm bg-ivory-100 p-4 leading-relaxed">{s(open.message)}</div>
            <a href={`mailto:${s(open.email)}?subject=${encodeURIComponent(`ORSAVEN ${s(open.public_id)}`)}`} className="link-underline w-fit text-sm font-medium text-forest-800">
              Reply by email →
            </a>
            {can('inquiry.update') && (
              <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
                <Field label="Status">
                  {(p) => (
                    <Select {...p} value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}>
                      {INQUIRY_STATUSES.map((x) => (
                        <option key={x} value={x}>
                          {x.replace('_', ' ')}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field label="Internal note">{(p) => <Textarea {...p} rows={3} value={edit.adminNote} onChange={(e) => setEdit({ ...edit, adminNote: e.target.value })} />}</Field>
              </div>
            )}
          </div>
        )}
      </Dialog>
    </div>
  )
}

/* ───────────── Roles ───────────── */

export function AdminRoles() {
  useDocumentTitle('Roles & permissions')
  const d = useApi<{ roles: (Row & { permissions: string[] })[]; permissions: Row[] }>('/admin/roles')
  if (d.loading) return <LoadingBlock />
  if (d.error) return <ErrorState message={errorMessage(d.error)} onRetry={d.reload} />
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Roles & permissions" description="Permissions are enforced by the API on every request. Assign roles from a customer record (Super Admin only)." />
      <Panel>
        <Table caption="Permission matrix">
          <thead>
            <tr>
              <th className={th}>Permission</th>
              {d.data!.roles.map((r) => (
                <th key={s(r.id)} className={cn(th, 'text-center')}>
                  {s(r.name)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {d.data!.permissions.map((p) => (
              <tr key={s(p.key)}>
                <td className={td}>
                  <p className="font-mono text-xs">{s(p.key)}</p>
                  <p className="text-xs text-stone-500">{s(p.description)}</p>
                </td>
                {d.data!.roles.map((r) => (
                  <td key={s(r.id)} className={cn(td, 'text-center')}>
                    {r.permissions.includes(s(p.key)) ? <span aria-label="granted">●</span> : <span className="text-stone-300" aria-label="not granted">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </Table>
      </Panel>
    </div>
  )
}

/* ───────────── Audit ───────────── */

export function AdminAudit() {
  useDocumentTitle('Audit logs')
  const { params, set, page } = useListParams()
  const entity = params.get('entityType') ?? ''
  const list = useApi<Row[]>(`/admin/audit?${new URLSearchParams({ page: String(page), pageSize: '50', ...(entity ? { entityType: entity } : {}) })}`)
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Audit logs" description="Append-only. Sensitive values are redacted before storage." />
      <Select aria-label="Entity type" value={entity} onChange={(e) => set('entityType', e.target.value)} className="sm:max-w-xs">
        <option value="">All entities</option>
        {['product', 'order', 'payment', 'user', 'inquiry', 'category', 'setting', 'legal', 'export'].map((x) => (
          <option key={x} value={x}>
            {x}
          </option>
        ))}
      </Select>
      {list.loading ? (
        <LoadingBlock />
      ) : list.error ? (
        <ErrorState message={errorMessage(list.error)} onRetry={list.reload} />
      ) : !list.data?.length ? (
        <EmptyState title="No audit entries" />
      ) : (
        <Panel>
          <Table caption="Audit log">
            <thead>
              <tr>
                <th className={th}>When</th>
                <th className={th}>Action</th>
                <th className={th}>Entity</th>
                <th className={th}>Actor</th>
                <th className={th}>Details</th>
              </tr>
            </thead>
            <tbody>
              {list.data.map((a) => (
                <tr key={s(a.id)}>
                  <td className={cn(td, 'whitespace-nowrap text-xs')}>{formatDate(s(a.created_at), 'en', true)}</td>
                  <td className={cn(td, 'font-medium')}>{s(a.action)}</td>
                  <td className={cn(td, 'text-xs')}>
                    {s(a.entity_type)} {s(a.entity_id)}
                  </td>
                  <td className={cn(td, 'text-xs')}>
                    {s(a.actor_email) || '—'}
                    <span className="block text-stone-500">{s(a.actor_role)}</span>
                  </td>
                  <td className={cn(td, 'max-w-xs truncate font-mono text-[0.6875rem] text-stone-500')} title={s(a.metadata_json)}>
                    {s(a.metadata_json) === '{}' ? '' : s(a.metadata_json)}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          <div className="mt-4">
            <Pagination page={page} totalPages={Math.max(1, Math.ceil((list.meta?.total ?? 0) / 50))} onChange={(p) => set('page', String(p))} />
          </div>
        </Panel>
      )}
    </div>
  )
}

/* ───────────── Legal ───────────── */

export function AdminLegal() {
  useDocumentTitle('Legal content')
  const toast = useToast()
  const { can } = useSession()
  const list = useApi<Row[]>('/admin/legal')
  const [edit, setEdit] = useState<Row | null>(null)
  const [lang, setLang] = useState<'id' | 'en'>('id')
  const [preview, setPreview] = useState(false)
  const [approve, setApprove] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const save = async () => {
    if (!edit) return
    setBusy(true)
    try {
      await api(`/admin/legal/${s(edit.slug)}`, { method: 'PUT', body: { title_id: edit.title_id, title_en: edit.title_en, body_id: edit.body_id, body_en: edit.body_en } })
      toast.push('success', 'Saved as draft')
      setEdit(null)
      list.reload()
    } catch (e) {
      toast.push('error', errorMessage(e))
    } finally {
      setBusy(false)
    }
  }
  const doApprove = async () => {
    if (!approve) return
    setBusy(true)
    try {
      await api(`/admin/legal/${approve}/approve`, { method: 'POST', body: { confirmLegalReview: true } })
      toast.push('success', 'Approved')
      setApprove(null)
      setConfirmed(false)
      list.reload()
    } catch (e) {
      toast.push('error', errorMessage(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Legal content" description="Every edit returns a document to DRAFT. Approval (Super Admin) requires confirming that legal counsel reviewed the text." />
      {list.loading ? (
        <LoadingBlock />
      ) : list.error ? (
        <ErrorState message={errorMessage(list.error)} onRetry={list.reload} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {list.data!.map((d) => (
            <Panel key={s(d.slug)}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg">{s(d.title_en)}</h2>
                  <p className="text-xs text-stone-500">
                    v{s(d.version)} · updated {formatDate(s(d.updated_at), 'en')}
                  </p>
                </div>
                <StatusBadge status={s(d.status)} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {can('legal.write') && (
                  <Button size="sm" variant="secondary" onClick={() => setEdit({ ...d })}>
                    Edit
                  </Button>
                )}
                {can('legal.approve') && d.status === 'draft' && (
                  <Button size="sm" onClick={() => setApprove(s(d.slug))}>
                    Approve
                  </Button>
                )}
                <a href={`/legal/${s(d.slug)}`} target="_blank" rel="noopener" className="inline-flex h-8 items-center px-3 text-[0.8125rem] text-forest-800 hover:underline">
                  View public page
                </a>
              </div>
            </Panel>
          ))}
        </div>
      )}
      <Dialog
        open={!!edit}
        onClose={() => setEdit(null)}
        title={`Edit — ${s(edit?.title_en)}`}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEdit(null)}>
              Cancel
            </Button>
            <Button loading={busy} onClick={save}>
              Save as draft
            </Button>
          </>
        }
      >
        {edit && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <Tabs
                label="Language"
                value={lang}
                onChange={setLang}
                tabs={[
                  { value: 'id', label: 'Bahasa Indonesia' },
                  { value: 'en', label: 'English' },
                ]}
              />
              <Checkbox checked={preview} onChange={(e) => setPreview(e.target.checked)} label="Preview" />
            </div>
            <Field label="Title">{(p) => <Input {...p} value={s(edit[`title_${lang}`])} onChange={(e) => setEdit({ ...edit, [`title_${lang}`]: e.target.value })} />}</Field>
            {preview ? (
              <div className="max-h-96 overflow-y-auto rounded-sm bg-ivory-100 p-4">
                <Markdown source={s(edit[`body_${lang}`])} />
              </div>
            ) : (
              <Field label="Body (Markdown)">{(p) => <Textarea {...p} rows={16} className="font-mono text-xs" value={s(edit[`body_${lang}`])} onChange={(e) => setEdit({ ...edit, [`body_${lang}`]: e.target.value })} />}</Field>
            )}
          </div>
        )}
      </Dialog>
      <Dialog
        open={!!approve}
        onClose={() => setApprove(null)}
        title="Approve legal document"
        footer={
          <>
            <Button variant="ghost" onClick={() => setApprove(null)}>
              Cancel
            </Button>
            <Button disabled={!confirmed} loading={busy} onClick={doApprove}>
              Approve
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Notice tone="warning">Approving removes the DRAFT label publicly and is a prerequisite for enabling paid checkout.</Notice>
          <Checkbox checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} label="I confirm this text has been reviewed by qualified legal counsel and is approved by the ORSAVEN owner." />
        </div>
      </Dialog>
    </div>
  )
}

/* ───────────── Settings ───────────── */

export function AdminSettings() {
  useDocumentTitle('Site settings')
  const toast = useToast()
  const { can } = useSession()
  const list = useApi<{ key: string; value: unknown; isPublic: boolean; editable: boolean; updatedAt: string }[]>('/admin/settings')
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  useEffect(() => {
    if (list.data) setDrafts(Object.fromEntries(list.data.map((x) => [x.key, JSON.stringify(x.value)])))
  }, [list.data])
  const save = async (key: string) => {
    let value: unknown
    try {
      value = JSON.parse(drafts[key])
    } catch {
      toast.push('error', 'Value must be valid JSON')
      return
    }
    setBusy(key)
    try {
      await api(`/admin/settings/${encodeURIComponent(key)}`, { method: 'PUT', body: { value } })
      toast.push('success', `${key} saved`)
      list.reload()
    } catch (e) {
      toast.push('error', errorMessage(e))
    } finally {
      setBusy(null)
    }
  }
  if (list.loading) return <LoadingBlock />
  if (list.error) return <ErrorState message={errorMessage(list.error)} onRetry={list.reload} />
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Site settings" description="Values are validated by the API. Enabling paid checkout requires Super Admin, an active payment provider, and approved legal documents." />
      <Panel>
        <ul className="flex flex-col">
          {list.data!.map((x) => (
            <li key={x.key} className="grid gap-3 border-b border-ink/[0.07] py-4 last:border-0 md:grid-cols-[16rem_1fr_auto] md:items-center">
              <div>
                <p className="font-mono text-xs font-semibold">{x.key}</p>
                <p className="text-xs text-stone-500">
                  {x.isPublic ? 'public' : 'private'} · {formatDate(x.updatedAt, 'en', true)}
                </p>
              </div>
              {typeof x.value === 'boolean' ? (
                <Checkbox checked={drafts[x.key] === 'true'} disabled={!x.editable || !can('settings.write')} onChange={(e) => setDrafts({ ...drafts, [x.key]: String(e.target.checked) })} label={drafts[x.key] === 'true' ? 'Enabled' : 'Disabled'} />
              ) : (
                <Input aria-label={x.key} className="font-mono text-xs" value={drafts[x.key] ?? ''} disabled={!x.editable || !can('settings.write')} onChange={(e) => setDrafts({ ...drafts, [x.key]: e.target.value })} />
              )}
              {x.editable && can('settings.write') ? (
                <Button size="sm" variant="secondary" loading={busy === x.key} disabled={drafts[x.key] === JSON.stringify(x.value)} onClick={() => save(x.key)}>
                  Save
                </Button>
              ) : (
                <span className="text-xs text-stone-500">read-only</span>
              )}
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  )
}

/* ───────────── Exports ───────────── */

export function AdminExports() {
  useDocumentTitle('Exports')
  const toast = useToast()
  const [busy, setBusy] = useState<string | null>(null)
  const run = async (ds: string) => {
    setBusy(ds)
    try {
      await downloadAuthed(`/admin/exports/${ds}`, `orsaven-${ds}-${new Date().toISOString().slice(0, 10)}.csv`)
    } catch (e) {
      toast.push('error', errorMessage(e))
    } finally {
      setBusy(null)
    }
  }
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Exports" description="CSV exports of permitted records. Each export is audited; cells are protected against spreadsheet formula injection." />
      <div className="grid gap-4 sm:grid-cols-2">
        {[
          ['orders', 'Orders', 'Order ID, status, totals, provider, timestamps, customer email.'],
          ['products', 'Products', 'All products with status, maturity, and pricing.'],
          ['inquiries', 'Inquiries', 'Contact details, topic, status — no IP data.'],
          ['customers', 'Customers', 'Accounts with role and profile fields.'],
        ].map(([k, label, desc]) => (
          <Panel key={k}>
            <h2 className="font-display text-lg">{label}</h2>
            <p className="mb-4 mt-1 text-xs text-stone-600">{desc}</p>
            <Button size="sm" variant="secondary" loading={busy === k} onClick={() => run(k)}>
              Download CSV
            </Button>
          </Panel>
        ))}
      </div>
    </div>
  )
}
