// Bundles the Hono API into Cloudflare Pages "advanced mode" (_worker.js) and writes _routes.json.
import { build } from 'esbuild'
import { writeFileSync } from 'node:fs'

await build({
  entryPoints: ['src/worker/index.ts'],
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  minify: true,
  outfile: 'dist/_worker.js',
  conditions: ['workerd', 'worker', 'browser'],
  mainFields: ['module', 'main'],
  external: ['node:*', 'cloudflare:*'],
  legalComments: 'none',
  logLevel: 'info',
})

// Static assets bypass the Worker; everything else (API + SPA shell with SEO meta) hits it.
writeFileSync(
  'dist/_routes.json',
  JSON.stringify({ version: 1, include: ['/*'], exclude: ['/assets/*', '/brand/*', '/favicon.svg', '/site.webmanifest'] }, null, 2),
)
console.log('worker + _routes.json written')
