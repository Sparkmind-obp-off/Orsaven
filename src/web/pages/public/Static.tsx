import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { FAMILIES, LEGAL_SLUGS, SERVICE_TYPES } from '../../../shared/domain'
import { useI18n, type Bilingual } from '../../i18n'
import { api, ApiClientError, errorMessage, useApi } from '../../lib/api'
import { formatDate } from '../../lib/cn'
import { Markdown } from '../../lib/markdown'
import { useSession } from '../../lib/session'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import { Button, ButtonLink, Checkbox, ErrorState, Field, Icon, Input, LoadingBlock, Notice, Select, Textarea } from '../../components/ui'
import { ABOUT, FAQ, QUALITY_GATES } from '../../content'
import { FaqList } from './Home'
import NotFound from './NotFound'

function PageIntro({ eyebrow, title, lead }: { eyebrow?: string; title: string; lead?: string }) {
  return (
    <section className="border-b border-ink/10 bg-ivory-100">
      <div className="container-site flex flex-col gap-5 pb-12 pt-14 lg:pb-16 lg:pt-20">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="max-w-4xl text-balance text-display-lg font-light text-forest-950">{title}</h1>
        {lead && <p className="max-w-2xl text-lg leading-relaxed text-stone-600">{lead}</p>}
      </div>
    </section>
  )
}

/* ───────────── About ───────────── */

export function About() {
  const { t, L } = useI18n()
  useDocumentTitle(t('about.title'))
  return (
    <>
      <PageIntro eyebrow={t('hero.eyebrow')} title={t('about.title')} lead={L(ABOUT.lead)} />
      <div className="container-site grid gap-14 py-16 lg:grid-cols-12 lg:py-20">
        <div className="flex flex-col gap-12 lg:col-span-7">
          {ABOUT.sections.map((s, i) => (
            <section key={i} className="flex flex-col gap-4 border-t border-forest-900 pt-5">
              <h2 className="font-display text-display-sm text-forest-950">{L(s.title)}</h2>
              {'body' in s && s.body && <p className="text-[1.0625rem] leading-relaxed text-ink/85">{L(s.body)}</p>}
              {'list' in s && s.list && (
                <ul className="flex flex-col gap-2.5">
                  {L(s.list).map((x, j) => (
                    <li key={j} className="flex gap-3 text-[1.0625rem] leading-relaxed text-ink/85">
                      <span className="mt-3 h-px w-4 shrink-0 bg-brass-500" aria-hidden="true" />
                      {x}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
        <aside className="lg:col-span-5">
          <div className="dark-surface flex flex-col gap-6 rounded-sm bg-forest-950 p-8 text-ivory-50 lg:sticky lg:top-28">
            <p className="eyebrow">{t('home.principles.eyebrow')}</p>
            <ol className="flex flex-col">
              {L(ABOUT.principles).map((x, i) => (
                <li key={i} className="flex gap-4 border-b border-ivory-50/10 py-3 last:border-0">
                  <span className="font-display text-sm tabular-nums text-brass-400">{String(i + 1).padStart(2, '0')}</span>
                  <span className="text-[0.9375rem] text-ivory-100/90">{x}</span>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>
    </>
  )
}

/* ───────────── How it works ───────────── */

export function HowItWorks() {
  const { t, L, locale } = useI18n()
  useDocumentTitle(t('nav.how'))
  const maturity = ['concept', 'prototype', 'beta', 'available', 'retired'] as const
  const maturityBody: Record<(typeof maturity)[number], Bilingual> = {
    concept: { id: 'Belum tersedia untuk dibeli.', en: 'Not available for purchase.' },
    prototype: { id: 'Eksperimental; tidak untuk ketergantungan produksi.', en: 'Experimental; not for production reliance.' },
    beta: { id: 'Rilis terbatas dengan batasan yang dinyatakan.', en: 'Limited release with stated constraints.' },
    available: { id: 'Proses pengiriman telah diuji dan dukungan ditetapkan.', en: 'Delivery process tested and support defined.' },
    retired: { id: 'Tidak dijual lagi; kebijakan dukungan dan migrasi dinyatakan.', en: 'No longer sold; support and migration policy stated.' },
  }
  return (
    <>
      <PageIntro eyebrow={t('home.how.eyebrow')} title={t('home.how.title')} />
      <section className="container-site py-16 lg:py-20">
        <ol className="grid gap-px overflow-hidden rounded-sm bg-ink/10 hairline md:grid-cols-2 lg:grid-cols-4">
          {(['s1', 's2', 's3', 's4'] as const).map((s, i) => (
            <li key={s} className="flex flex-col gap-3 bg-ivory-50 p-7">
              <span className="font-display text-4xl font-light text-brass-500">{String(i + 1).padStart(2, '0')}</span>
              <h2 className="font-display text-xl text-forest-950">{t(`home.how.${s}.title`)}</h2>
              <p className="text-sm leading-relaxed text-stone-600">{t(`home.how.${s}.body`)}</p>
            </li>
          ))}
        </ol>
      </section>
      <section className="border-y border-ink/10 bg-ivory-100">
        <div className="container-site grid gap-12 py-16 lg:grid-cols-12 lg:py-20">
          <div className="flex flex-col gap-4 lg:col-span-5">
            <p className="eyebrow">{locale === 'id' ? 'Label kematangan' : 'Maturity labels'}</p>
            <h2 className="text-display-md text-forest-950">{locale === 'id' ? 'Setiap produk diberi label yang jujur.' : 'Every product carries an honest label.'}</h2>
          </div>
          <dl className="flex flex-col lg:col-span-7">
            {maturity.map((m) => (
              <div key={m} className="grid grid-cols-[8rem_1fr] gap-4 border-b border-ink/10 py-4">
                <dt className="font-display text-lg text-forest-950">{t(`maturity.${m}`)}</dt>
                <dd className="text-sm leading-relaxed text-stone-600">{L(maturityBody[m])}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
      <section className="container-site grid gap-12 py-16 lg:grid-cols-12 lg:py-20">
        <div className="flex flex-col gap-4 lg:col-span-5">
          <p className="eyebrow">{t('home.principles.eyebrow')}</p>
          <h2 className="text-display-md text-forest-950">{locale === 'id' ? 'Gerbang kualitas sebelum “Tersedia”.' : 'Quality gates before “Available”.'}</h2>
        </div>
        <ul className="flex flex-col gap-3 lg:col-span-7">
          {L(QUALITY_GATES).map((g, i) => (
            <li key={i} className="flex gap-3 text-[1.0625rem] leading-relaxed text-ink/85">
              <Icon name="check" className="mt-1.5 size-4 text-sage-500" />
              {g}
            </li>
          ))}
        </ul>
      </section>
      <section className="container-site pb-20">
        <div className="grid gap-px overflow-hidden rounded-sm bg-ink/10 hairline sm:grid-cols-2 lg:grid-cols-4">
          {FAMILIES.map((f) => (
            <Link key={f.key} to={`/catalog/${f.slug}`} className="group flex flex-col gap-2 bg-white p-6 hover:bg-ivory-100">
              <span className="font-display text-lg text-forest-950">{L(f.name)}</span>
              <span className="text-xs leading-relaxed text-stone-600">{L(f.tagline)}</span>
              <Icon name="arrowRight" className="mt-3 size-4 text-forest-800 transition-transform group-hover:translate-x-1" />
            </Link>
          ))}
        </div>
      </section>
    </>
  )
}

/* ───────────── FAQ ───────────── */

export function Faq() {
  const { t } = useI18n()
  useDocumentTitle(t('faq.title'))
  return (
    <>
      <PageIntro eyebrow="FAQ" title={t('faq.title')} />
      <div className="container-site grid gap-12 py-16 lg:grid-cols-12 lg:py-20">
        <div className="lg:col-span-8">
          <FaqList items={FAQ} />
        </div>
        <aside className="lg:col-span-4">
          <div className="flex flex-col gap-4 rounded-sm bg-ivory-100 p-6 hairline">
            <h2 className="font-display text-xl text-forest-950">{t('product.ask')}</h2>
            <p className="text-sm leading-relaxed text-stone-600">{t('contact.subtitle')}</p>
            <ButtonLink to="/contact">{t('nav.contact')}</ButtonLink>
          </div>
        </aside>
      </div>
    </>
  )
}

/* ───────────── Contact / inquiries ───────────── */

export function Contact() {
  const { t, locale } = useI18n()
  const [params] = useSearchParams()
  const { me } = useSession()
  useDocumentTitle(t('contact.title'))
  const initialType = (SERVICE_TYPES as readonly string[]).includes(params.get('type') ?? '') ? (params.get('type') as string) : 'product_question'
  const productSlug = params.get('product') ?? undefined
  const [form, setForm] = useState({ name: '', email: '', company: '', serviceType: initialType, budgetRange: '', message: '', consent: false, website: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    if (me) setForm((f) => ({ ...f, email: f.email || me.email || '', name: f.name || me.profile.displayName || '' }))
  }, [me])

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const validate = () => {
    const e: Record<string, string> = {}
    const req = locale === 'id' ? 'Wajib diisi.' : 'This field is required.'
    if (form.name.trim().length < 2) e.name = req
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = locale === 'id' ? 'Masukkan email yang valid.' : 'Enter a valid email address.'
    if (form.message.trim().length < 20) e.message = locale === 'id' ? 'Minimal 20 karakter.' : 'At least 20 characters.'
    if (!form.consent) e.consent = req
    setErrors(e)
    return Object.keys(e).length === 0
  }
  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    setServerError(null)
    if (!validate()) return
    setBusy(true)
    try {
      const r = await api<{ publicId: string }>('/inquiries', { method: 'POST', body: { ...form, consent: true, productSlug, locale } })
      setDone(r.data.publicId)
    } catch (e) {
      if (e instanceof ApiClientError && e.code === 'validation_failed' && Array.isArray(e.details)) {
        const map: Record<string, string> = {}
        for (const d of e.details as { path: string; message: string }[]) map[d.path] = d.message
        setErrors(map)
      }
      setServerError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageIntro eyebrow={t('nav.contact')} title={t('contact.title')} lead={t('contact.subtitle')} />
      <div className="container-site grid gap-12 py-14 lg:grid-cols-12 lg:py-20">
        <div className="lg:col-span-7">
          {done ? (
            <div role="status" className="flex flex-col items-start gap-4 rounded-sm bg-white p-8 hairline">
              <span className="grid size-10 place-items-center rounded-full bg-forest-900 text-ivory-50">
                <Icon name="check" />
              </span>
              <h2 className="font-display text-display-sm text-forest-950">{t('contact.success.title')}</h2>
              <p className="text-stone-600">{t('contact.success.body', { id: done })}</p>
              <Button
                variant="secondary"
                onClick={() => {
                  setDone(null)
                  setForm((f) => ({ ...f, message: '', consent: false }))
                }}
              >
                {t('contact.another')}
              </Button>
            </div>
          ) : (
            <form noValidate onSubmit={submit} className="flex flex-col gap-5" aria-describedby={serverError ? 'contact-error' : undefined}>
              {productSlug && (
                <Notice>
                  {t('contact.product')}: <strong>{productSlug}</strong>
                </Notice>
              )}
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label={t('contact.name')} required error={errors.name}>
                  {(p) => <Input {...p} autoComplete="name" value={form.name} onChange={set('name')} maxLength={120} />}
                </Field>
                <Field label={t('contact.email')} required error={errors.email}>
                  {(p) => <Input {...p} type="email" autoComplete="email" value={form.email} onChange={set('email')} maxLength={200} />}
                </Field>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label={t('contact.company')} error={errors.company}>
                  {(p) => <Input {...p} autoComplete="organization" value={form.company} onChange={set('company')} maxLength={160} />}
                </Field>
                <Field label={t('contact.type')} required error={errors.serviceType}>
                  {(p) => (
                    <Select {...p} value={form.serviceType} onChange={set('serviceType')}>
                      {SERVICE_TYPES.map((s) => (
                        <option key={s} value={s}>
                          {t(`service.${s}`)}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              </div>
              <Field label={t('contact.budget')} error={errors.budgetRange}>
                {(p) => (
                  <Select {...p} value={form.budgetRange} onChange={set('budgetRange')}>
                    <option value="">—</option>
                    <option value="lt_5m">&lt; Rp5.000.000</option>
                    <option value="5m_20m">Rp5.000.000 – Rp20.000.000</option>
                    <option value="20m_50m">Rp20.000.000 – Rp50.000.000</option>
                    <option value="gt_50m">&gt; Rp50.000.000</option>
                    <option value="unsure">{locale === 'id' ? 'Belum tahu' : 'Not sure yet'}</option>
                  </Select>
                )}
              </Field>
              <Field label={t('contact.message')} required hint={t('contact.messageHint')} error={errors.message}>
                {(p) => <Textarea {...p} rows={7} value={form.message} onChange={set('message')} maxLength={5000} />}
              </Field>
              {/* Honeypot — hidden from people and assistive tech */}
              <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                <label>
                  Website
                  <input tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} />
                </label>
              </div>
              <div>
                <Checkbox checked={form.consent} onChange={(e) => setForm((f) => ({ ...f, consent: e.target.checked }))} label={t('contact.consent')} aria-invalid={errors.consent ? true : undefined} />
                {errors.consent && (
                  <p className="mt-1 pl-7 text-xs font-medium text-danger" role="alert">
                    {errors.consent}
                  </p>
                )}
              </div>
              {serverError && (
                <p id="contact-error" role="alert" className="text-sm font-medium text-danger">
                  {serverError}
                </p>
              )}
              <div>
                <Button type="submit" size="lg" loading={busy}>
                  {busy ? t('contact.sending') : t('contact.submit')}
                </Button>
              </div>
            </form>
          )}
        </div>
        <aside className="flex flex-col gap-6 lg:col-span-5">
          <div className="flex flex-col gap-3 border-t border-forest-900 pt-5">
            <h2 className="font-display text-xl text-forest-950">{t('home.services.eyebrow')}</h2>
            <p className="text-sm leading-relaxed text-stone-600">{t('home.services.body')}</p>
          </div>
          <div className="flex flex-col gap-3 border-t border-forest-900 pt-5">
            <h2 className="font-display text-xl text-forest-950">{t('nav.faq')}</h2>
            <Link to="/faq" className="link-underline w-fit text-sm font-medium text-forest-800">
              {t('home.faq.more')} →
            </Link>
          </div>
        </aside>
      </div>
    </>
  )
}

/* ───────────── Legal (DRAFT) ───────────── */

interface LegalDoc {
  slug: string
  title: Bilingual
  body: Bilingual
  status: 'draft' | 'approved'
  version: number
  updatedAt: string
  approvedAt: string | null
}

export function Legal() {
  const { slug } = useParams()
  const { t, L, locale } = useI18n()
  const valid = (LEGAL_SLUGS as readonly string[]).includes(slug ?? '')
  const doc = useApi<LegalDoc>(valid ? `/legal/${slug}` : null)
  useDocumentTitle(doc.data ? L(doc.data.title) : null)
  if (!valid) return <NotFound />
  return (
    <>
      <PageIntro eyebrow={t('footer.legal')} title={doc.data ? L(doc.data.title) : t('common.loading')} />
      <div className="container-site grid gap-10 py-14 lg:grid-cols-12 lg:py-16">
        <div className="lg:col-span-8">
          {doc.loading ? (
            <LoadingBlock rows={8} />
          ) : doc.error ? (
            <ErrorState message={doc.error.message} onRetry={doc.reload} />
          ) : doc.data ? (
            <>
              {doc.data.status !== 'approved' && (
                <div className="mb-8">
                  <Notice tone="warning" title="DRAFT">
                    {t('legal.draftBanner')}
                  </Notice>
                </div>
              )}
              <Markdown source={L(doc.data.body)} />
            </>
          ) : null}
        </div>
        <aside className="lg:col-span-4">
          {doc.data && (
            <dl className="flex flex-col gap-3 border-t border-forest-900 pt-5 text-sm">
              <div className="flex justify-between">
                <dt className="text-stone-600">{t('common.status')}</dt>
                <dd className="font-semibold uppercase tracking-wider text-warning">{doc.data.status}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-stone-600">{t('legal.version', { v: '' }).trim()}</dt>
                <dd className="tabular-nums">{doc.data.version}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-stone-600">{t('product.updated')}</dt>
                <dd>{formatDate(doc.data.updatedAt, locale)}</dd>
              </div>
            </dl>
          )}
          <nav aria-label={t('footer.legal')} className="mt-8 flex flex-col gap-2 text-sm">
            {LEGAL_SLUGS.map((s) => (
              <Link key={s} to={`/legal/${s}`} aria-current={s === slug ? 'page' : undefined} className={s === slug ? 'font-semibold text-forest-950' : 'text-stone-600 hover:text-forest-900'}>
                {s === 'privacy' ? (locale === 'id' ? 'Kebijakan Privasi' : 'Privacy Policy') : s === 'terms' ? (locale === 'id' ? 'Ketentuan Layanan' : 'Terms of Service') : s === 'refund' ? (locale === 'id' ? 'Pengembalian Dana' : 'Refund Policy') : locale === 'id' ? 'Pengiriman' : 'Delivery Policy'}
              </Link>
            ))}
          </nav>
        </aside>
      </div>
    </>
  )
}
