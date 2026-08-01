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
    .replace(/^#{1,6}\s+/gm, '')
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
  type: 'website' | 'article'
  jsonLd: unknown
}): string {
  return `
    <meta name="description" content="${escapeHtml(meta.description)}" />
    <meta name="application-name" content="${escapeHtml(siteTitle)}" />
    <meta name="apple-mobile-web-app-title" content="${escapeHtml(siteTitle)}" />
    <meta name="author" content="COSMIC Archive" />
    <meta name="keywords" content="COSMIC Archive, COS, anomalous dossier, sci-fi archive, Arwes, markdown documents, Korean fiction" />
    <link rel="canonical" href="${escapeHtml(meta.canonical)}" />
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
  <meta name="robots" content="index, follow" />
  <link rel="icon" href="${basePath}favicon.svg" type="image/svg+xml" />
  <link rel="manifest" href="${basePath}site.webmanifest" />
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
      body
    }
  })
)

function getDocHref(id: string): string {
  return `${basePath}docs/${id}/`
}

function renderArchive(activeDoc: DocMeta): string {
  const navigation = docs
    .map((doc) => `<li><a href="${getDocHref(doc.id)}"${doc.id === activeDoc.id ? ' aria-current="page"' : ''}>${escapeHtml(doc.title)}</a></li>`)
    .join('\n')
  const article = renderToStaticMarkup(
    createElement(ReactMarkdown, {
      components: {
        a: ({ href, children }) => {
          const targetId = href?.split('/').pop()?.replace(/\.md(#.*)?$/, '')
          const targetHref = targetId && docs.some((doc) => doc.id === targetId) ? getDocHref(targetId) : href
          return createElement('a', targetHref ? { href: targetHref } : {}, children)
        }
      }
    }, activeDoc.body)
  )

  return `<header>
  <h1><a href="${basePath}">${siteTitle}</a></h1>
  <p>${siteDescription}</p>
</header>
<main>
  <nav aria-label="COS records">
    <h2>Records</h2>
    <ol>
${navigation}
    </ol>
  </nav>
  <article>
${article}
  </article>
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
    url: doc.url
  }))
}

await rm(siteDir, { recursive: true, force: true })
await mkdir(siteDir, { recursive: true })
await cp('public', siteDir, { recursive: true })

const rootDoc = docs[0]
if (!rootDoc) {
  throw new Error('No COS records found in docs/')
}

await writeFile(join(siteDir, 'index.html'), buildHtml(
  siteTitle,
  buildMetaTags({
    title: siteTitle,
    description: siteDescription,
    canonical: siteUrl,
    type: 'website',
    jsonLd: rootJsonLd
  }),
  renderArchive(rootDoc)
))

for (const doc of docs) {
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
      type: 'article',
      jsonLd
    }),
    renderArchive(doc)
  ))
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
`
)

await writeFile(
  join(siteDir, 'llms.txt'),
  `# ${siteTitle}

${siteDescription}

${docs.map((doc) => `- [${doc.title}](${doc.url}): ${doc.description}`).join('\n')}
`
)
