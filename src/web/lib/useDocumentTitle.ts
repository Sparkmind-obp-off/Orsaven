import { useEffect } from 'react'

/** Keeps document.title in sync on client navigation (server injects the initial title). */
export function useDocumentTitle(title: string | null) {
  useEffect(() => {
    document.title = title ? `${title} — ORSAVEN` : 'ORSAVEN — Practical digital products, ready to put to work'
  }, [title])
}
