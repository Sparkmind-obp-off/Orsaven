import { Fragment, type ReactNode } from 'react'

/**
 * Tiny, safe Markdown subset renderer (headings, paragraphs, lists, blockquotes,
 * bold, italics, links). Produces React elements only — never raw HTML — so
 * content is always output-encoded.
 */
function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\(([^)\s]+)\))/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const k = `${keyBase}-${i++}`
    if (m[2]) out.push(<strong key={k}>{m[2]}</strong>)
    else if (m[3]) out.push(<em key={k}>{m[3]}</em>)
    else if (m[4]) {
      const href = m[5]
      const safe = /^(https?:\/\/|\/|mailto:)/i.test(href) ? href : '#'
      const external = /^https?:\/\//i.test(safe)
      out.push(
        <a key={k} href={safe} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
          {m[4]}
        </a>,
      )
    }
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

export function Markdown({ source, className }: { source: string; className?: string }) {
  const lines = (source ?? '').replace(/\r\n/g, '\n').split('\n')
  const blocks: ReactNode[] = []
  let para: string[] = []
  let list: string[] = []
  let quote: string[] = []
  const flush = () => {
    const k = blocks.length
    if (para.length) blocks.push(<p key={`p${k}`}>{inline(para.join(' '), `p${k}`)}</p>)
    if (list.length)
      blocks.push(
        <ul key={`u${k}`}>
          {list.map((li, j) => (
            <li key={j}>{inline(li, `u${k}-${j}`)}</li>
          ))}
        </ul>,
      )
    if (quote.length) blocks.push(<blockquote key={`q${k}`}>{inline(quote.join(' '), `q${k}`)}</blockquote>)
    para = []
    list = []
    quote = []
  }
  for (const raw of lines) {
    const line = raw.trimEnd()
    if (!line.trim()) {
      flush()
      continue
    }
    const h = line.match(/^(#{2,3})\s+(.*)$/)
    if (h) {
      flush()
      const k = blocks.length
      blocks.push(h[1].length === 2 ? <h2 key={`h${k}`}>{inline(h[2], `h${k}`)}</h2> : <h3 key={`h${k}`}>{inline(h[2], `h${k}`)}</h3>)
      continue
    }
    const li = line.match(/^\s*[-*]\s+(.*)$/)
    if (li) {
      if (para.length || quote.length) flush()
      list.push(li[1])
      continue
    }
    const q = line.match(/^>\s?(.*)$/)
    if (q) {
      if (para.length || list.length) flush()
      quote.push(q[1])
      continue
    }
    if (list.length || quote.length) flush()
    para.push(line.trim())
  }
  flush()
  return <div className={className ?? 'prose-orsaven'}>{blocks.map((b, i) => <Fragment key={i}>{b}</Fragment>)}</div>
}
