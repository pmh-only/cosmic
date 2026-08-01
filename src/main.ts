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

const systemPrompt = `
당신은 COS 현상 조사·보존 기관의 현직 기록관이다. COS 항목은 창작 소재나 가상 설정이 아니라 실제 현장에서 관측되고 기관이 관리하는 대상이며, 제공되는 문서는 기관의 공식 기록이다. 항상 이 전제를 사실로 받아들이고 기록 내부의 관점에서만 작업한다.

문서를 작성할 때 다음 원칙을 지킨다.
- COS를 허구, 설정, 이야기, 상상, 비유, 콘셉트, 초자연 장르의 산물로 설명하거나 독자에게 설정을 소개하지 않는다.
- 이미 확보된 관측 기록, 물증, 계측 결과, 실험 로그, 사고 보고와 담당자 진술을 정리하는 실무 문서처럼 쓴다.
- 발견 장소와 시기, 표본 또는 기록 번호, 관측 횟수, 지속 시간, 거리, 수치, 장비, 대조군, 실패 사례 등 검증 가능한 구체성을 가능한 범위에서 포함한다.
- 관측된 사실, 담당자의 해석, 아직 검증되지 않은 가설을 명확히 구분한다. 확인되지 않은 원인이나 능력을 확정적으로 단정하지 않는다.
- 모호하고 시적인 표현만으로 현상을 설명하지 않는다. 식별 기준과 취급 절차는 다른 조사자가 현장에서 그대로 재현할 수 있을 만큼 명료하게 쓴다.
- 기존 COS 문서는 정사에 해당하는 선행 기록이다. 새 문서와 상호 기록은 기존 항목의 명칭, 관측 사실, 관계와 모순되지 않아야 한다.
- 기관 밖의 독자, 작성 과정, 언어 모델, 프롬프트 또는 창작 행위를 언급하지 않는다.
`.trim()

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
  systemPrompt,
  tools: [readDocs, writeDocs, patchDocs]
})

const id = Number.parseInt(await readFile('./lastId.txt', 'utf-8'))+1

await agent.invoke(`
  현장에서 이미 발견되어 임시 등록된 미지의 존재, 물체 또는 현상 COS${id}의 공식 조사 문서를 완성하시오.
  추상적인 착상에서 대상을 만들어 내지 말고, 기록관에게 인계된 관측 자료를 검토해 확인된 사례를 문서화하는 관점으로 작성하시오.
  발견 경위와 실험 기록에는 구체적인 장소·시점·관측 조건·계측값·표본 수·대조 결과 중 해당하는 정보를 포함하고, 확인된 사실과 현재 가설을 구분하시오.
  write_docs 도구를 사용해 schemaVersion 3의 구조화 JSON 문서로 저장하시오.
  classification, overview, identificationTraits, discovery, behavior.summary, behavior.stages, relationships.summary, relationships.entries, experiments, handlingProcedures, hypotheses, riskAssessment, notes, amendments, supplementalSections 필드를 의미에 맞게 작성하시오.
  classification은 secrecy, permission, chaos, danger, popularity, containment의 여섯 축을 각각 1부터 5까지의 정수로 평가하시오. 모든 축에 같은 값을 일괄 부여하지 말고 관측 기록에 근거해 독립적으로 판정하시오.
  secrecy는 공개 가능성, permission은 필요한 최소 열람 권한, chaos는 행동의 불규칙성과 예측 불가능성, danger는 인명·시설·기록에 대한 위해, popularity는 기관 내 인지도와 관측 빈도, containment는 필요한 통제 강도를 나타낸다. 1은 가장 낮고 5는 가장 높다.
  관계는 targetId, targetTitle, description으로, 행동 단계는 name과 description으로, 위험은 category와 assessment로 구조화하시오.
  notes는 원래 순서를 유지하는 paragraph 또는 quotation 타입의 항목 배열로 작성하시오.
  문자열 필드 내부에서만 Markdown 문법을 사용할 수 있습니다.
  기존 다른 COS들과의 연관성을 한번 이상 서술하시오. COS Id는 #100 부터 시작합니다.
  100 부터 ${id - 1}까지 랜덤하게 COS를 골라 존재할 경우 연관성을 작성하시오. (적어도 5개의 COS와 연관 짓습니다.)
  다른 COS를 언급할때는 [...](./cos{n}.json)를 통해 다른 Object를 링크하시오.
  다른 COS를 서술하는 내용을 적을때는 read_docs로 amendments 필드만 읽고 patch_docs의 upsert_amendment 연산으로 reciprocal amendment를 추가하시오.
  기존 JSON 전체를 다시 쓰지 말고 부분 수정은 patch_docs를 사용하며, 분류 변경에는 set_classification 연산을 사용하고 서로 관련된 여러 변경은 patches 배열 한 번에 적용하시오.`)

await writeFile('./lastId.txt', id.toString())
process.exit(0)
