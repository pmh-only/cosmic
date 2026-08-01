import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { join, parse } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ReactMarkdown from 'react-markdown'
import {
  classificationAxes,
  getClassificationLabel,
  parseCosDocument,
  renderCosDocument,
  type CosDocument
} from '../src/cos-document'

const siteDir = 'site-dist'
const docsDir = 'docs'
const entries = await readdir(docsDir)
const documentEntries = entries.filter((entry) => entry.endsWith('.json')).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
const repository = process.env['GITHUB_REPOSITORY']
const [owner, repo] = repository?.split('/') ?? []
const basePath = repository ? `/${repo}/` : '/'
const siteOrigin = owner && repo ? `https://${owner}.github.io` : 'https://pmh-only.github.io'
const siteUrl = `${siteOrigin}${basePath}`
const siteTitle = 'COSMIC Archive'
const siteDescription = 'A static archive of anomalous COS dossiers stored as structured JSON.'
const now = new Date().toISOString()

type DocMeta = {
  id: string
  title: string
  description: string
  path: string
  url: string
  jsonUrl: string
  body: string
  document: CosDocument
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function escapeJson(value: unknown): string {
  return JSON.stringify(value).replaceAll('<', '\\u003c')
}

function plainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+.*$/gm, ' ')
    .replace(/[*_~>#-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function excerpt(markdown: string): string {
  const text = plainText(markdown)
  return text.length > 156 ? `${text.slice(0, 153).trim()}...` : text
}

function buildMetaTags(meta: {
  title: string
  description: string
  canonical: string
  jsonUrl: string
  type: 'website' | 'article'
  jsonLd: unknown
}): string {
  return `
    <meta name="description" content="${escapeHtml(meta.description)}" />
    <meta name="application-name" content="${escapeHtml(siteTitle)}" />
    <meta name="apple-mobile-web-app-title" content="${escapeHtml(siteTitle)}" />
    <meta name="author" content="COSMIC Archive" />
    <meta name="keywords" content="COSMIC Archive, COS, anomalous dossier, classified archive, structured JSON, Korean records" />
    <link rel="canonical" href="${escapeHtml(meta.canonical)}" />
    <link rel="alternate" type="application/json" href="${escapeHtml(meta.jsonUrl)}" title="${escapeHtml(`${meta.title} as structured JSON`)}" />
    <meta property="og:site_name" content="${escapeHtml(siteTitle)}" />
    <meta property="og:type" content="${meta.type}" />
    <meta property="og:title" content="${escapeHtml(meta.title)}" />
    <meta property="og:description" content="${escapeHtml(meta.description)}" />
    <meta property="og:url" content="${escapeHtml(meta.canonical)}" />
    <meta property="og:locale" content="ko_KR" />
    <meta property="og:image" content="${escapeHtml(`${siteUrl}og.svg`)}" />
    <meta property="og:image:type" content="image/svg+xml" />
    <meta property="og:image:alt" content="COSMIC Archive classified dossier index" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(meta.title)}" />
    <meta name="twitter:description" content="${escapeHtml(meta.description)}" />
    <meta name="twitter:image" content="${escapeHtml(`${siteUrl}og.svg`)}" />
    <script type="application/ld+json">${escapeJson(meta.jsonLd)}</script>`
}

function buildHtml(title: string, tags: string, content: string): string {
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
  <meta name="generator" content="COSMIC Archive static generator" />
  <meta name="theme-color" content="#020704" />
  <link rel="icon" href="${basePath}favicon.svg" type="image/svg+xml" />
  <link rel="manifest" href="${basePath}site.webmanifest" />
  <link rel="stylesheet" href="${basePath}archive.css" />
  <link rel="alternate" type="text/plain" href="${basePath}llms.txt" title="${siteTitle} LLM index" />
  <script src="${basePath}archive.js" defer></script>
  <title>${escapeHtml(title)}</title>${tags}
</head>
<body>
<a class="skip-link" href="#main-content">본문으로 건너뛰기</a>
<canvas class="matrix-rain" aria-hidden="true"></canvas>
<div class="crt-effects" aria-hidden="true"></div>
<div class="terminal-frame">
${content}
</div>
</body>
</html>
`
}

const docs: DocMeta[] = await Promise.all(
  documentEntries.map(async (entry) => {
    const document = parseCosDocument(JSON.parse(await readFile(join(docsDir, entry), 'utf-8')))
    const id = parse(entry).name
    if (id !== `cos${document.id}`) {
      throw new Error(`Filename and document ID differ in ${entry}`)
    }
    const title = `COS${document.id} — ${document.title}`
    const path = `docs/${id}/`
    return {
      id,
      title,
      description: excerpt(renderCosDocument(document)),
      path,
      url: `${siteUrl}${path}`,
      jsonUrl: `${siteUrl}${path}index.json`,
      body: renderCosDocument(document),
      document
    }
  })
)

function getDocHref(id: string): string {
  return `${basePath}docs/${id}/`
}

function getReferences(document: CosDocument): number[] {
  const references = [...JSON.stringify(document).matchAll(/\.\/cos(\d+)\.json/g)]
    .map((match) => Number.parseInt(match[1] ?? '', 10))
  return [...new Set(references)].sort((a, b) => a - b)
}

function getJsonResource(doc: DocMeta): object {
  const document = JSON.parse(
    JSON.stringify(doc.document).replace(/\]\(\.\/(cos\d+)\.json(#[^)]+)?\)/g, (_match, id: string, fragment: string | undefined) => {
      return `](${siteUrl}docs/${id}/index.json${fragment ?? ''})`
    })
  ) as CosDocument

  return {
    ...document,
    code: `COS${doc.document.id}`,
    canonicalUrl: doc.url,
    jsonUrl: doc.jsonUrl,
    references: getReferences(doc.document)
  }
}

function getClassificationSearchText(document: CosDocument): string {
  return classificationAxes
    .map((axis) => `${axis.label} ${axis.code} ${document.classification[axis.key]} ${getClassificationLabel(axis, document.classification[axis.key])}`)
    .join(' ')
}

function renderClassificationBadges(document: CosDocument): string {
  const badges = classificationAxes.map((axis) => {
    const level = document.classification[axis.key]
    const levelLabel = getClassificationLabel(axis, level)
    return `<li class="level-${level}" title="${axis.label}: LEVEL ${level} ${levelLabel}"><span>${axis.code}</span><strong>${level}</strong></li>`
  }).join('')

  return `<ul class="record-levels" aria-label="분류 수준: ${classificationAxes
    .map((axis) => `${axis.label} ${document.classification[axis.key]}`)
    .join(', ')}">${badges}</ul>`
}

function renderClassificationMatrix(document: CosDocument): string {
  const rows = classificationAxes.map((axis) => {
    const level = document.classification[axis.key]
    const levelLabel = getClassificationLabel(axis, level)
    const meter = Array.from({ length: 5 }, (_, index) => `<i${index < level ? ' class="active"' : ''}></i>`).join('')
    return `<div class="level-${level}">
      <dt><span>${axis.code}</span>${axis.label}</dt>
      <dd><span class="level-meter" aria-hidden="true">${meter}</span><strong>L${level} ${levelLabel}</strong></dd>
    </div>`
  }).join('\n')

  return `<section class="classification-matrix" aria-labelledby="classification-heading">
    <h2 id="classification-heading">// CLASSIFICATION MATRIX</h2>
    <dl>${rows}</dl>
  </section>`
}

function renderIndex(): string {
  const records = docs
    .map((doc, index) => {
      const code = `COS${doc.document.id}`
      return `<li class="record-card" data-record data-search="${escapeHtml(`${code} ${doc.document.title} ${doc.description} ${getClassificationSearchText(doc.document)}`.toLocaleLowerCase('ko-KR'))}">
  <a href="${getDocHref(doc.id)}" aria-label="${escapeHtml(doc.title)} 열람">
    <span class="record-index" aria-hidden="true">${String(index + 1).padStart(3, '0')}</span>
    <span class="record-code">${code}</span>
    <strong class="record-title">${escapeHtml(doc.document.title)}</strong>
    ${renderClassificationBadges(doc.document)}
    <span class="record-excerpt">${escapeHtml(doc.description)}</span>
    <span class="record-access">OPEN_FILE <span aria-hidden="true">[ENTER]</span></span>
  </a>
</li>`
    })
    .join('\n')

  return `<header class="system-bar">
  <a class="wordmark" href="${basePath}" aria-label="COSMIC Archive 홈">
    <span class="wordmark-mark" aria-hidden="true">C∴</span>
    <span>COSMIC_ARCHIVE</span>
  </a>
  <div class="system-readout" aria-label="시스템 상태">
    <span><i class="status-light"></i> LINK_SECURE</span>
    <span class="system-clock" aria-label="현재 시각">00:00:00</span>
  </div>
  <button class="effects-toggle" type="button" data-effects-toggle aria-pressed="true">CRT: ON</button>
</header>
<main id="main-content" class="archive-main">
  <section class="archive-hero" aria-labelledby="archive-title">
    <div class="eyebrow"><span>RESTRICTED NETWORK</span><span>NODE 09 / KR</span></div>
    <div class="hero-grid">
      <div>
        <p class="boot-line">&gt; uplink established<span class="cursor" aria-hidden="true"></span></p>
        <h1 id="archive-title">COSMIC<br/><span>ARCHIVE</span></h1>
      </div>
      <div class="hero-copy">
        <p class="classification">[ CLASSIFIED // SIX-AXIS CONTROL ]</p>
        <p>미확인 개체, 물체 및 현상에 대한 중앙 기록망. 모든 접근은 기록되며 열람 흔적은 보존됩니다.</p>
        <dl class="archive-stats">
          <div><dt>FILES</dt><dd>${String(docs.length).padStart(3, '0')}</dd></div>
          <div><dt>STATUS</dt><dd>LIVE</dd></div>
          <div><dt>FORMAT</dt><dd>JSON.V3</dd></div>
        </dl>
      </div>
    </div>
  </section>
  <section class="records-panel" aria-labelledby="records-heading">
    <div class="panel-heading">
      <div>
        <p class="section-number">// 01</p>
        <h2 id="records-heading">RECORD_DIRECTORY</h2>
      </div>
      <p><span data-result-count>${docs.length}</span> / ${docs.length} ENTRIES</p>
    </div>
    <form class="archive-search" role="search" data-search-form>
      <label for="record-search">QUERY::</label>
      <div class="search-field">
        <span aria-hidden="true">&gt;</span>
        <input id="record-search" type="search" autocomplete="off" placeholder="SEARCH ID / DESIGNATION / CONTENT" data-search-input />
        <kbd>/</kbd>
      </div>
    </form>
    <p class="no-results" data-no-results hidden>NO MATCHING RECORDS // QUERY REJECTED</p>
    <ol class="record-grid">
${records}
    </ol>
  </section>
  <footer class="archive-footer">
    <span>COSMIC ARCHIVAL TERMINAL</span>
    <span>END_OF_DIRECTORY //</span>
    <span>© ${new Date().getUTCFullYear()} INTERNAL USE</span>
  </footer>
</main>`
}

function renderDocument(activeDoc: DocMeta, index: number): string {
  const article = renderToStaticMarkup(
    createElement(ReactMarkdown, {
      components: {
        a: ({ href, children }) => {
          const internalLink = href?.match(/^\.\/(cos\d+)\.json(#[^)]+)?$/)
          const targetId = internalLink?.[1]
          const targetHref = targetId && docs.some((doc) => doc.id === targetId)
            ? `${getDocHref(targetId)}${internalLink?.[2] ?? ''}`
            : href
          return createElement('a', targetHref ? { href: targetHref } : {}, children)
        }
      }
    }, activeDoc.body)
  )
  const previous = docs[index - 1]
  const next = docs[index + 1]
  const navigation = [
    `<a href="${basePath}">Archive index</a>`,
    previous ? `<a rel="prev" href="${getDocHref(previous.id)}">Previous: ${escapeHtml(previous.title)}</a>` : undefined,
    next ? `<a rel="next" href="${getDocHref(next.id)}">Next: ${escapeHtml(next.title)}</a>` : undefined
  ].filter((link) => link !== undefined).join(' | ')

  return `<header class="system-bar">
  <a class="wordmark" href="${basePath}" aria-label="COSMIC Archive 홈">
    <span class="wordmark-mark" aria-hidden="true">C∴</span>
    <span>COSMIC_ARCHIVE</span>
  </a>
  <div class="system-readout" aria-label="시스템 상태">
    <span><i class="status-light"></i> FILE_OPEN</span>
    <span class="system-clock" aria-label="현재 시각">00:00:00</span>
  </div>
  <button class="effects-toggle" type="button" data-effects-toggle aria-pressed="true">CRT: ON</button>
</header>
<div class="reading-progress" aria-hidden="true"><span data-reading-progress></span></div>
<main id="main-content" class="dossier-main">
  <aside class="dossier-sidebar">
    <a class="back-link" href="${basePath}"><span aria-hidden="true">&lt;-</span> ARCHIVE_INDEX</a>
    <div class="file-stamp">
      <span>FILE_ID</span>
      <strong>COS${activeDoc.document.id}</strong>
      <span>ACCESS // L${activeDoc.document.classification.permission}</span>
    </div>
    ${renderClassificationMatrix(activeDoc.document)}
    <dl class="file-meta">
      <div><dt>TYPE</dt><dd>INCIDENT DOSSIER</dd></div>
      <div><dt>LANG</dt><dd>KO-KR</dd></div>
      <div><dt>STATE</dt><dd class="live-value">VERIFIED</dd></div>
      <div><dt>SCHEMA</dt><dd>V3.0</dd></div>
    </dl>
    <a class="raw-link" href="index.json">VIEW_RAW_JSON <span aria-hidden="true">↗</span></a>
    <nav class="section-nav" aria-label="문서 목차">
      <p>// SECTIONS</p>
      <ol data-section-nav></ol>
    </nav>
  </aside>
  <div class="dossier-content">
    <div class="dossier-banner">
      <span>CLASSIFIED // CONTROLLED RECORD</span>
      <span>CRC:${String(activeDoc.document.id * 7919).slice(-6).padStart(6, '0')}</span>
    </div>
    <article class="dossier-article" data-dossier>
${article}
    </article>
    <nav class="record-navigation" aria-label="Record navigation">${navigation}</nav>
    <footer class="document-footer"><span>EOF // COS${activeDoc.document.id}</span><span>CONNECTION MAINTAINED</span></footer>
  </div>
</main>`
}

const rootJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: siteTitle,
  description: siteDescription,
  url: siteUrl,
  inLanguage: 'ko-KR',
  publisher: {
    '@type': 'Organization',
    name: siteTitle,
    url: siteUrl
  },
  hasPart: docs.map((doc) => ({
    '@type': 'CreativeWork',
    name: doc.title,
    url: doc.url,
    inLanguage: 'ko-KR',
    encoding: {
      '@type': 'MediaObject',
      contentUrl: doc.jsonUrl,
      encodingFormat: 'application/json'
    }
  }))
}

await rm(siteDir, { recursive: true, force: true })
await mkdir(siteDir, { recursive: true })
await cp('public', siteDir, { recursive: true })

if (docs.length === 0) {
  throw new Error('No COS records found in docs/')
}

await writeFile(join(siteDir, 'index.html'), buildHtml(
  siteTitle,
  buildMetaTags({
    title: siteTitle,
    description: siteDescription,
    canonical: siteUrl,
    jsonUrl: `${siteUrl}index.json`,
    type: 'website',
    jsonLd: rootJsonLd
  }),
  renderIndex()
))

await writeFile(join(siteDir, 'index.json'), `${JSON.stringify({
  schemaVersion: 1,
  name: siteTitle,
  description: siteDescription,
  language: 'ko-KR',
  canonicalUrl: siteUrl,
  corpusUrl: `${siteUrl}corpus.json`,
  records: docs.map((doc) => ({
    id: doc.document.id,
    code: `COS${doc.document.id}`,
    title: doc.document.title,
    description: doc.description,
    canonicalUrl: doc.url,
    jsonUrl: doc.jsonUrl,
    classification: doc.document.classification,
    references: getReferences(doc.document)
  }))
}, null, 2)}\n`)

for (const [index, doc] of docs.entries()) {
  const outputDir = join(siteDir, 'docs', doc.id)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: doc.title,
    description: doc.description,
    url: doc.url,
    mainEntityOfPage: doc.url,
    inLanguage: 'ko-KR',
    dateModified: now,
    encoding: {
      '@type': 'MediaObject',
      contentUrl: doc.jsonUrl,
      encodingFormat: 'application/json'
    },
    isPartOf: {
      '@type': 'WebSite',
      name: siteTitle,
      url: siteUrl
    }
  }

  await mkdir(outputDir, { recursive: true })
  await writeFile(join(outputDir, 'index.html'), buildHtml(
    `${doc.title} | ${siteTitle}`,
    buildMetaTags({
      title: `${doc.title} | ${siteTitle}`,
      description: doc.description,
      canonical: doc.url,
      jsonUrl: doc.jsonUrl,
      type: 'article',
      jsonLd
    }),
    renderDocument(doc, index)
  ))
  await writeFile(join(outputDir, 'index.json'), `${JSON.stringify(getJsonResource(doc), null, 2)}\n`)
}

const sitemapUrls = [
  { url: siteUrl, priority: '1.0' },
  ...docs.map((doc) => ({ url: doc.url, priority: '0.8' }))
]

await writeFile(
  join(siteDir, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls
  .map(
    (entry) => `  <url>
    <loc>${escapeHtml(entry.url)}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>${entry.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>
`
)

await writeFile(
  join(siteDir, 'robots.txt'),
  `User-agent: *
Allow: /

Sitemap: ${siteUrl}sitemap.xml

# LLM-oriented discovery and context files
# ${siteUrl}llms.txt
`
)

await writeFile(
  join(siteDir, 'llms.txt'),
  `# ${siteTitle}

> ${siteDescription} It contains ${docs.length} Korean-language dossiers about anomalous entities, objects, and phenomena.

COS identifiers begin at COS100. Relationships between records are part of the corpus. Prefer the structured JSON resources below over HTML when extracting content.

## Complete Archive

- [Full structured corpus](${siteUrl}corpus.json): Every COS dossier in one versioned JSON document.
- [Archive index](${siteUrl}index.json): Concise structured index with descriptions and relationship IDs.

## Records

${docs.map((doc) => `- [${doc.title}](${doc.jsonUrl}): ${doc.description}`).join('\n')}
`
)

await writeFile(
  join(siteDir, 'corpus.json'),
  `${JSON.stringify({
    schemaVersion: 1,
    name: siteTitle,
    description: siteDescription,
    language: 'ko-KR',
    canonicalUrl: siteUrl,
    generatedAt: now,
    documents: docs.map(getJsonResource)
  }, null, 2)}\n`
)
