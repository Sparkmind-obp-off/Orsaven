import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ClerkProvider, useAuth, useClerk } from '@clerk/clerk-react'
import { useNavigate } from 'react-router'
import { api, setTokenGetter } from './api'

export interface RuntimeConfig {
  clerkPublishableKey: string | null
  clerkFrontendApi: string | null
  authConfigured: boolean
  paymentsConfigured: boolean
  environment: string
  settings: Record<string, unknown>
}

export interface Me {
  id: number
  email: string | null
  role: 'super_admin' | 'administrator' | 'customer'
  permissions: string[]
  createdAt: string
  profile: { displayName: string; company: string; phone: string; country: string; locale: 'id' | 'en'; onboardedAt: string | null }
}

interface SessionCtx {
  config: RuntimeConfig | null
  authAvailable: boolean
  loaded: boolean
  signedIn: boolean
  me: Me | null
  meError: string | null
  refreshMe: () => Promise<void>
  signOut: () => Promise<void>
  openSecurity: () => void
  can: (permission: string) => boolean
}

const Ctx = createContext<SessionCtx | null>(null)

const appearance = {
  variables: {
    colorPrimary: '#13221b',
    colorText: '#161a18',
    colorTextSecondary: '#56554e',
    colorBackground: '#fbf8f1',
    colorInputBackground: '#ffffff',
    colorDanger: '#9a2f2a',
    colorSuccess: '#2f6b47',
    fontFamily: "'Inter Variable', ui-sans-serif, system-ui, sans-serif",
    borderRadius: '4px',
  },
  elements: {
    card: { boxShadow: '0 0 0 1px rgb(13 24 19 / 0.08), 0 22px 44px -24px rgb(13 24 19 / 0.35)' },
    headerTitle: { fontFamily: "'Fraunces Variable', Georgia, serif", fontWeight: 500, letterSpacing: '-0.01em' },
    formButtonPrimary: { textTransform: 'none', fontWeight: 600 },
  },
}

function ClerkBridge({ config, children }: { config: RuntimeConfig; children: ReactNode }) {
  const { isLoaded, isSignedIn, getToken } = useAuth()
  const clerk = useClerk()
  const [me, setMe] = useState<Me | null>(null)
  const [meError, setMeError] = useState<string | null>(null)
  const [meLoaded, setMeLoaded] = useState(false)

  useEffect(() => {
    setTokenGetter(isSignedIn ? () => getToken() : null)
    return () => setTokenGetter(null)
  }, [isSignedIn, getToken])

  const refreshMe = useCallback(async () => {
    try {
      const r = await api<Me>('/account')
      setMe(r.data)
      setMeError(null)
    } catch (e) {
      setMe(null)
      setMeError((e as Error).message)
    } finally {
      setMeLoaded(true)
    }
  }, [])

  useEffect(() => {
    if (!isLoaded) return
    if (isSignedIn) {
      setMeLoaded(false)
      void refreshMe()
    } else {
      setMe(null)
      setMeLoaded(true)
    }
  }, [isLoaded, isSignedIn, refreshMe])

  const value = useMemo<SessionCtx>(
    () => ({
      config,
      authAvailable: true,
      loaded: isLoaded && meLoaded,
      signedIn: !!isSignedIn,
      me,
      meError,
      refreshMe,
      signOut: async () => {
        await clerk.signOut({ redirectUrl: '/' })
      },
      openSecurity: () => clerk.openUserProfile(),
      can: (p) => !!me?.permissions.includes(p),
    }),
    [config, isLoaded, meLoaded, isSignedIn, me, meError, refreshMe, clerk],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

function NoAuth({ config, children }: { config: RuntimeConfig | null; children: ReactNode }) {
  const value = useMemo<SessionCtx>(
    () => ({
      config,
      authAvailable: false,
      loaded: config !== null,
      signedIn: false,
      me: null,
      meError: null,
      refreshMe: async () => {},
      signOut: async () => {},
      openSecurity: () => {},
      can: () => false,
    }),
    [config],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

/** Loads public runtime config, then mounts Clerk (production instance) when a publishable key is present. */
export function SessionProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const [config, setConfig] = useState<RuntimeConfig | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    api<RuntimeConfig>('/config')
      .then((r) => setConfig(r.data))
      .catch(() => setFailed(true))
  }, [])
  if (failed || (config && !config.clerkPublishableKey)) return <NoAuth config={config ?? { clerkPublishableKey: null, clerkFrontendApi: null, authConfigured: false, paymentsConfigured: false, environment: 'unknown', settings: {} }}>{children}</NoAuth>
  if (!config) return <NoAuth config={null}>{children}</NoAuth>
  return (
    <ClerkProvider
      publishableKey={config.clerkPublishableKey!}
      routerPush={(to) => navigate(to)}
      routerReplace={(to) => navigate(to, { replace: true })}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/account"
      signUpFallbackRedirectUrl="/onboarding"
      afterSignOutUrl="/"
      appearance={appearance}
    >
      <ClerkBridge config={config}>{children}</ClerkBridge>
    </ClerkProvider>
  )
}

export function useSession() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useSession outside provider')
  return c
}
