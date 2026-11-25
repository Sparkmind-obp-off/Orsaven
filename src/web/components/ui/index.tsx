/**
 * ORSAVEN design-system primitives. See docs/DESIGN_SYSTEM.md.
 * Restrained: hairline borders, small radii, typographic hierarchy over decoration.
 */
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { Link, type LinkProps } from 'react-router'
import { cn } from '../../lib/cn'
import { useI18n } from '../../i18n'

/* ───────────── Button ───────────── */

type Variant = 'primary' | 'secondary' | 'ghost' | 'inverse' | 'danger' | 'link'
type Size = 'sm' | 'md' | 'lg'

const base =
  'inline-flex items-center justify-center gap-2 font-medium tracking-[0.005em] whitespace-nowrap transition-[background-color,color,box-shadow,transform] duration-200 ease-(--ease-out-quart) disabled:pointer-events-none disabled:opacity-45 select-none'
const variants: Record<Variant, string> = {
  primary: 'bg-forest-900 text-ivory-50 hover:bg-forest-700 active:translate-y-px rounded-sm',
  secondary: 'bg-transparent text-forest-950 shadow-[inset_0_0_0_1px_rgb(19_34_27/0.28)] hover:shadow-[inset_0_0_0_1px_rgb(19_34_27/0.9)] hover:bg-ivory-100 rounded-sm',
  ghost: 'text-forest-900 hover:bg-ink/5 rounded-sm',
  inverse: 'bg-ivory-50 text-forest-950 hover:bg-brass-300 rounded-sm',
  danger: 'bg-danger text-white hover:brightness-110 rounded-sm',
  link: 'text-forest-800 underline underline-offset-4 decoration-1 hover:text-forest-600 px-0!',
}
const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-[0.8125rem]',
  md: 'h-10 px-4.5 text-sm',
  lg: 'h-12 px-6 text-[0.9375rem]',
}

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', extra?: string) {
  return cn(base, variants[variant], sizes[size], extra)
}

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean }>(
  function Button({ variant = 'primary', size = 'md', loading, className, children, disabled, type = 'button', ...rest }, ref) {
    return (
      <button ref={ref} type={type} className={buttonClass(variant, size, className)} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
        {loading && <Spinner className="size-3.5" />}
        {children}
      </button>
    )
  },
)

export function ButtonLink({ variant = 'primary', size = 'md', className, ...rest }: LinkProps & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...rest} />
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn('animate-spin', className ?? 'size-4')} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

/* ───────────── Icons (minimal, stroke-only) ───────────── */

const ICONS = {
  arrowRight: 'M5 12h14M13 6l6 6-6 6',
  arrowLeft: 'M19 12H5M11 6l-6 6 6 6',
  chevronDown: 'M6 9l6 6 6-6',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm9 3-4.35-4.35',
  close: 'M6 6l12 12M18 6 6 18',
  menu: 'M4 7h16M4 12h16M4 17h10',
  check: 'M5 12.5l4.5 4.5L19 7',
  download: 'M12 4v11m0 0 4.5-4.5M12 15l-4.5-4.5M5 20h14',
  plus: 'M12 5v14M5 12h14',
  filter: 'M4 6h16M7 12h10M10 18h4',
  alert: 'M12 8v5m0 3.5v.01M10.3 3.9 2.6 17.2A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.8L13.7 3.9a2 2 0 0 0-3.4 0Z',
  external: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  file: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Zm0 0v5h5',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0 0c2.5-2.5 3.5-5.5 3.5-9S14.5 5.5 12 3m0 18c-2.5-2.5-3.5-5.5-3.5-9S9.5 5.5 12 3M3.5 9h17m-17 6h17',
} as const

export function Icon({ name, className, label }: { name: keyof typeof ICONS; className?: string; label?: string }) {
  return (
    <svg className={cn('shrink-0', className ?? 'size-4')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <path d={ICONS[name]} />
    </svg>
  )
}

/* ───────────── Form controls ───────────── */

const fieldBase =
  'w-full bg-white text-ink placeholder:text-stone-500/70 rounded-sm shadow-[inset_0_0_0_1px_rgb(22_26_24/0.16)] transition-shadow duration-150 hover:shadow-[inset_0_0_0_1px_rgb(22_26_24/0.32)] focus:outline-none focus-visible:outline-none focus:shadow-[inset_0_0_0_1.5px_var(--color-forest-700),0_0_0_3px_rgb(51_90_71/0.12)] aria-[invalid=true]:shadow-[inset_0_0_0_1.5px_var(--color-danger)] disabled:bg-ivory-100 disabled:opacity-70'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn(fieldBase, 'h-10 px-3 text-sm', className)} {...rest} />
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cn(fieldBase, 'min-h-28 px-3 py-2.5 text-sm leading-relaxed', className)} {...rest} />
})

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...rest }, ref) {
  return (
    <div className="relative">
      <select ref={ref} className={cn(fieldBase, 'h-10 appearance-none pl-3 pr-9 text-sm', className)} {...rest}>
        {children}
      </select>
      <Icon name="chevronDown" className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-stone-500" />
    </div>
  )
})

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: ReactNode
  hint?: ReactNode
  error?: string | null
  required?: boolean
  children: (props: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean; required?: boolean }) => ReactNode
  className?: string
}) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errId = error ? `${id}-err` : undefined
  const describedBy = [hintId, errId].filter(Boolean).join(' ') || undefined
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-[0.8125rem] font-medium text-forest-950">
        {label}
        {required && (
          <span className="ml-0.5 text-danger" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined, required })}
      {hint && !error && (
        <p id={hintId} className="text-xs leading-relaxed text-stone-600">
          {hint}
        </p>
      )}
      {error && (
        <p id={errId} className="text-xs font-medium text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

export function Checkbox({ label, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  const id = useId()
  return (
    <div className={cn('flex items-start gap-3', className)}>
      <input id={id} type="checkbox" className="mt-0.5 size-4 shrink-0 cursor-pointer accent-forest-800" {...rest} />
      <label htmlFor={id} className="cursor-pointer text-sm leading-relaxed text-ink/80">
        {label}
      </label>
    </div>
  )
}

/* ───────────── Badges ───────────── */

type Tone = 'neutral' | 'forest' | 'sage' | 'brass' | 'success' | 'warning' | 'danger' | 'outline'
const tones: Record<Tone, string> = {
  neutral: 'bg-ink/[0.06] text-ink/75',
  forest: 'bg-forest-900 text-ivory-50',
  sage: 'bg-sage-200/70 text-sage-700',
  brass: 'bg-brass-300/35 text-brass-700',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/12 text-warning',
  danger: 'bg-danger/10 text-danger',
  outline: 'shadow-[inset_0_0_0_1px_currentColor] text-forest-800',
}

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cn('inline-flex h-5.5 items-center gap-1 rounded-xs px-2 text-[0.6875rem] font-semibold uppercase tracking-[0.08em]', tones[tone], className)}>{children}</span>
}

const STATUS_TONE: Record<string, Tone> = {
  draft: 'neutral',
  review: 'warning',
  published: 'success',
  archived: 'neutral',
  unavailable: 'danger',
  pending_payment: 'warning',
  paid: 'success',
  completed: 'success',
  cancelled: 'neutral',
  failed: 'danger',
  refunded: 'brass',
  new: 'brass',
  in_review: 'warning',
  responded: 'success',
  closed: 'neutral',
  spam: 'danger',
  approved: 'success',
  verified: 'success',
  pending: 'warning',
  released: 'success',
  deprecated: 'neutral',
}

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return <Badge tone={STATUS_TONE[status] ?? 'neutral'}>{label ?? status.replace(/_/g, ' ')}</Badge>
}

/* ───────────── Feedback states ───────────── */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton rounded-xs', className)} aria-hidden="true" />
}

export function LoadingBlock({ label, rows = 3 }: { label?: string; rows?: number }) {
  const { t } = useI18n()
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-3 py-6">
      <span className="sr-only">{label ?? t('common.loading')}</span>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className={cn('h-4', i === rows - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  )
}

export function EmptyState({ title, body, action, className }: { title: ReactNode; body?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-start gap-3 border-t border-ink/10 py-12', className)}>
      <span className="block h-px w-10 bg-brass-500" aria-hidden="true" />
      <h3 className="font-display text-display-sm text-forest-950">{title}</h3>
      {body && <p className="max-w-lg text-sm leading-relaxed text-stone-600">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  const { t } = useI18n()
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-sm bg-danger/[0.05] px-5 py-5 shadow-[inset_0_0_0_1px_rgb(154_47_42/0.2)]">
      <div className="flex items-center gap-2 text-sm font-semibold text-danger">
        <Icon name="alert" />
        {t('common.error')}
      </div>
      {message && <p className="text-sm text-ink/75">{message}</p>}
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {t('common.retry')}
        </Button>
      )}
    </div>
  )
}

export function Notice({ tone = 'neutral', title, children }: { tone?: 'neutral' | 'warning' | 'success' | 'danger'; title?: ReactNode; children: ReactNode }) {
  const map = {
    neutral: 'bg-ivory-100 border-sage-400 text-forest-900',
    warning: 'bg-warning/[0.07] border-warning text-ink',
    success: 'bg-success/[0.07] border-success text-ink',
    danger: 'bg-danger/[0.06] border-danger text-ink',
  }
  return (
    <div className={cn('border-l-2 px-4 py-3 text-sm leading-relaxed', map[tone])} role={tone === 'danger' ? 'alert' : 'note'}>
      {title && <p className="mb-0.5 font-semibold">{title}</p>}
      {children}
    </div>
  )
}

/* ───────────── Tabs ───────────── */

export function Tabs<T extends string>({ tabs, value, onChange, label }: { tabs: { value: T; label: ReactNode }[]; value: T; onChange: (v: T) => void; label: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  return (
    <div role="tablist" aria-label={label} className="flex gap-6 overflow-x-auto border-b border-ink/10">
      {tabs.map((tab, i) => {
        const active = tab.value === value
        return (
          <button
            key={tab.value}
            ref={(el) => {
              refs.current[i] = el
            }}
            role="tab"
            type="button"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(tab.value)}
            onKeyDown={(e) => {
              if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
              const n = (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
              refs.current[n]?.focus()
              onChange(tabs[n].value)
            }}
            className={cn('-mb-px whitespace-nowrap border-b-2 pb-3 pt-1 text-sm font-medium transition-colors', active ? 'border-forest-900 text-forest-950' : 'border-transparent text-stone-600 hover:text-forest-900')}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

/* ───────────── Dropdown menu ───────────── */

export function Dropdown({ trigger, children, align = 'right', label }: { trigger: (p: { open: boolean; toggle: () => void; id: string }) => ReactNode; children: (close: () => void) => ReactNode; align?: 'left' | 'right'; label: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const id = useId()
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    // focus first item
    requestAnimationFrame(() => ref.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus())
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  return (
    <div className="relative" ref={ref}>
      {trigger({ open, toggle: () => setOpen((o) => !o), id })}
      {open && (
        <div
          id={id}
          role="menu"
          aria-label={label}
          onKeyDown={(e) => {
            const items = [...(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])]
            const i = items.indexOf(document.activeElement as HTMLElement)
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              items[(i + 1) % items.length]?.focus()
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              items[(i - 1 + items.length) % items.length]?.focus()
            }
          }}
          className={cn('animate-fade-up absolute top-full z-50 mt-2 min-w-56 rounded-sm bg-ivory-50 p-1.5 shadow-(--shadow-lift)', align === 'right' ? 'right-0' : 'left-0')}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}

export const menuItemClass = 'flex w-full items-center gap-2 rounded-xs px-3 py-2 text-left text-sm text-forest-950 hover:bg-ink/5 focus:bg-ink/5 focus:outline-none'

/* ───────────── Dialog ───────────── */

export function Dialog({ open, onClose, title, children, footer, size = 'md' }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; size?: 'md' | 'lg' }) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
      className={cn('m-auto w-[calc(100%-2rem)] rounded-sm bg-ivory-50 p-0 text-ink shadow-(--shadow-lift) backdrop:bg-forest-950/55 backdrop:backdrop-blur-[2px]', size === 'lg' ? 'max-w-2xl' : 'max-w-lg')}
    >
      {open && (
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-ink/10 px-6 py-4">
            <h2 id={titleId} className="font-display text-xl text-forest-950">
              {title}
            </h2>
            <button type="button" onClick={onClose} className="-mr-2 rounded-xs p-1.5 text-stone-600 hover:bg-ink/5" aria-label="Close">
              <Icon name="close" />
            </button>
          </div>
          <div className="overflow-y-auto px-6 py-5">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-ink/10 px-6 py-4">{footer}</div>}
        </div>
      )}
    </dialog>
  )
}

/** Promise-free confirm dialog helper. */
export function ConfirmDialog({ open, title, body, confirmLabel, onConfirm, onClose, tone = 'primary', loading }: { open: boolean; title: string; body: ReactNode; confirmLabel: string; onConfirm: () => void; onClose: () => void; tone?: 'primary' | 'danger'; loading?: boolean }) {
  const { t } = useI18n()
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant={tone} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm leading-relaxed text-ink/80">{body}</div>
    </Dialog>
  )
}

/* ───────────── Table ───────────── */

export function Table({ children, caption }: { children: ReactNode; caption?: string }) {
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        {children}
      </table>
    </div>
  )
}
export const th = 'border-b border-ink/15 pb-2.5 pt-1 pr-4 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-stone-600'
export const td = 'border-b border-ink/[0.07] py-3 pr-4 align-top'

/* ───────────── Pagination ───────────── */

export function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  const { t } = useI18n()
  if (totalPages <= 1) return null
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-4 border-t border-ink/10 pt-5">
      <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        <Icon name="arrowLeft" className="size-3.5" />
        {t('common.previous')}
      </Button>
      <span className="text-xs tabular-nums text-stone-600" aria-current="page">
        {t('common.page', { p: page, n: totalPages })}
      </span>
      <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
        {t('common.next')}
        <Icon name="arrowRight" className="size-3.5" />
      </Button>
    </nav>
  )
}

/* ───────────── Toasts ───────────── */

interface Toast {
  id: number
  tone: 'success' | 'error' | 'info'
  message: string
}
const ToastCtx = createContext<{ push: (tone: Toast['tone'], message: string) => void } | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const push = useCallback((tone: Toast['tone'], message: string) => {
    const id = Date.now() + Math.random()
    setToasts((ts) => [...ts.slice(-3), { id, tone, message }])
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), tone === 'error' ? 7000 : 4200)
  }, [])
  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div aria-live="polite" aria-atomic="false" className="pointer-events-none fixed inset-x-4 bottom-4 z-[90] flex flex-col items-end gap-2 sm:left-auto sm:right-6 sm:bottom-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className={cn(
              'animate-fade-up pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-sm px-4 py-3 text-sm shadow-(--shadow-lift)',
              t.tone === 'error' ? 'bg-danger text-white' : t.tone === 'success' ? 'bg-forest-900 text-ivory-50' : 'bg-ivory-50 text-ink',
            )}
          >
            <Icon name={t.tone === 'error' ? 'alert' : 'check'} className="mt-0.5 size-4" />
            <span className="flex-1 leading-snug">{t.message}</span>
            <button type="button" className="opacity-70 hover:opacity-100" aria-label="Dismiss" onClick={() => setToasts((ts) => ts.filter((x) => x.id !== t.id))}>
              <Icon name="close" className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export function useToast() {
  const c = useContext(ToastCtx)
  if (!c) throw new Error('useToast outside provider')
  return c
}

/* ───────────── Section helpers ───────────── */

export function SectionHeading({ eyebrow, title, body, align = 'left', action, as: As = 'h2' }: { eyebrow?: ReactNode; title: ReactNode; body?: ReactNode; align?: 'left' | 'center'; action?: ReactNode; as?: 'h1' | 'h2' }) {
  return (
    <div className={cn('flex flex-col gap-4 md:flex-row md:items-end md:justify-between', align === 'center' && 'items-center text-center md:flex-col md:items-center')}>
      <div className={cn('flex max-w-3xl flex-col gap-4', align === 'center' && 'items-center')}>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <As className={cn('text-balance text-display-md', As === 'h1' && 'text-display-lg')}>{title}</As>
        {body && <p className="max-w-2xl text-pretty text-base leading-relaxed text-stone-600">{body}</p>}
      </div>
      {action}
    </div>
  )
}

export function PageHeader({ title, description, actions, breadcrumb }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; breadcrumb?: ReactNode }) {
  return (
    <header className="flex flex-col gap-4 border-b border-ink/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-2">
        {breadcrumb}
        <h1 className="font-display text-display-sm text-forest-950">{title}</h1>
        {description && <p className="max-w-2xl text-sm leading-relaxed text-stone-600">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  )
}

export function StatCard({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 bg-white px-5 py-4 hairline rounded-sm">
      <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-stone-600">{label}</span>
      <span className="font-display text-3xl tabular-nums text-forest-950">{value}</span>
      {hint && <span className="text-xs text-stone-600">{hint}</span>}
    </div>
  )
}
