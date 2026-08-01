import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { join, parse } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ReactMarkdown from 'react-markdown'

const siteDir = 'site-dist'
const docsDir = 'docs'
const entries = await readdir(docsDir)
const markdownEntries = entries.filter((entry) => entry.endsWith('.md')).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
const repository = process.env['GITHUB_REPOSITORY']
const [owner, repo] = repository?.split('/') ?? []
const basePath = repository ? `/${repo}/` : '/'
const siteOrigin = owner && repo ? `https://${owner}.github.io` : 'https://pmh-only.github.io'
const siteUrl = `${siteOrigin}${basePath}`
const siteTitle = 'COSMIC Archive'
const siteDescription = 'A static archive of anomalous COS markdown dossiers.'
const now = new Date().toISOString()

type DocMeta = {
  id: string
  title: string
  description: string
  path: string
  url: string
  markdownUrl: string
  body: string
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
  markdownUrl: string
  type: 'website' | 'article'
  jsonLd: unknown
}): string {
  return `
    <meta name="description" content="${escapeHtml(meta.description)}" />
    <meta name="application-name" content="${escapeHtml(siteTitle)}" />
    <meta name="apple-mobile-web-app-title" content="${escapeHtml(siteTitle)}" />
    <meta name="author" content="COSMIC Archive" />
    <meta name="keywords" content="COSMIC Archive, COS, anomalous dossier, sci-fi archive, markdown documents, Korean fiction" />
    <link rel="canonical" href="${escapeHtml(meta.canonical)}" />
    <link rel="alternate" type="text/markdown" href="${escapeHtml(meta.markdownUrl)}" title="${escapeHtml(`${meta.title} in Markdown`)}" />
    <meta property="og:site_name" content="${escapeHtml(siteTitle)}" />
    <meta property="og:type" content="${meta.type}" />
    <meta property="og:title" content="${escapeHtml(meta.title)}" />
    <meta property="og:description" content="${escapeHtml(meta.description)}" />
    <meta property="og:url" content="${escapeHtml(meta.canonical)}" />
    <meta property="og:locale" content="ko_KR" />
    <meta property="og:image" content="${escapeHtml(`${siteUrl}og.svg`)}" />
    <meta property="og:image:type" content="image/svg+xml" />
    <meta property="og:image:alt" content="COSMIC Archive sci-fi interface" />
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
  <link rel="icon" href="${basePath}favicon.svg" type="image/svg+xml" />
  <link rel="manifest" href="${basePath}site.webmanifest" />
  <link rel="alternate" type="text/plain" href="${basePath}llms.txt" title="${siteTitle} LLM index" />
  <title>${escapeHtml(title)}</title>${tags}
</head>
<body>
${content}
</body>
</html>
`
}

const docs: DocMeta[] = await Promise.all(
  markdownEntries.map(async (entry) => {
    const body = await readFile(join(docsDir, entry), 'utf-8')
    const id = parse(entry).name
    const title = body.match(/^#\s+(.+)$/m)?.[1] ?? id.toUpperCase()
    const path = `docs/${id}/`
    return {
      id,
      title,
      description: excerpt(body),
      path,
      url: `${siteUrl}${path}`,
      markdownUrl: `${siteUrl}${path}index.html.md`,
      body
    }
  })
)

function getDocHref(id: string): string {
  return `${basePath}docs/${id}/`
}

function getMarkdownBody(doc: DocMeta): string {
  return doc.body.replace(/\]\(\.\/(cos\d+)\.md(#[^)]+)?\)/g, (_match, id: string, fragment: string | undefined) => {
    return `](${siteUrl}docs/${id}/index.html.md${fragment ?? ''})`
  })
}

function renderIndex(): string {
  const records = docs
    .map((doc) => `<li><a href="${getDocHref(doc.id)}">${escapeHtml(doc.title)}</a>: ${escapeHtml(doc.description)}</li>`)
    .join('\n')

  return `<header>
  <h1>${siteTitle}</h1>
  <p>${siteDescription}</p>
</header>
<main>
  <section aria-labelledby="records-heading">
    <h2 id="records-heading">Records</h2>
    <ol>
${records}
    </ol>
  </section>
</main>`
}

function renderDocument(activeDoc: DocMeta, index: number): string {
  const article = renderToStaticMarkup(
    createElement(ReactMarkdown, {
      components: {
        a: ({ href, children }) => {
          const internalLink = href?.match(/^\.\/(cos\d+)\.md(#[^)]+)?$/)
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

  return `<header>
  <p><a href="${basePath}">${siteTitle}</a></p>
  <p>${siteDescription}</p>
</header>
<main>
  <article>
${article}
  </article>
  <nav aria-label="Record navigation">${navigation}</nav>
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
      contentUrl: doc.markdownUrl,
      encodingFormat: 'text/markdown'
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
    markdownUrl: `${siteUrl}index.html.md`,
    type: 'website',
    jsonLd: rootJsonLd
  }),
  renderIndex()
))

const indexMarkdown = `# ${siteTitle}

> ${siteDescription}

The archive contains ${docs.length} Korean-language fictional dossiers. Each COS record describes an anomalous entity, object, or phenomenon and links to related records.

## Records

${docs.map((doc) => `- [${doc.title}](${doc.markdownUrl}): ${doc.description}`).join('\n')}
`

await writeFile(join(siteDir, 'index.html.md'), indexMarkdown)
await writeFile(join(siteDir, 'index.md'), indexMarkdown)

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
      contentUrl: doc.markdownUrl,
      encodingFormat: 'text/markdown'
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
      markdownUrl: doc.markdownUrl,
      type: 'article',
      jsonLd
    }),
    renderDocument(doc, index)
  ))
  const markdownBody = getMarkdownBody(doc)
  await writeFile(join(outputDir, 'index.html.md'), markdownBody)
  await writeFile(join(outputDir, 'index.md'), markdownBody)
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

> ${siteDescription} It contains ${docs.length} Korean-language fictional dossiers about anomalous entities, objects, and phenomena.

COS identifiers begin at COS100. Relationships between records are part of the fictional corpus. Prefer the Markdown resources below over HTML when extracting content.

## Complete Archive

- [Full archive context](${siteUrl}llms-full.txt): Every COS dossier in one Markdown-compatible context file with explicit document boundaries.
- [Archive index](${siteUrl}index.html.md): Concise index of all records with descriptions.
- [JSON Lines corpus](${siteUrl}corpus.jsonl): One structured JSON object per record, including metadata and full Markdown content.

## Records

${docs.map((doc) => `- [${doc.title}](${doc.markdownUrl}): ${doc.description}`).join('\n')}
`
)

await writeFile(
  join(siteDir, 'llms-full.txt'),
  `# ${siteTitle}: Full Corpus

> Complete Korean-language COS dossier corpus. Each document is enclosed in an XML-style boundary to preserve provenance during concatenation.

${docs.map((doc) => `<document id="${doc.id}" title="${escapeHtml(doc.title)}" canonical_url="${doc.url}" markdown_url="${doc.markdownUrl}">
${getMarkdownBody(doc).trim()}
</document>`).join('\n\n')}
`
)

await writeFile(
  join(siteDir, 'corpus.jsonl'),
  `${docs.map((doc) => JSON.stringify({
    id: doc.id,
    title: doc.title,
    language: 'ko-KR',
    description: doc.description,
    canonical_url: doc.url,
    markdown_url: doc.markdownUrl,
    content_markdown: getMarkdownBody(doc)
  })).join('\n')}\n`
)
