import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { messages, type MessageKey } from './messages'

export type Locale = 'id' | 'en'
export type Bilingual<T = string> = { id: T; en: T }

interface I18nCtx {
  locale: Locale
  setLocale: (l: Locale) => void
  t: (key: MessageKey, vars?: Record<string, string | number>) => string
  /** Pick the active-locale value from a bilingual object, falling back to the other language. */
  L: <T>(v: Bilingual<T> | null | undefined) => T
}

const Ctx = createContext<I18nCtx | null>(null)

function initialLocale(): Locale {
  if (typeof window === 'undefined') return 'id'
  const q = new URLSearchParams(window.location.search).get('lang')
  if (q === 'en' || q === 'id') return q
  const saved = window.localStorage.getItem('orsaven.locale')
  if (saved === 'en' || saved === 'id') return saved
  return navigator.language?.toLowerCase().startsWith('id') ? 'id' : 'en'
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale)
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])
  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l)
    window.localStorage.setItem('orsaven.locale', l)
  }, [])
  const value = useMemo<I18nCtx>(() => {
    const dict = messages[locale]
    return {
      locale,
      setLocale,
      t: (key, vars) => {
        let s: string = dict[key] ?? messages.en[key] ?? key
        if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
        return s
      },
      L: <T,>(v: Bilingual<T> | null | undefined) => {
        if (!v) return '' as unknown as T
        const primary = v[locale]
        const other = v[locale === 'id' ? 'en' : 'id']
        const empty = primary == null || (typeof primary === 'string' && primary.trim() === '') || (Array.isArray(primary) && primary.length === 0)
        return empty ? other : primary
      },
    }
  }, [locale, setLocale])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useI18n() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useI18n outside provider')
  return c
}
