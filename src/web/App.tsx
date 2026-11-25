import { lazy, Suspense, useEffect, type ComponentType, type ReactNode } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router'
import { useI18n } from './i18n'
import { useSession } from './lib/session'
import { ButtonLink, LoadingBlock, Notice } from './components/ui'
import { SiteHeader } from './components/layout/SiteHeader'
import { SiteFooter } from './components/layout/SiteFooter'
import Home from './pages/public/Home'
import Catalog from './pages/public/Catalog'
import Product from './pages/public/Product'
import NotFound from './pages/public/NotFound'
import { About, Contact, Faq, HowItWorks, Legal } from './pages/public/Static'
import { SignInPage, SignUpPage } from './pages/public/Auth'
import { AccountDownloads, AccountInquiries, AccountLayout, AccountLibrary, AccountOrderDetail, AccountOrders, AccountOverview, AccountSettings, Onboarding } from './pages/account/Account'

// Admin is code-split: customers never download admin code.
const products = () => import('./pages/admin/Products')
const ops = () => import('./pages/admin/Operations')
const pick = <M,>(loader: () => Promise<M>, f: (m: M) => ComponentType) => lazy(() => loader().then((m) => ({ default: f(m) })))

const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'))
const ADMIN_ROUTES: [string | null, ComponentType][] = [
  [null, pick(ops, (m) => m.AdminOverview)],
  ['products', pick(products, (m) => () => <m.AdminProducts />)],
  ['products/:id', pick(products, (m) => m.AdminProductEditor)],
  ['approvals', pick(products, (m) => () => <m.AdminProducts approvals />)],
  ['categories', pick(ops, (m) => m.AdminCategories)],
  ['orders', pick(ops, (m) => m.AdminOrders)],
  ['orders/:publicId', pick(ops, (m) => m.AdminOrderDetail)],
  ['payments', pick(ops, (m) => m.AdminPayments)],
  ['downloads', pick(ops, (m) => m.AdminDownloads)],
  ['customers', pick(ops, (m) => m.AdminCustomers)],
  ['customers/:id', pick(ops, (m) => m.AdminCustomerDetail)],
  ['inquiries', pick(ops, (m) => m.AdminInquiries)],
  ['roles', pick(ops, (m) => m.AdminRoles)],
  ['audit', pick(ops, (m) => m.AdminAudit)],
  ['legal', pick(ops, (m) => m.AdminLegal)],
  ['settings', pick(ops, (m) => m.AdminSettings)],
  ['exports', pick(ops, (m) => m.AdminExports)],
]

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [pathname])
  return null
}

function PublicShell() {
  const { pathname } = useLocation()
  return (
    <>
      <SiteHeader overlay={pathname === '/'} />
      <main id="main" tabIndex={-1} className="focus:outline-none">
        <Outlet />
      </main>
      <SiteFooter />
    </>
  )
}

function AppShell() {
  return (
    <>
      <SiteHeader />
      <main id="main" tabIndex={-1} className="focus:outline-none">
        <Outlet />
      </main>
    </>
  )
}

/** UX guard only. Authorization is enforced by the API on every request. */
function RequireAuth({ permission, children }: { permission?: string; children: ReactNode }) {
  const { t } = useI18n()
  const { loaded, signedIn, authAvailable, can, me, meError } = useSession()
  const location = useLocation()
  if (!loaded)
    return (
      <div className="container-site py-16">
        <LoadingBlock rows={5} />
      </div>
    )
  if (!authAvailable)
    return (
      <div className="container-site py-16">
        <Notice tone="warning">{t('auth.notConfigured')}</Notice>
      </div>
    )
  if (!signedIn) return <Navigate to={`/sign-in?redirect_url=${encodeURIComponent(location.pathname + location.search)}`} replace />
  if (!me)
    return (
      <div className="container-site py-16">
        <Notice tone="danger">{meError ?? t('common.error')}</Notice>
      </div>
    )
  if (permission && !can(permission))
    return (
      <div className="container-site flex flex-col items-start gap-4 py-20">
        <p className="eyebrow">403</p>
        <h1 className="text-display-md text-forest-950">{t('auth.forbidden')}</h1>
        <ButtonLink to="/account">{t('nav.account')}</ButtonLink>
      </div>
    )
  return <>{children}</>
}

const adminFallback = (
  <div className="py-10">
    <LoadingBlock rows={6} />
  </div>
)

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route element={<PublicShell />}>
          <Route index element={<Home />} />
          <Route path="catalog" element={<Catalog />} />
          <Route path="catalog/:family" element={<Catalog />} />
          <Route path="products/:slug" element={<Product />} />
          <Route path="about" element={<About />} />
          <Route path="how-it-works" element={<HowItWorks />} />
          <Route path="faq" element={<Faq />} />
          <Route path="contact" element={<Contact />} />
          <Route path="legal/:slug" element={<Legal />} />
          <Route path="*" element={<NotFound />} />
        </Route>
        <Route element={<AppShell />}>
          <Route path="sign-in/*" element={<SignInPage />} />
          <Route path="sign-up/*" element={<SignUpPage />} />
          <Route path="onboarding" element={<RequireAuth><Onboarding /></RequireAuth>} />
          <Route path="account" element={<RequireAuth><AccountLayout /></RequireAuth>}>
            <Route index element={<AccountOverview />} />
            <Route path="orders" element={<AccountOrders />} />
            <Route path="orders/:publicId" element={<AccountOrderDetail />} />
            <Route path="library" element={<AccountLibrary />} />
            <Route path="downloads" element={<AccountDownloads />} />
            <Route path="inquiries" element={<AccountInquiries />} />
            <Route path="settings" element={<AccountSettings />} />
          </Route>
          <Route
            path="admin"
            element={
              <RequireAuth permission="admin.access">
                <Suspense fallback={adminFallback}>
                  <AdminLayout />
                </Suspense>
              </RequireAuth>
            }
          >
            {ADMIN_ROUTES.map(([path, C]) => {
              const el = (
                <Suspense fallback={adminFallback}>
                  <C />
                </Suspense>
              )
              return path ? <Route key={path} path={path} element={el} /> : <Route key="index" index element={el} />
            })}
          </Route>
        </Route>
      </Routes>
    </>
  )
}
