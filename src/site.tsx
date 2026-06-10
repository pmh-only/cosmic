import React from 'react'
import { createRoot } from 'react-dom/client'
import { Animator, Dots, FrameNefrex, MovingLines, Text } from '@arwes/react'
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

function App(): JSX.Element {
  const [activeId, setActiveId] = React.useState(docs[0]?.id ?? '')
  const activeDoc = docs.find((doc) => doc.id === activeId) ?? docs[0]

  const selectDoc = (id: string): void => {
    if (docs.some((doc) => doc.id === id)) {
      setActiveId(id)
    }
  }

  return (
    <Animator root active manager="stagger" duration={{ enter: 0.8, exit: 0.4 }}>
      <main className="shell">
        <div className="backdrop" aria-hidden="true">
          <Dots positioned color="rgba(43, 245, 255, 0.42)" type="cross" distance={32} size={1} />
          <MovingLines positioned lineColor="rgba(177, 90, 255, 0.18)" lineWidth={1} distance={48} sets={6} />
          <div className="nebula nebula-a" />
          <div className="nebula nebula-b" />
          <div className="scanline" />
        </div>

        <section className="hero">
          <p className="eyebrow">classified cos index</p>
          <Text as="h1" fixed blink characters="01ABCDEF#_-">
            COSMIC Archive
          </Text>
          <p>
            Autonomous dossier interface for anomalous COS markdown records. New files committed to
            <code> docs/</code> are absorbed into this encrypted starfield at build time.
          </p>
        </section>

        <div className="console-grid">
          <aside className="panel nav-panel">
            <FrameNefrex positioned animated padding={18} squareSize={24} strokeWidth={2} />
            <div className="panel-content">
              <div className="panel-kicker">signals detected</div>
              <h2>{docs.length.toString().padStart(2, '0')} records</h2>
              <div className="doc-list">
                {docs.map((doc) => (
                  <button
                    className={doc.id === activeDoc?.id ? 'doc-button active' : 'doc-button'}
                    key={doc.id}
                    type="button"
                    onClick={() => selectDoc(doc.id)}
                  >
                    <span>{doc.id.toUpperCase()}</span>
                    <small>{doc.title.replace(/^COS\d+\s+[—-]\s+/, '')}</small>
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <article className="panel read-panel">
            <FrameNefrex positioned animated padding={22} squareSize={32} strokeWidth={2} />
            <div className="panel-content markdown-shell">
              {activeDoc ? (
                <ReactMarkdown
                  components={{
                    a: ({ href, children }) => {
                      const targetId = href?.split('/').pop()?.replace(/\.md(#.*)?$/, '')
                      if (targetId && docs.some((doc) => doc.id === targetId)) {
                        return (
                          <button className="inline-link" type="button" onClick={() => selectDoc(targetId)}>
                            {children}
                          </button>
                        )
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
          </article>
        </div>
      </main>
    </Animator>
  )
}

createRoot(document.getElementById('root') as HTMLElement).render(<App />)
