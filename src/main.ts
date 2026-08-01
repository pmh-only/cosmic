import 'dotenv/config'
import { Agent, tool } from '@strands-agents/sdk'
import { OpenAIModel } from '@strands-agents/sdk/models/openai'
import z from 'zod'
import { readFile, rename, writeFile } from 'node:fs/promises'
import {
  applyCosPatches,
  cosDocumentSchema,
  cosPatchSchema,
  cosReadableFieldSchema,
  parseCosDocument,
  serializeCosDocument,
  type CosDocument
} from './cos-document.js'

const model = new OpenAIModel({
  apiKey: process.env['OPENAI_API_KEY'] ?? '<KEY>',
  modelId: 'gpt-5.4',
  params: {
    reasoning: {
      effort: 'xhigh'
    }
  }
})

function getDocumentPath(id: number): string {
  return `./docs/cos${id}.json`
}

async function loadDocument(id: number): Promise<CosDocument> {
  return parseCosDocument(JSON.parse(await readFile(getDocumentPath(id), 'utf-8')))
}

async function saveDocument(document: CosDocument): Promise<void> {
  const path = getDocumentPath(document.id)
  const temporaryPath = `${path}.${process.pid}.tmp`
  await writeFile(temporaryPath, serializeCosDocument(document))
  await rename(temporaryPath, path)
}

const readDocs = tool({
  name: 'read_docs',
  description: 'Read the structured JSON document for COS N',
  inputSchema: z.object({
    id: z.number().describe('COS Id'),
    field: cosReadableFieldSchema.optional().describe('Optional top-level field to read instead of the full document')
  }),
  callback: async (input) => {
    console.log('Trying to read COS #', input.id)
    const document = await loadDocument(input.id)
    return input.field
      ? JSON.stringify({ id: document.id, field: input.field, value: document[input.field] }, null, 2)
      : serializeCosDocument(document)
  }
})

const writeDocs = tool({
  name: 'write_docs',
  description: 'Create or replace a validated structured COS JSON document',
  inputSchema: cosDocumentSchema,
  callback: async (input) => {
    const document = parseCosDocument(input)
    console.log('Trying to write COS #', document.id)
    await saveDocument(document)
    return true
  }
})

const patchDocs = tool({
  name: 'patch_docs',
  description: 'Atomically apply targeted typed changes to one COS document without rewriting unrelated fields',
  inputSchema: z.object({
    id: z.number().describe('COS Id'),
    patches: z.array(cosPatchSchema).min(1).describe('Ordered changes to apply in one atomic update')
  }),
  callback: async (input) => {
    console.log('Trying to patch COS #', input.id, 'with', input.patches.length, 'operations')
    const document = await loadDocument(input.id)
    const updated = applyCosPatches(document, input.patches)
    await saveDocument(updated)
    return JSON.stringify({ id: updated.id, appliedOperations: input.patches.length })
  }
})

const agent = new Agent({
  model,
  tools: [readDocs, writeDocs, patchDocs]
})

const id = Number.parseInt(await readFile('./lastId.txt', 'utf-8'))+1

await agent.invoke(`
  미지의 존재 혹은 물체 혹은 현상인 COS${id}의 대한 문서를 작성하시오.
  write_docs 도구를 사용해 schemaVersion 2의 구조화 JSON 문서로 저장하시오.
  overview, identificationTraits, discovery, behavior.summary, behavior.stages, relationships.summary, relationships.entries, experiments, handlingProcedures, hypotheses, riskAssessment, notes, amendments, supplementalSections 필드를 의미에 맞게 작성하시오.
  관계는 targetId, targetTitle, description으로, 행동 단계는 name과 description으로, 위험은 category와 assessment로 구조화하시오.
  notes는 원래 순서를 유지하는 paragraph 또는 quotation 타입의 항목 배열로 작성하시오.
  문자열 필드 내부에서만 Markdown 문법을 사용할 수 있습니다.
  기존 다른 COS들과의 연관성을 한번 이상 서술하시오. COS Id는 #100 부터 시작합니다.
  100 부터 ${id - 1}까지 랜덤하게 COS를 골라 존재할 경우 연관성을 작성하시오. (적어도 5개의 COS와 연관 짓습니다.)
  다른 COS를 언급할때는 [...](./cos{n}.json)를 통해 다른 Object를 링크하시오.
  다른 COS를 서술하는 내용을 적을때는 read_docs로 amendments 필드만 읽고 patch_docs의 upsert_amendment 연산으로 reciprocal amendment를 추가하시오.
  기존 JSON 전체를 다시 쓰지 말고 부분 수정은 patch_docs를 사용하며, 서로 관련된 여러 변경은 patches 배열 한 번에 적용하시오.`)

await writeFile('./lastId.txt', id.toString())
process.exit(0)
