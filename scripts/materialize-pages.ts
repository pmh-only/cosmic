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
const fallbackSiteUrl = owner && repo ? `https://${owner}.github.io/${repo}/` : 'https://pmh-only.github.io/'
const siteUrl = `${(process.env['SITE_URL'] ?? fallbackSiteUrl).replace(/\/+$/, '')}/`
const basePath = new URL(siteUrl).pathname
const siteTitle = 'COSMIC 기록관리시스템'
const rootPageTitle = 'COSMIC 기록관리시스템 | 현상 조사 자료'
const siteDescription = '현장에서 접수된 미확인 현상에 대한 조사 기록, 확인 자료 및 후속 조치 내역을 조회할 수 있습니다.'
const siteKeywords = ['COSMIC', 'COS', '현상 조사', '현장 기록', '사건 보고', '확인 자료', '기록관리']
const organizationId = `${siteUrl}#organization`
const websiteId = `${siteUrl}#website`
const collectionId = `${siteUrl}#collection`
const datasetId = `${siteUrl}#dataset`
const now = new Date().toISOString()

type DocMeta = {
  id: string
  title: string
  description: string
  path: string
  url: string
  jsonUrl: string
  body: string
  keywords: string[]
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
    .replace(/[*_]/g, '')
    .replace(/^>\s?/gm, '')
    .replace(/^\s*-\s+/gm, '')
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
  keywords: string[]
  previousUrl?: string
  nextUrl?: string
}): string {
  return `
    <meta name="description" content="${escapeHtml(meta.description)}" />
    <meta name="application-name" content="${escapeHtml(siteTitle)}" />
    <meta name="apple-mobile-web-app-title" content="${escapeHtml(siteTitle)}" />
    <meta name="author" content="COSMIC Archive" />
    <meta name="keywords" content="${escapeHtml(meta.keywords.join(', '))}" />
    <link rel="canonical" href="${escapeHtml(meta.canonical)}" />
    <link rel="alternate" type="application/json" href="${escapeHtml(meta.jsonUrl)}" title="${escapeHtml(`${meta.title} as structured JSON`)}" />
    ${meta.previousUrl ? `<link rel="prev" href="${escapeHtml(meta.previousUrl)}" />` : ''}
    ${meta.nextUrl ? `<link rel="next" href="${escapeHtml(meta.nextUrl)}" />` : ''}
    <meta property="og:site_name" content="${escapeHtml(siteTitle)}" />
    <meta property="og:type" content="${meta.type}" />
    <meta property="og:title" content="${escapeHtml(meta.title)}" />
    <meta property="og:description" content="${escapeHtml(meta.description)}" />
    <meta property="og:url" content="${escapeHtml(meta.canonical)}" />
    <meta property="og:locale" content="ko_KR" />
    <meta property="og:image" content="${escapeHtml(`${siteUrl}og.svg`)}" />
    <meta property="og:image:secure_url" content="${escapeHtml(`${siteUrl}og.svg`)}" />
    <meta property="og:image:type" content="image/svg+xml" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${escapeHtml(`${meta.title} 대표 이미지`)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(meta.title)}" />
    <meta name="twitter:description" content="${escapeHtml(meta.description)}" />
    <meta name="twitter:image" content="${escapeHtml(`${siteUrl}og.svg`)}" />
    <meta name="twitter:image:alt" content="${escapeHtml(`${meta.title} 대표 이미지`)}" />
    <script type="application/ld+json">${escapeJson(meta.jsonLd)}</script>`
}

function buildHtml(title: string, tags: string, content: string): string {
  return `<!doctype html>
<html lang="ko-KR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
  <meta name="generator" content="COSMIC records publisher" />
  <meta name="theme-color" content="#f4f5f7" />
  <link rel="icon" href="${basePath}favicon.svg" type="image/svg+xml" />
  <link rel="home" href="${siteUrl}" />
  <link rel="sitemap" type="application/xml" href="${siteUrl}sitemap.xml" />
  <link rel="search" type="application/opensearchdescription+xml" href="${siteUrl}opensearch.xml" title="${siteTitle}" />
  <link rel="manifest" href="${basePath}site.webmanifest" />
  <link rel="stylesheet" href="${basePath}archive.css" />
  <link rel="alternate" type="application/rss+xml" href="${siteUrl}feed.xml" title="${siteTitle} 최신 기록" />
  <link rel="alternate" type="text/plain" href="${basePath}llms.txt" title="${siteTitle} LLM index" />
  <script src="${basePath}archive.js" defer></script>
  <title>${escapeHtml(title)}</title>${tags}
</head>
<body>
<a class="skip-link" href="#main-content">본문으로 건너뛰기</a>
<div class="site-shell">
${content}
</div>
</body>
</html>
`
}

function getDocumentKeywords(document: CosDocument): string[] {
  const classificationKeywords = classificationAxes.map((axis) => {
    const level = document.classification[axis.key]
    return `${axis.label} L${level} ${getClassificationLabel(axis, level)}`
  })
  const personnelKeywords = document.narrative.personnel.map((person) => person.name)
  const referenceKeywords = getReferences(document).map((id) => `COS${id}`)

  return [...new Set([
    `COS${document.id}`,
    document.title,
    ...siteKeywords,
    ...classificationKeywords,
    ...personnelKeywords,
    ...referenceKeywords
  ])]
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
    const body = renderCosDocument(document)
    return {
      id,
      title,
      description: excerpt(document.overview.join('\n\n')),
      path,
      url: `${siteUrl}${path}`,
      jsonUrl: `${siteUrl}${path}index.json`,
      body,
      keywords: getDocumentKeywords(document),
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

function getNarrativeSearchText(document: CosDocument): string {
  return JSON.stringify(document.narrative)
}

function renderRecordMetadata(document: CosDocument): string {
  const keys = ['secrecy', 'danger', 'containment'] as const
  const items = keys.map((key) => {
    const axis = classificationAxes.find((candidate) => candidate.key === key)
    if (!axis) return ''
    const level = document.classification[axis.key]
    const levelLabel = getClassificationLabel(axis, level)
    return `<div><dt>${axis.label}</dt><dd>${levelLabel} ${level}</dd></div>`
  }).join('')

  return `<dl class="record-meta">${items}</dl>`
}

function renderClassificationMatrix(document: CosDocument): string {
  const rows = classificationAxes.map((axis) => {
    const level = document.classification[axis.key]
    const levelLabel = getClassificationLabel(axis, level)
    const meter = Array.from({ length: 5 }, (_, index) => `<i${index < level ? ' class="active"' : ''}></i>`).join('')
    return `<div class="level-${level}">
      <dt><span>${axis.code}</span>${axis.label}</dt>
      <dd><span class="level-meter" aria-hidden="true">${meter}</span><strong>${levelLabel} · ${level}</strong></dd>
    </div>`
  }).join('\n')

  return `<section class="classification-matrix" aria-labelledby="classification-heading">
    <h2 id="classification-heading">관리 분류</h2>
    <dl>${rows}</dl>
  </section>`
}

function renderLevelGuide(): string {
  const axes = classificationAxes.map((axis) => `<section>
    <h3><span>${axis.code}</span>${axis.label}</h3>
    <p>${axis.description}</p>
    <ol>${axis.levels.map((label, index) => `<li><strong>${index + 1}단계 ${label}</strong><span>${axis.meanings[index]}</span></li>`).join('')}</ol>
  </section>`).join('')

  return `<details class="level-guide">
    <summary>분류 기준 보기 <span aria-hidden="true">+</span></summary>
    <div>${axes}</div>
  </details>`
}

function renderSiteHeader(status: string): string {
  return `<div class="service-strip">
  <div><span class="service-symbol" aria-hidden="true">C</span><span>COSMIC 기관업무용 기록관리 시스템입니다.</span><span class="system-clock" aria-label="현재 날짜"></span></div>
</div>
<header class="system-bar">
  <a class="wordmark" href="${basePath}" aria-label="COSMIC 기록관리시스템 홈">
    <span class="wordmark-mark" aria-hidden="true">C</span>
    <span><strong>COSMIC</strong><small>현상기록관리센터</small></span>
  </a>
  <div class="system-readout" aria-label="시스템 상태">
    <span>접속구분: 외부 열람</span>
    <span>${status}</span>
    <a href="${basePath}index.json">자료구조</a>
  </div>
</header>
<nav class="global-nav" aria-label="주요 메뉴">
  <div>
    <a class="active" href="${basePath}">통합조회</a>
    <a href="${basePath}#records-heading">현장기록</a>
    <a href="${basePath}#records-heading">관측자료</a>
    <a href="${basePath}#records-heading">상호참조</a>
    <a href="${basePath}#records-heading">관리기준</a>
  </div>
</nav>`
}

function renderIndex(): string {
  const records = docs
    .map((doc, index) => {
      const code = `COS${doc.document.id}`
      return `<li class="record-card" data-record data-search="${escapeHtml(`${code} ${doc.document.title} ${doc.description} ${getClassificationSearchText(doc.document)} ${getNarrativeSearchText(doc.document)}`.toLocaleLowerCase('ko-KR'))}">
  <a href="${getDocHref(doc.id)}" aria-label="${escapeHtml(doc.title)} 열람">
    <span class="record-index" aria-hidden="true">${String(index + 1).padStart(3, '0')}</span>
    <span class="record-code">${code}</span>
    <strong class="record-title">${escapeHtml(doc.document.title)}</strong>
    ${renderRecordMetadata(doc.document)}
    <span class="record-excerpt">${escapeHtml(doc.description)}</span>
    <span class="record-access">보기</span>
  </a>
</li>`
    })
    .join('\n')

  return `${renderSiteHeader('기록목록')}
<main id="main-content" class="archive-main">
  <nav class="page-path" aria-label="현재 위치"><a href="${basePath}">홈</a><span>자료조회</span><strong>현상 조사 기록</strong></nav>
  <section class="archive-hero" aria-labelledby="archive-title">
    <div class="hero-grid">
      <div>
        <h1 id="archive-title">현상 조사 기록 통합조회</h1>
        <p class="boot-line">등록된 현장 조사기록과 관련 자료를 조회합니다.</p>
      </div>
      <dl class="archive-stats">
        <div><dt>등록 건수</dt><dd>${String(docs.length).padStart(3, '0')}건</dd></div>
        <div><dt>기준본</dt><dd>${String(docs.length).padStart(3, '0')}건</dd></div>
        <div><dt>자료 갱신</dt><dd>${new Date().getUTCFullYear()}.08</dd></div>
      </dl>
    </div>
  </section>
  <section class="records-panel" aria-labelledby="records-heading">
    <div class="panel-heading">
      <div>
        <h2 id="records-heading">검색 조건</h2>
      </div>
      <p><span class="required-mark">*</span> 문서번호, 건명 및 본문을 대상으로 검색합니다.</p>
    </div>
    <form class="archive-search" role="search" action="${siteUrl}" method="get" data-search-form>
      <label for="record-search">검색어</label>
      <div class="search-field">
        <span class="search-select" aria-hidden="true">제목+내용</span>
        <input id="record-search" name="q" type="search" autocomplete="off" placeholder="문서번호, 건명 또는 본문 검색" data-search-input />
        <button type="submit">검색</button>
      </div>
    </form>
    <div class="result-toolbar">
      <p>전체 <strong data-result-count>${docs.length}</strong>건</p>
      <p><span>문서번호순</span><span>페이지당 ${docs.length}건</span></p>
    </div>
    <p class="no-results" data-no-results hidden>조건에 맞는 기록이 없습니다.</p>
    <div class="record-table-head" aria-hidden="true">
      <span>번호</span><span>문서번호</span><span>건명</span><span>기록 개요</span><span>관리 분류</span><span>열람</span>
    </div>
    <ol class="record-grid">
${records}
    </ol>
    <nav class="pagination" aria-label="페이지 이동"><strong>1</strong></nav>
  </section>
  <footer class="archive-footer">
    <span>COSMIC 기록관리시스템</span>
    <span>자료 오류 및 정정사항은 기록관리 담당자에게 통보</span>
    <span>기준연도 ${new Date().getUTCFullYear()}</span>
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
    `<a href="${basePath}">전체 목록</a>`,
    previous ? `<a rel="prev" href="${getDocHref(previous.id)}">이전 기록: ${escapeHtml(previous.title)}</a>` : undefined,
    next ? `<a rel="next" href="${getDocHref(next.id)}">다음 기록: ${escapeHtml(next.title)}</a>` : undefined
  ].filter((link) => link !== undefined).join(' | ')

  return `${renderSiteHeader(`COS${activeDoc.document.id} 조회`)}
<div class="reading-progress" aria-hidden="true"><span data-reading-progress></span></div>
<nav class="page-path document-path" aria-label="현재 위치"><a href="${basePath}">홈</a><a href="${basePath}">통합조회</a><strong>COS${activeDoc.document.id}</strong></nav>
<main id="main-content" class="dossier-main">
  <aside class="dossier-sidebar">
    <div class="sidebar-title">현상 조사 기록</div>
    <a class="back-link" href="${basePath}">통합조회</a>
    <div class="file-stamp">
      <span>문서번호</span>
      <strong>COS${activeDoc.document.id}</strong>
      <span>열람권한 ${getClassificationLabel(classificationAxes[1]!, activeDoc.document.classification.permission)} · ${activeDoc.document.classification.permission}</span>
    </div>
    ${renderClassificationMatrix(activeDoc.document)}
    ${renderLevelGuide()}
    <dl class="file-meta">
      <div><dt>자료구분</dt><dd>현상 조사 기록</dd></div>
      <div><dt>언어</dt><dd>한국어</dd></div>
      <div><dt>등록상태</dt><dd class="live-value">기준본</dd></div>
      <div><dt>구조버전</dt><dd>4.0</dd></div>
    </dl>
    <a class="raw-link" href="index.json">구조화 자료(JSON) <span aria-hidden="true">↗</span></a>
    <nav class="section-nav" aria-label="문서 목차">
      <p>문서 목차</p>
      <ol data-section-nav></ol>
    </nav>
  </aside>
  <div class="dossier-content">
    <div class="dossier-banner">
      <span>기록관리번호 COS-${activeDoc.document.id}</span>
      <span>무결성 확인값 ${String(activeDoc.document.id * 7919).slice(-6).padStart(6, '0')}</span>
    </div>
    <article class="dossier-article" data-dossier>
${article}
    </article>
    <nav class="record-navigation" aria-label="기록 이동">${navigation}</nav>
    <footer class="document-footer"><span>문서 끝 · COS${activeDoc.document.id}</span><span>기준본 등록 상태</span></footer>
  </div>
</main>`
}

const rootJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': organizationId,
      name: siteTitle,
      url: siteUrl,
      logo: {
        '@type': 'ImageObject',
        url: `${siteUrl}favicon.svg`,
        width: 64,
        height: 64
      }
    },
    {
      '@type': 'WebSite',
      '@id': websiteId,
      name: siteTitle,
      description: siteDescription,
      url: siteUrl,
      inLanguage: 'ko-KR',
      publisher: { '@id': organizationId },
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${siteUrl}?q={search_term_string}`
        },
        'query-input': 'required name=search_term_string'
      }
    },
    {
      '@type': 'CollectionPage',
      '@id': collectionId,
      name: rootPageTitle,
      description: siteDescription,
      url: siteUrl,
      inLanguage: 'ko-KR',
      isPartOf: { '@id': websiteId },
      about: { '@id': datasetId },
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: docs.length,
        itemListOrder: 'https://schema.org/ItemListOrderAscending',
        itemListElement: docs.map((doc, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          item: {
            '@type': 'Article',
            '@id': `${doc.url}#article`,
            name: doc.title,
            url: doc.url
          }
        }))
      }
    },
    {
      '@type': 'Dataset',
      '@id': datasetId,
      name: `${siteTitle} structured dossier corpus`,
      description: siteDescription,
      url: `${siteUrl}corpus.json`,
      inLanguage: 'ko-KR',
      creator: { '@id': organizationId },
      isPartOf: { '@id': websiteId },
      distribution: [
        {
          '@type': 'DataDownload',
          contentUrl: `${siteUrl}corpus.json`,
          encodingFormat: 'application/json'
        },
        {
          '@type': 'DataDownload',
          contentUrl: `${siteUrl}index.json`,
          encodingFormat: 'application/json'
        }
      ]
    }
  ]
}

await rm(siteDir, { recursive: true, force: true })
await mkdir(siteDir, { recursive: true })
await cp('public', siteDir, { recursive: true })

if (docs.length === 0) {
  throw new Error('No COS records found in docs/')
}

await writeFile(join(siteDir, 'index.html'), buildHtml(
  rootPageTitle,
  buildMetaTags({
    title: rootPageTitle,
    description: siteDescription,
    canonical: siteUrl,
    jsonUrl: `${siteUrl}index.json`,
    type: 'website',
    jsonLd: rootJsonLd,
    keywords: siteKeywords
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
  sitemapUrl: `${siteUrl}sitemap.xml`,
  feedUrl: `${siteUrl}feed.xml`,
  searchUrlTemplate: `${siteUrl}?q={searchTerms}`,
  records: docs.map((doc) => ({
    id: doc.document.id,
    code: `COS${doc.document.id}`,
    title: doc.document.title,
    description: doc.description,
    canonicalUrl: doc.url,
    jsonUrl: doc.jsonUrl,
    classification: doc.document.classification,
    personnel: doc.document.narrative.personnel.map((person) => person.name),
    references: getReferences(doc.document)
  }))
}, null, 2)}\n`)

for (const [index, doc] of docs.entries()) {
  const outputDir = join(siteDir, 'docs', doc.id)
  const previous = docs[index - 1]
  const next = docs[index + 1]
  const references = getReferences(doc.document)
  const pageId = `${doc.url}#webpage`
  const articleId = `${doc.url}#article`
  const breadcrumbId = `${doc.url}#breadcrumb`
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        '@id': breadcrumbId,
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: siteTitle,
            item: siteUrl
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: doc.title,
            item: doc.url
          }
        ]
      },
      {
        '@type': 'WebPage',
        '@id': pageId,
        name: `${doc.title} | ${siteTitle}`,
        description: doc.description,
        url: doc.url,
        inLanguage: 'ko-KR',
        isPartOf: { '@id': websiteId },
        breadcrumb: { '@id': breadcrumbId },
        mainEntity: { '@id': articleId },
        primaryImageOfPage: {
          '@type': 'ImageObject',
          url: `${siteUrl}og.svg`,
          width: 1200,
          height: 630
        }
      },
      {
        '@type': 'Article',
        '@id': articleId,
        headline: doc.title,
        description: doc.description,
        url: doc.url,
        mainEntityOfPage: { '@id': pageId },
        inLanguage: 'ko-KR',
        isAccessibleForFree: true,
        author: { '@id': organizationId },
        publisher: { '@id': organizationId },
        isPartOf: { '@id': collectionId },
        image: `${siteUrl}og.svg`,
        identifier: `COS${doc.document.id}`,
        keywords: doc.keywords,
        wordCount: plainText(doc.body).split(/\s+/).filter(Boolean).length,
        articleSection: ['분류 근거', '담당 및 관련 인원', '처리 이력', '주요 보고 내역', '증거물 및 자료', '관리 지침', '영향 평가', '면담 기록'],
        about: {
          '@type': 'Thing',
          name: doc.document.title,
          identifier: `COS${doc.document.id}`
        },
        mentions: doc.document.narrative.personnel.map((person) => ({
          '@type': 'Person',
          name: person.name,
          jobTitle: person.role
        })),
        citation: references.map((id) => `${siteUrl}docs/cos${id}/`),
        encoding: {
          '@type': 'MediaObject',
          contentUrl: doc.jsonUrl,
          encodingFormat: 'application/json'
        }
      }
    ]
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
      jsonLd,
      keywords: doc.keywords.slice(0, 24),
      ...(previous ? { previousUrl: previous.url } : {}),
      ...(next ? { nextUrl: next.url } : {})
    }),
    renderDocument(doc, index)
  ))
  await writeFile(join(outputDir, 'index.json'), `${JSON.stringify(getJsonResource(doc), null, 2)}\n`)
}

const sitemapUrls = [
  siteUrl,
  ...docs.map((doc) => doc.url)
]

await writeFile(
  join(siteDir, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls
  .map((url) => `  <url><loc>${escapeHtml(url)}</loc></url>`)
  .join('\n')}
</urlset>
`
)

await writeFile(
  join(siteDir, 'feed.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeHtml(siteTitle)}</title>
    <link>${escapeHtml(siteUrl)}</link>
    <description>${escapeHtml(siteDescription)}</description>
    <language>ko-KR</language>
    <atom:link href="${escapeHtml(`${siteUrl}feed.xml`)}" rel="self" type="application/rss+xml" />
${docs.slice().reverse().map((doc) => `    <item>
      <title>${escapeHtml(doc.title)}</title>
      <link>${escapeHtml(doc.url)}</link>
      <guid isPermaLink="true">${escapeHtml(doc.url)}</guid>
      <description>${escapeHtml(doc.description)}</description>
    </item>`).join('\n')}
  </channel>
</rss>
`
)

await writeFile(
  join(siteDir, 'opensearch.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/">
  <ShortName>${escapeHtml(siteTitle)}</ShortName>
  <Description>${escapeHtml(siteDescription)}</Description>
  <InputEncoding>UTF-8</InputEncoding>
  <Url type="text/html" template="${escapeHtml(`${siteUrl}?q={searchTerms}`)}" />
</OpenSearchDescription>
`
)

await writeFile(
  join(siteDir, 'robots.txt'),
  `User-agent: *
Allow: /

Sitemap: ${siteUrl}sitemap.xml

# Syndication feed: ${siteUrl}feed.xml

# LLM-oriented discovery and context files
# ${siteUrl}llms.txt
`
)

await writeFile(
  join(siteDir, 'llms.txt'),
  `# ${siteTitle}

> ${siteDescription} 현재 ${docs.length}건의 한국어 구조화 조사 기록을 제공합니다.

COS identifiers begin at COS100. Relationships between records are part of the corpus. Prefer the structured JSON resources below over HTML when extracting content.

## Complete Archive

- [Full structured corpus](${siteUrl}corpus.json): Every COS dossier in one versioned JSON document.
- [Archive index](${siteUrl}index.json): Concise structured index with descriptions and relationship IDs.
- [RSS feed](${siteUrl}feed.xml): Record discovery feed ordered by COS identifier.

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
