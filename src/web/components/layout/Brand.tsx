import { cn } from '../../lib/cn'

/** ORSAVEN wordmark: spaced display serif with a hairline mark. Working asset — final logo pending owner approval (docs/IDENTITY_DIRECTION.md). */
export function Wordmark({ className, tone = 'dark' }: { className?: string; tone?: 'dark' | 'light' }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', tone === 'light' ? 'text-ivory-50' : 'text-forest-950', className)}>
      <Mark className="size-6" />
      <span className="font-display text-[1.15rem] font-medium tracking-[0.32em]" style={{ fontVariationSettings: "'opsz' 144, 'SOFT' 0" }}>
        ORSAVEN
      </span>
    </span>
  )
}

export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" fill="none">
      <circle cx="16" cy="16" r="14.25" stroke="currentColor" strokeWidth="1.5" />
      <path d="M16 5.5v21" stroke="var(--color-brass-500)" strokeWidth="1.5" />
      <circle cx="16" cy="16" r="6.25" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}
