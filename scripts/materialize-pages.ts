import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { join, parse } from 'node:path'

const siteDir = 'site-dist'
const docsDir = 'docs'
const indexHtml = await readFile(join(siteDir, 'index.html'), 'utf-8')
const entries = await readdir(docsDir)
const markdownEntries = entries.filter((entry) => entry.endsWith('.md')).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
const repository = process.env['GITHUB_REPOSITORY']
const [owner, repo] = repository?.split('/') ?? []
const basePath = repository ? `/${repo}/` : '/'
const siteOrigin = owner && repo ? `https://${owner}.github.io` : 'https://pmh-only.github.io'
const siteUrl = `${siteOrigin}${basePath}`
const siteTitle = 'COSMIC Archive'
const siteDescription = 'A sci-fi archive of anomalous COS markdown dossiers rendered as an animated Arwes interface.'
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

function injectHead(html: string, title: string, tags: string): string {
  return html.replace(/<title>.*?<\/title>/, `<title>${escapeHtml(title)}</title>`).replace('</head>', `${tags}\n  </head>`)
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

await writeFile(
  join(siteDir, 'index.html'),
  injectHead(
    indexHtml,
    siteTitle,
    buildMetaTags({
      title: siteTitle,
      description: siteDescription,
      canonical: siteUrl,
      type: 'website',
      jsonLd: rootJsonLd
    })
  )
)

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
  await writeFile(
    join(outputDir, 'index.html'),
    injectHead(
      indexHtml,
      `${doc.title} | ${siteTitle}`,
      buildMetaTags({
        title: `${doc.title} | ${siteTitle}`,
        description: doc.description,
        canonical: doc.url,
        type: 'article',
        jsonLd
      })
    )
  )
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
