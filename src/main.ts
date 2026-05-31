import 'dotenv/config'
import { Agent, tool } from '@strands-agents/sdk'
import { OpenAIModel } from '@strands-agents/sdk/models/openai'
import z from 'zod'
import { readFile, writeFile, appendFile } from 'node:fs/promises'

const model = new OpenAIModel({
  apiKey: process.env['OPENAI_API_KEY'] ?? '<KEY>',
  modelId: 'gpt-5.5',
  params: {
    reasoning: {
      effort: 'xhigh'
    }
  }
})

const readDocs = tool({
  name: 'read_docs',
  description: 'Read document of COS N',
  inputSchema: z.object({
    id: z.number().describe('COS Id')
  }),
  callback: async (input) => {
    console.log('Trying to read COS #', input.id)
    return (await readFile(`./docs/cos${input.id}.md`)).toString('utf-8')
  }
})

const writeDocs = tool({
  name: 'write_docs',
  description: 'Write document of COS N',
  inputSchema: z.object({
    id: z.number().describe('COS Id'),
    content: z.string().describe('COS description in markdown format')
  }),
  callback: async (input) => {
    console.log('Trying to write COS #', input.id, input.content)
    await writeFile(`./docs/cos${input.id}.md`, input.content)
    return true
  }
})

const appendDocs = tool({
  name: 'append_docs',
  description: 'Append text to document of COS N',
  inputSchema: z.object({
    id: z.number().describe('COS Id'),
    content: z.string().describe('COS description in markdown format that will be append')
  }),
  callback: async (input) => {
    console.log('Trying to append COS #', input.id, input.content)
    await appendFile(`./docs/cos${input.id}.md`, input.content)
    return true
  }
})

const agent = new Agent({
  model,
  tools: [readDocs, writeDocs, appendDocs]
})

const id = Number.parseInt(await readFile('./lastId.txt', 'utf-8'))+1

await agent.invoke(`
  미지의 존재 혹은 물체 혹은 현상인 COS${id}의 대한 문서를 작성하시오.
  기존 다른 COS들과의 연관성을 한번 이상 서술하시오. COS Id는 #100 부터 시작합니다.
  100 부터 ${id - 1}까지 랜덤하게 COS를 골라 존재할 경우 연관성을 작성하시오. (적어도 5개의 COS와 연관 짓습니다.)
  다른 COS를 언급할때는 [...](./cos{n}.md)를 통해 다른 Object를 링크하시오.
  다른 COS를 서술하는 내용을 적을때는 기존에 있는 서술 당하는 Object의 문서도 수정하시오`)

await writeFile('./lastId.txt', id.toString())
process.exit(0)
