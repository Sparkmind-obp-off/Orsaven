import { SignIn, SignUp } from '@clerk/clerk-react'
import { useSearchParams } from 'react-router'
import { useI18n } from '../../i18n'
import { useSession } from '../../lib/session'
import { LoadingBlock, Notice } from '../../components/ui'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import { Wordmark } from '../../components/layout/Brand'

/** Only allow same-site relative redirects (prevents open redirects). */
export function safeRedirect(v: string | null, fallback: string) {
  if (!v || !v.startsWith('/') || v.startsWith('//') || v.includes('\\')) return fallback
  return v
}

function AuthShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid min-h-[calc(100vh-4.5rem)] lg:grid-cols-2">
      <div className="dark-surface grain hidden flex-col justify-between bg-forest-950 p-12 text-ivory-50 lg:flex">
        <Wordmark tone="light" />
        <div className="flex max-w-md flex-col gap-5">
          <p className="eyebrow">ORSAVEN</p>
          <p className="font-display text-display-md font-light leading-tight">Useful products. Clear scope. Practical outcomes.</p>
        </div>
        <p className="text-xs text-ivory-100/50">orsaven.biz.id</p>
      </div>
      <div className="flex flex-col items-center justify-center gap-6 px-5 py-14">
        <h1 className="sr-only">{title}</h1>
        {children}
      </div>
    </section>
  )
}

export function SignInPage() {
  const { t } = useI18n()
  const { authAvailable, config } = useSession()
  const [params] = useSearchParams()
  useDocumentTitle(t('nav.signIn'))
  const redirect = safeRedirect(params.get('redirect_url'), '/account')
  return (
    <AuthShell title={t('auth.title.signIn')}>
      {!config ? <LoadingBlock label={t('auth.loading')} /> : authAvailable ? <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" forceRedirectUrl={redirect} /> : <Notice tone="warning">{t('auth.notConfigured')}</Notice>}
    </AuthShell>
  )
}

export function SignUpPage() {
  const { t } = useI18n()
  const { authAvailable, config } = useSession()
  useDocumentTitle(t('nav.signUp'))
  return (
    <AuthShell title={t('auth.title.signUp')}>
      {!config ? <LoadingBlock label={t('auth.loading')} /> : authAvailable ? <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" forceRedirectUrl="/onboarding" /> : <Notice tone="warning">{t('auth.notConfigured')}</Notice>}
    </AuthShell>
  )
}
