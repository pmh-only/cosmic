import { createRoot } from 'react-dom/client'
import { Animated, Animator, Dots, FrameKranox, FrameNefrex, GridLines, Illuminator, MovingLines, Puffs, Text } from '@arwes/react'
import ReactMarkdown from 'react-markdown'
import './site.css'

const modules = import.meta.glob('../docs/*.md', {
  query: '?raw',
  import: 'default',
  eager: true
}) as Record<string, string>

const docs = Object.entries(modules)
  .map(([path, body]) => {
    const id = path.split('/').pop()?.replace(/\.md$/, '') ?? path
    const title = body.match(/^#\s+(.+)$/m)?.[1] ?? id.toUpperCase()
    return { id, title, body }
  })
  .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))

const basePath = new URL(import.meta.env.BASE_URL, window.location.origin).pathname

function getDocHref(id: string): string {
  return `${basePath}docs/${id}/`
}

function getActiveId(): string {
  const path = window.location.pathname
  const relativePath = path.startsWith(basePath) ? path.slice(basePath.length) : path.replace(/^\//, '')
  return relativePath.match(/^docs\/([^/]+)/)?.[1] ?? docs[0]?.id ?? ''
}

function App(): JSX.Element {
  const activeId = getActiveId()
  const activeDoc = docs.find((doc) => doc.id === activeId) ?? docs[0]

  return (
    <Animator root active manager="stagger" duration={{ enter: 0.95, exit: 0.35, stagger: 0.08 }}>
      <main className="shell">
        <div className="backdrop" aria-hidden="true">
          <GridLines positioned lineColor="rgba(80, 251, 255, 0.18)" distance={64} lineWidth={1} />
          <Dots positioned color="rgba(43, 245, 255, 0.42)" type="cross" distance={32} size={1} />
          <MovingLines positioned lineColor="rgba(177, 90, 255, 0.18)" lineWidth={1} distance={48} sets={6} />
          <Puffs positioned color="rgba(106, 66, 255, 0.16)" quantity={34} padding={80} radiusInitial={8} radiusOffset={[24, 90]} sets={6} />
          <div className="nebula nebula-a" />
          <div className="nebula nebula-b" />
          <div className="scanline" />
        </div>

        <Animated
          as="section"
          className="hero"
          animated={['fade', ['y', 32, 0], ['filter', 'blur(8px)', 'blur(0px)']]}
        >
          <p className="eyebrow">classified cos index</p>
          <Text as="h1" fixed blink characters="01ABCDEF#_-">
            COSMIC Archive
          </Text>
          <p>
            Autonomous dossier interface for anomalous COS markdown records. New files committed to
            <code> docs/</code> are absorbed into this encrypted starfield at build time.
          </p>
        </Animated>

        <div className="console-grid">
          <Animated as="aside" className="panel nav-panel" animated={['fade', ['x', -36, 0], ['scale', 0.97, 1]]}>
            <FrameNefrex positioned animated padding={18} squareSize={24} strokeWidth={2} />
            <Illuminator color="rgba(97, 245, 255, 0.26)" size={240} className="illuminator" />
            <div className="panel-content">
              <div className="panel-kicker">signals detected</div>
              <h2>{docs.length.toString().padStart(2, '0')} records</h2>
              <div className="doc-list">
                {docs.map((doc) => (
                  <Animator key={doc.id} duration={{ enter: 0.34 }}>
                    <Animated as="a" animated={['fade', ['x', -18, 0]]} className={doc.id === activeDoc?.id ? 'doc-button active' : 'doc-button'} href={getDocHref(doc.id)}>
                      <span>{doc.id.toUpperCase()}</span>
                      <small>{doc.title.replace(/^COS\d+\s+[—-]\s+/, '')}</small>
                    </Animated>
                  </Animator>
                ))}
              </div>
            </div>
          </Animated>

          <Animated as="article" className="panel read-panel" animated={['fade', ['x', 42, 0], ['scale', 0.985, 1]]}>
            <FrameKranox positioned animated padding={22} strokeWidth={2} squareSize={28} smallLineLength={16} largeLineLength={96} />
            <Illuminator color="rgba(160, 91, 255, 0.28)" size={340} className="illuminator" />
            <div className="panel-content markdown-shell" key={activeDoc?.id}>
              {activeDoc ? (
                <ReactMarkdown
                  components={{
                    a: ({ href, children }) => {
                      const targetId = href?.split('/').pop()?.replace(/\.md(#.*)?$/, '')
                      if (targetId && docs.some((doc) => doc.id === targetId)) {
                        return <a className="inline-link" href={getDocHref(targetId)}>{children}</a>
                      }
                      return <a href={href}>{children}</a>
                    }
                  }}
                >
                  {activeDoc.body}
                </ReactMarkdown>
              ) : (
                <p>No COS records found in docs/.</p>
              )}
            </div>
          </Animated>
        </div>
      </main>
    </Animator>
  )
}

createRoot(document.getElementById('root') as HTMLElement).render(<App />)
