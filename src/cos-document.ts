import z from 'zod'

const textListSchema = z.array(z.string().min(1))

export const behaviorStageSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1)
})

export const relationshipSchema = z.object({
  targetId: z.number().int().min(100),
  targetTitle: z.string().min(1),
  description: z.string().min(1)
})

export const experimentSchema = z.object({
  label: z.string().min(1),
  description: z.string().min(1)
})

export const riskSchema = z.object({
  category: z.string().min(1),
  assessment: z.string().min(1)
})

export const amendmentSchema = z.object({
  relatedId: z.number().int().min(100).nullable(),
  type: z.enum(['reciprocal', 'extended', 'reclassification', 'supplemental']),
  title: z.string().min(1),
  paragraphs: z.array(z.string().min(1)).min(1)
})

export const supplementalSectionSchema = z.object({
  title: z.string().min(1),
  paragraphs: z.array(z.string().min(1)).min(1)
})

export const noteSchema = z.object({
  type: z.enum(['paragraph', 'quotation']),
  content: z.string().min(1)
})

export const cosReadableFieldSchema = z.enum([
  'overview',
  'identificationTraits',
  'discovery',
  'behavior',
  'relationships',
  'experiments',
  'handlingProcedures',
  'hypotheses',
  'riskAssessment',
  'notes',
  'amendments',
  'supplementalSections'
])

const cosTextFieldSchema = z.enum([
  'overview',
  'identificationTraits',
  'discovery',
  'behaviorSummary',
  'relationshipSummary',
  'handlingProcedures',
  'hypotheses'
])

export const cosPatchSchema = z.discriminatedUnion('operation', [
  z.object({
    operation: z.literal('set_title'),
    title: z.string().min(1)
  }),
  z.object({
    operation: z.literal('append_text'),
    field: cosTextFieldSchema,
    value: z.string().min(1)
  }),
  z.object({
    operation: z.literal('replace_text'),
    field: cosTextFieldSchema,
    index: z.number().int().min(0),
    value: z.string().min(1)
  }),
  z.object({
    operation: z.literal('upsert_behavior_stage'),
    stage: behaviorStageSchema
  }),
  z.object({
    operation: z.literal('upsert_relationship'),
    relationship: relationshipSchema
  }),
  z.object({
    operation: z.literal('upsert_experiment'),
    experiment: experimentSchema
  }),
  z.object({
    operation: z.literal('upsert_risk'),
    risk: riskSchema
  }),
  z.object({
    operation: z.literal('append_note'),
    note: noteSchema
  }),
  z.object({
    operation: z.literal('replace_note'),
    index: z.number().int().min(0),
    note: noteSchema
  }),
  z.object({
    operation: z.literal('upsert_amendment'),
    amendment: amendmentSchema
  }),
  z.object({
    operation: z.literal('upsert_supplemental_section'),
    section: supplementalSectionSchema
  })
])

export type CosPatch = z.infer<typeof cosPatchSchema>

export const cosDocumentSchema = z.object({
  schemaVersion: z.literal(2),
  id: z.number().int().min(100),
  title: z.string().min(1),
  language: z.literal('ko-KR'),
  overview: z.array(z.string().min(1)).min(1),
  identificationTraits: z.array(z.string().min(1)).min(1),
  discovery: z.array(z.string().min(1)).min(1),
  behavior: z.object({
    summary: textListSchema,
    stages: z.array(behaviorStageSchema).min(1)
  }),
  relationships: z.object({
    summary: textListSchema,
    entries: z.array(relationshipSchema).min(1)
  }),
  experiments: z.array(experimentSchema),
  handlingProcedures: z.array(z.string().min(1)).min(1),
  hypotheses: z.array(z.string().min(1)).min(1),
  riskAssessment: z.array(riskSchema).min(1),
  notes: z.array(noteSchema),
  amendments: z.array(amendmentSchema),
  supplementalSections: z.array(supplementalSectionSchema)
})

export type CosDocument = z.infer<typeof cosDocumentSchema>

export function parseCosDocument(value: unknown): CosDocument {
  return cosDocumentSchema.parse(value)
}

export function serializeCosDocument(document: CosDocument): string {
  return `${JSON.stringify(parseCosDocument(document), null, 2)}\n`
}

function getTextField(document: CosDocument, field: z.infer<typeof cosTextFieldSchema>): string[] {
  switch (field) {
    case 'behaviorSummary':
      return document.behavior.summary
    case 'relationshipSummary':
      return document.relationships.summary
    default:
      return document[field]
  }
}

function upsertBy<T>(items: T[], item: T, matches: (candidate: T) => boolean): void {
  const index = items.findIndex(matches)
  if (index === -1) {
    items.push(item)
  } else {
    items[index] = item
  }
}

export function applyCosPatches(document: CosDocument, patches: CosPatch[]): CosDocument {
  const updated = structuredClone(document)

  for (const patch of patches) {
    switch (patch.operation) {
      case 'set_title':
        updated.title = patch.title
        break
      case 'append_text':
        getTextField(updated, patch.field).push(patch.value)
        break
      case 'replace_text': {
        const values = getTextField(updated, patch.field)
        if (patch.index >= values.length) {
          throw new Error(`${patch.field}[${patch.index}] does not exist`)
        }
        values[patch.index] = patch.value
        break
      }
      case 'upsert_behavior_stage':
        upsertBy(updated.behavior.stages, patch.stage, (stage) => stage.name === patch.stage.name)
        break
      case 'upsert_relationship':
        upsertBy(updated.relationships.entries, patch.relationship, (relationship) => relationship.targetId === patch.relationship.targetId)
        break
      case 'upsert_experiment':
        upsertBy(updated.experiments, patch.experiment, (experiment) => experiment.label === patch.experiment.label)
        break
      case 'upsert_risk':
        upsertBy(updated.riskAssessment, patch.risk, (risk) => risk.category === patch.risk.category)
        break
      case 'append_note':
        updated.notes.push(patch.note)
        break
      case 'replace_note':
        if (patch.index >= updated.notes.length) {
          throw new Error(`notes[${patch.index}] does not exist`)
        }
        updated.notes[patch.index] = patch.note
        break
      case 'upsert_amendment':
        upsertBy(updated.amendments, patch.amendment, (amendment) => amendment.title === patch.amendment.title)
        break
      case 'upsert_supplemental_section':
        upsertBy(updated.supplementalSections, patch.section, (section) => section.title === patch.section.title)
        break
    }
  }

  return parseCosDocument(updated)
}

function renderParagraphs(paragraphs: string[]): string {
  return paragraphs.join('\n\n')
}

function renderList(items: string[]): string {
  return items.map((item) => `- ${item}`).join('\n')
}

export function renderCosDocument(document: CosDocument): string {
  const sections = [
    `## 개요\n\n${renderParagraphs(document.overview)}`,
    `## 식별 특성\n\n${renderList(document.identificationTraits)}`,
    `## 발견 경위\n\n${renderParagraphs(document.discovery)}`,
    `## 행동 및 영향\n\n${[
      renderParagraphs(document.behavior.summary),
      document.behavior.stages.map((stage, index) => `${index + 1}. **${stage.name}**  \n   ${stage.description}`).join('\n\n')
    ].filter(Boolean).join('\n\n')}`,
    `## 다른 COS와의 연관성\n\n${[
      renderParagraphs(document.relationships.summary),
      document.relationships.entries
        .map((relationship) => `- [COS${relationship.targetId} — ${relationship.targetTitle}](./cos${relationship.targetId}.json): ${relationship.description}`)
        .join('\n\n')
    ].filter(Boolean).join('\n\n')}`,
    document.experiments.length > 0
      ? `## 실험 기록 요약\n\n${document.experiments.map((experiment) => `- **${experiment.label}**: ${experiment.description}`).join('\n')}`
      : '',
    `## 취급 절차\n\n${renderList(document.handlingProcedures)}`,
    `## 현재 가설\n\n${renderParagraphs(document.hypotheses)}`,
    `## 위험도\n\n${document.riskAssessment.map((risk) => `- ${risk.category}: ${risk.assessment}`).join('\n')}`,
    `## 비고\n\n${document.notes.map((note) => note.type === 'quotation'
      ? note.content.split('\n').map((line) => `> ${line}`).join('\n')
      : note.content
    ).join('\n\n')}`,
    ...document.amendments.map((amendment) => `## ${amendment.title}\n\n${renderParagraphs(amendment.paragraphs)}`),
    ...document.supplementalSections.map((section) => `## ${section.title}\n\n${renderParagraphs(section.paragraphs)}`)
  ].filter(Boolean)

  return `# COS${document.id} — ${document.title}\n\n${sections.join('\n\n')}\n`
}
