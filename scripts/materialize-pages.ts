import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { join, parse } from 'node:path'

const siteDir = 'site-dist'
const docsDir = 'docs'
const indexHtml = await readFile(join(siteDir, 'index.html'), 'utf-8')
const entries = await readdir(docsDir)

for (const entry of entries) {
  if (!entry.endsWith('.md')) {
    continue
  }

  const id = parse(entry).name
  const outputDir = join(siteDir, 'docs', id)
  await mkdir(outputDir, { recursive: true })
  await writeFile(join(outputDir, 'index.html'), indexHtml)
}
