import type { Env } from './types'
import { FAMILIES, familyBySlug, LEGAL_SLUGS } from '../shared/domain'
import { many } from './lib/db'
import { getProductBySlug, serializePublic } from './services/catalog'

export interface PageMeta {
  title: string
  description: string
  canonical: string
  robots?: string
  ogType?: string
  jsonLd?: unknown[]
}

const SITE = 'ORSAVEN'
const DEFAULT_DESC =
  'ORSAVEN curates practical digital products — from ready-to-use assets and business systems to agentic solutions and implementation support.'

export const origin = (env: Env) => env.APP_ORIGIN ?? 'https://orsaven.biz.id'

const STATIC_PAGES: Record<string, { title: string; description: string }> = {
  '/': { title: 'ORSAVEN — Practical digital products, ready to put to work', description: DEFAULT_DESC },
  '/catalog': { title: 'Catalog — ORSAVEN', description: 'Browse digital assets, business & system kits, agentic solutions, and implementation services with clear scope.' },
  '/about': { title: 'About — ORSAVEN', description: 'ORSAVEN is a productization and digital product catalog brand for Indonesia and global customers.' },
  '/contact': { title: 'Contact — ORSAVEN', description: 'Ask a product question or request scoped implementation assistance.' },
  '/faq': { title: 'FAQ — ORSAVEN', description: 'Answers about products, licensing, delivery, accounts, and implementation services.' },
  '/how-it-works': { title: 'How it works — ORSAVEN', description: 'How ORSAVEN presents, delivers, and supports digital products.' },
  '/sign-in': { title: 'Sign in — ORSAVEN', description: 'Sign in to your ORSAVEN account.' },
  '/sign-up': { title: 'Create account — ORSAVEN', description: 'Create an ORSAVEN account.' },
}

const PRIVATE_PREFIXES = ['/account', '/admin', '/onboarding', '/sign-in', '/sign-up', '/checkout']

export async function metaFor(env: Env, path: string): Promise<PageMeta & { status: number }> {
  const base = origin(env)
  const canonical = `${base}${path === '/' ? '/' : path.replace(/\/$/, '')}`
  const noindex = PRIVATE_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))
  const org = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE,
    url: base,
    logo: `${base}/brand/orsaven-mark.svg`,
  }
  if (STATIC_PAGES[path]) {
    const s = STATIC_PAGES[path]
    const jsonLd: unknown[] = [org]
    if (path === '/') jsonLd.push({ '@context': 'https://schema.org', '@type': 'WebSite', name: SITE, url: base, potentialAction: { '@type': 'SearchAction', target: `${base}/catalog?q={query}`, 'query-input': 'required name=query' } })
    return { ...s, canonical, robots: noindex ? 'noindex, nofollow' : undefined, jsonLd, status: 200 }
  }
  const fam = path.match(/^\/catalog\/([a-z-]+)$/)
  if (fam) {
    const f = familyBySlug(fam[1])
    if (f) return { title: `${f.name.en} — ORSAVEN`, description: f.tagline.en, canonical, jsonLd: [org], status: 200 }
  }
  const prod = path.match(/^\/products\/([a-z0-9-]+)$/)
  if (prod) {
    const r = await getProductBySlug(env.DB, prod[1], { admin: false }).catch(() => null)
    if (!r) return { title: 'Product not found — ORSAVEN', description: DEFAULT_DESC, canonical, robots: 'noindex', status: 404 }
    const p = serializePublic(r)
    const desc = p.seo.description || p.summary.en || DEFAULT_DESC
    const ld: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': p.family === 'implementation_services' ? 'Service' : 'Product',
      name: p.title.en,
      description: desc,
      url: canonical,
      brand: { '@type': 'Brand', name: SITE },
      category: FAMILIES.find((f) => f.key === p.family)?.name.en,
    }
    if (p.purchasable && p.pricing.priceIdr != null) {
      ld.offers = { '@type': 'Offer', priceCurrency: 'IDR', price: p.pricing.priceIdr, availability: 'https://schema.org/InStock', url: canonical }
    }
    return {
      title: `${p.seo.title || p.title.en} — ORSAVEN`,
      description: desc,
      canonical,
      ogType: 'product',
      robots: p.isDemo ? 'noindex' : undefined,
      jsonLd: [org, ld],
      status: 200,
    }
  }
  const legal = path.match(/^\/legal\/([a-z]+)$/)
  if (legal && (LEGAL_SLUGS as readonly string[]).includes(legal[1])) {
    const names: Record<string, string> = { privacy: 'Privacy Policy', terms: 'Terms of Service', refund: 'Refund Policy', delivery: 'Delivery Policy' }
    return { title: `${names[legal[1]]} (Draft) — ORSAVEN`, description: `ORSAVEN ${names[legal[1]]}.`, canonical, robots: 'noindex', status: 200 }
  }
  if (noindex) return { title: 'ORSAVEN', description: DEFAULT_DESC, canonical, robots: 'noindex, nofollow', status: 200 }
  return { title: 'Page not found — ORSAVEN', description: DEFAULT_DESC, canonical, robots: 'noindex', status: 404 }
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Inject per-route meta into the SPA shell. All values are HTML-escaped; JSON-LD is `<`-escaped. */
export function injectMeta(html: string, m: PageMeta, base: string): string {
  const tags = [
    `<title>${esc(m.title)}</title>`,
    `<meta name="description" content="${esc(m.description)}">`,
    `<link rel="canonical" href="${esc(m.canonical)}">`,
    `<link rel="alternate" hreflang="id" href="${esc(m.canonical)}">`,
    `<link rel="alternate" hreflang="en" href="${esc(m.canonical)}?lang=en">`,
    `<link rel="alternate" hreflang="x-default" href="${esc(m.canonical)}">`,
    `<meta property="og:site_name" content="${SITE}">`,
    `<meta property="og:title" content="${esc(m.title)}">`,
    `<meta property="og:description" content="${esc(m.description)}">`,
    `<meta property="og:url" content="${esc(m.canonical)}">`,
    `<meta property="og:type" content="${esc(m.ogType ?? 'website')}">`,
    `<meta property="og:image" content="${esc(base)}/brand/og-image.png">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    m.robots ? `<meta name="robots" content="${esc(m.robots)}">` : '',
    ...(m.jsonLd ?? []).map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`),
  ]
    .filter(Boolean)
    .join('\n    ')
  return html.replace(/<title>[\s\S]*?<\/title>/, '').replace('<!--app-head-->', tags)
}

export async function sitemap(env: Env): Promise<string> {
  const base = origin(env)
  const urls: { loc: string; lastmod?: string }[] = [
    '/',
    '/catalog',
    '/how-it-works',
    '/about',
    '/contact',
    '/faq',
    ...FAMILIES.map((f) => `/catalog/${f.slug}`),
  ].map((p) => ({ loc: `${base}${p}` }))
  const products = await many<{ slug: string; updated_at: string }>(env.DB, "SELECT slug, updated_at FROM products WHERE status = 'published' AND is_demo = 0 ORDER BY id")
  for (const p of products) urls.push({ loc: `${base}/products/${p.slug}`, lastmod: p.updated_at.slice(0, 10) })
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`)
    .join('\n')}\n</urlset>\n`
}

export function robots(env: Env): string {
  return `User-agent: *\nAllow: /\nDisallow: /account\nDisallow: /admin\nDisallow: /api/\nDisallow: /onboarding\nDisallow: /checkout\n\nSitemap: ${origin(env)}/sitemap.xml\n`
}
