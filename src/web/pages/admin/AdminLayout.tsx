import { NavLink, Outlet } from 'react-router'
import { useSession } from '../../lib/session'
import { cn } from '../../lib/cn'
import { Badge } from '../../components/ui'

/** Admin navigation. Items are hidden by permission for usability only — every endpoint is enforced server-side. */
const NAV: { group: string; items: { to: string; label: string; perm?: string }[] }[] = [
  { group: 'Workspace', items: [{ to: '/admin', label: 'Overview' }] },
  {
    group: 'Catalog',
    items: [
      { to: '/admin/products', label: 'Products', perm: 'product.read_all' },
      { to: '/admin/approvals', label: 'Publishing approvals', perm: 'product.read_all' },
      { to: '/admin/categories', label: 'Categories' },
    ],
  },
  {
    group: 'Commerce',
    items: [
      { to: '/admin/orders', label: 'Orders', perm: 'order.read_all' },
      { to: '/admin/payments', label: 'Payments', perm: 'payment.read' },
      { to: '/admin/downloads', label: 'Download activity', perm: 'download.read' },
    ],
  },
  {
    group: 'People',
    items: [
      { to: '/admin/customers', label: 'Customers', perm: 'customer.read' },
      { to: '/admin/inquiries', label: 'Service inquiries', perm: 'inquiry.read' },
      { to: '/admin/roles', label: 'Roles & permissions' },
    ],
  },
  {
    group: 'Governance',
    items: [
      { to: '/admin/audit', label: 'Audit logs', perm: 'audit.read' },
      { to: '/admin/legal', label: 'Legal content' },
      { to: '/admin/settings', label: 'Site settings' },
      { to: '/admin/exports', label: 'Exports', perm: 'export.data' },
    ],
  },
]

export default function AdminLayout() {
  const { me, can } = useSession()
  return (
    <div className="min-h-[calc(100vh-4.5rem)] bg-ivory-100/60">
      <div className="container-site grid gap-8 py-8 lg:grid-cols-[15rem_1fr] lg:py-10">
        <aside>
          <div className="lg:sticky lg:top-24">
            <div className="mb-5 flex items-center justify-between gap-2 lg:flex-col lg:items-start">
              <p className="font-display text-lg text-forest-950">Admin</p>
              <Badge tone="forest">{me?.role.replace('_', ' ')}</Badge>
            </div>
            <nav aria-label="Admin" className="flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:gap-5 lg:overflow-visible lg:pb-0">
              {NAV.map((g) => {
                const items = g.items.filter((i) => !i.perm || can(i.perm))
                if (!items.length) return null
                return (
                  <div key={g.group} className="flex gap-1 lg:flex-col">
                    <p className="hidden px-3 pb-1 text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-stone-500 lg:block">{g.group}</p>
                    {items.map((i) => (
                      <NavLink key={i.to} to={i.to} end={i.to === '/admin'} className={({ isActive }) => cn('whitespace-nowrap rounded-xs px-3 py-1.5 text-sm transition-colors', isActive ? 'bg-forest-900 font-medium text-ivory-50' : 'text-forest-950 hover:bg-ink/5')}>
                        {i.label}
                      </NavLink>
                    ))}
                  </div>
                )
              })}
            </nav>
          </div>
        </aside>
        <main id="admin-main" className="min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
