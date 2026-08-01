import z from 'zod'

const textListSchema = z.array(z.string().min(1))

export const classificationLevelSchema = z.number().int().min(1).max(5)

export const classificationSchema = z.object({
  secrecy: classificationLevelSchema,
  permission: classificationLevelSchema,
  chaos: classificationLevelSchema,
  danger: classificationLevelSchema,
  popularity: classificationLevelSchema,
  containment: classificationLevelSchema
})

export const classificationRationaleSchema = z.object({
  secrecy: z.string().min(1),
  permission: z.string().min(1),
  chaos: z.string().min(1),
  danger: z.string().min(1),
  popularity: z.string().min(1),
  containment: z.string().min(1)
})

export const personnelSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  status: z.enum(['active', 'reassigned', 'medical-leave', 'missing', 'deceased', 'unknown']),
  involvement: z.string().min(1)
})

export const timelineEventSchema = z.object({
  date: z.string().min(1),
  label: z.string().min(1),
  description: z.string().min(1)
})

export const incidentReportSchema = z.object({
  code: z.string().min(1),
  date: z.string().min(1),
  location: z.string().min(1),
  title: z.string().min(1),
  involvedPersonnel: z.array(z.string().min(1)).min(1),
  narrative: z.array(z.string().min(1)).min(2),
  outcome: z.string().min(1)
})

export const evidenceRecordSchema = z.object({
  code: z.string().min(1),
  type: z.string().min(1),
  description: z.string().min(1),
  custodyStatus: z.string().min(1)
})

export const testimonySchema = z.object({
  speaker: z.string().min(1),
  role: z.string().min(1),
  context: z.string().min(1),
  statement: z.string().min(1)
})

export const narrativeSchema = z.object({
  personnel: z.array(personnelSchema),
  timeline: z.array(timelineEventSchema),
  incidents: z.array(incidentReportSchema),
  evidence: z.array(evidenceRecordSchema),
  testimonies: z.array(testimonySchema)
})

export type Classification = z.infer<typeof classificationSchema>
export type Narrative = z.infer<typeof narrativeSchema>

export const legacyClassification: Classification = {
  secrecy: 4,
  permission: 4,
  chaos: 3,
  danger: 3,
  popularity: 2,
  containment: 3
}

export const classificationAxes: ReadonlyArray<{
  key: keyof Classification
  code: string
  label: string
  description: string
  levels: readonly [string, string, string, string, string]
  meanings: readonly [string, string, string, string, string]
}> = [
  {
    key: 'secrecy', code: 'SEC', label: 'SECRECY', description: '기록 공개 시 발생하는 정보 노출 및 악용 위험',
    levels: ['PUBLIC', 'RESTRICTED', 'CONFIDENTIAL', 'SECRET', 'TOP SECRET'],
    meanings: ['일반 공개 가능', '내부 인원으로 열람 제한', '업무상 필요 인원만 열람', '유출 시 중대한 피해 예상', '존재 또는 관측 정보 자체가 최고 기밀']
  },
  {
    key: 'permission', code: 'PER', label: 'PERMISSION', description: '안전한 열람과 취급에 필요한 최소 권한',
    levels: ['OBSERVER', 'FIELD', 'RESEARCH', 'COMMAND', 'DIRECTORATE'],
    meanings: ['일반 기록 인원', '훈련된 현장 요원', '전문 연구 책임자', '지휘 권한 보유자', '기관 최고 관리부 승인 필요']
  },
  {
    key: 'chaos', code: 'CHS', label: 'CHAOS', description: '현상의 불규칙성, 전이성 및 예측 불가능성',
    levels: ['STABLE', 'VARIABLE', 'UNSTABLE', 'CHAOTIC', 'CATASTROPHIC'],
    meanings: ['조건과 결과가 안정적', '알려진 조건에서 변동', '전이 가능하나 추적 가능', '재귀적 또는 관측자 의존적 확산', '통제되지 않는 체계 간 증식']
  },
  {
    key: 'danger', code: 'DNG', label: 'DANGER', description: '인명, 시설, 판단 및 기록에 대한 종합 위해',
    levels: ['NEGLIGIBLE', 'GUARDED', 'SEVERE', 'CRITICAL', 'EXTREME'],
    meanings: ['절차상 주의만 필요', '국소적이고 복구 가능한 피해', '중대한 국소 피해', '광범위 피해 또는 위험 행동 유발', '직접적이고 체계적인 극한 피해']
  },
  {
    key: 'popularity', code: 'POP', label: 'POPULARITY', description: '기관 기록망에서의 관측 빈도와 연관 기록 규모',
    levels: ['UNKNOWN', 'OBSCURE', 'NOTABLE', 'WIDESPREAD', 'UBIQUITOUS'],
    meanings: ['참조 기록 8건 이하', '참조 기록 9~13건', '참조 기록 14~18건', '참조 기록 19~27건', '참조 기록 28건 이상']
  },
  {
    key: 'containment', code: 'CNT', label: 'CONTAINMENT', description: '격리와 통제에 필요한 절차의 강도',
    levels: ['ROUTINE', 'CONTROLLED', 'REINFORCED', 'MAXIMUM', 'ABSOLUTE'],
    meanings: ['일상 기록과 감시', '단일 매체 격리', '독립 로그를 포함한 강화 격리', '복수 매체 및 복합 현상 통제', '체계 단위 완전 격리']
  }
]

export function getClassificationLabel(axis: (typeof classificationAxes)[number], level: number): string {
  return axis.levels[level - 1] ?? 'INVALID'
}

export function getClassificationMeaning(axis: (typeof classificationAxes)[number], level: number): string {
  return axis.meanings[level - 1] ?? '유효하지 않은 분류 수준'
}

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
  'classification',
  'classificationRationale',
  'narrative',
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
    operation: z.literal('set_classification'),
    classification: classificationSchema
  }),
  z.object({
    operation: z.literal('set_classification_rationale'),
    rationale: classificationRationaleSchema
  }),
  z.object({
    operation: z.literal('upsert_personnel'),
    person: personnelSchema
  }),
  z.object({
    operation: z.literal('upsert_timeline_event'),
    event: timelineEventSchema
  }),
  z.object({
    operation: z.literal('upsert_incident'),
    incident: incidentReportSchema
  }),
  z.object({
    operation: z.literal('upsert_evidence'),
    evidence: evidenceRecordSchema
  }),
  z.object({
    operation: z.literal('upsert_testimony'),
    testimony: testimonySchema
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

const cosDocumentFields = {
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
}

const legacyCosDocumentSchema = z.object({
  schemaVersion: z.literal(2),
  ...cosDocumentFields
})

const versionThreeCosDocumentSchema = z.object({
  schemaVersion: z.literal(3),
  classification: classificationSchema,
  ...cosDocumentFields
})

export const cosDocumentSchema = z.object({
  schemaVersion: z.literal(4),
  classification: classificationSchema,
  classificationRationale: classificationRationaleSchema,
  narrative: narrativeSchema,
  ...cosDocumentFields
})

export type CosDocument = z.infer<typeof cosDocumentSchema>

function upgradeVersionThreeDocument(document: z.infer<typeof versionThreeCosDocumentSchema>): CosDocument {
  const rationale = Object.fromEntries(classificationAxes.map((axis) => {
    const level = document.classification[axis.key]
    return [axis.key, `기존 기록에서 ${axis.label} 축은 L${level} ${getClassificationLabel(axis, level)}로 분류되었다. 상세 근거는 개정 기록에서 보완한다.`]
  }))

  return cosDocumentSchema.parse({
    ...document,
    schemaVersion: 4,
    classificationRationale: rationale,
    narrative: {
      personnel: [],
      timeline: [],
      incidents: [],
      evidence: [],
      testimonies: []
    }
  })
}

export function parseCosDocument(value: unknown): CosDocument {
  if (typeof value === 'object' && value !== null && 'schemaVersion' in value && value.schemaVersion === 2) {
    const legacyDocument = legacyCosDocumentSchema.parse(value)
    return upgradeVersionThreeDocument(versionThreeCosDocumentSchema.parse({
      ...legacyDocument,
      schemaVersion: 3,
      classification: legacyClassification
    }))
  }
  if (typeof value === 'object' && value !== null && 'schemaVersion' in value && value.schemaVersion === 3) {
    return upgradeVersionThreeDocument(versionThreeCosDocumentSchema.parse(value))
  }
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
      case 'set_classification':
        updated.classification = patch.classification
        break
      case 'set_classification_rationale':
        updated.classificationRationale = patch.rationale
        break
      case 'upsert_personnel':
        upsertBy(updated.narrative.personnel, patch.person, (person) => person.name === patch.person.name)
        break
      case 'upsert_timeline_event':
        upsertBy(updated.narrative.timeline, patch.event, (event) => event.label === patch.event.label)
        break
      case 'upsert_incident':
        upsertBy(updated.narrative.incidents, patch.incident, (incident) => incident.code === patch.incident.code)
        break
      case 'upsert_evidence':
        upsertBy(updated.narrative.evidence, patch.evidence, (evidence) => evidence.code === patch.evidence.code)
        break
      case 'upsert_testimony':
        upsertBy(updated.narrative.testimonies, patch.testimony, (testimony) => testimony.speaker === patch.testimony.speaker && testimony.context === patch.testimony.context)
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

const personnelStatusLabels: Record<z.infer<typeof personnelSchema>['status'], string> = {
  active: '현직',
  reassigned: '전출',
  'medical-leave': '의료 관찰',
  missing: '실종',
  deceased: '사망',
  unknown: '상태 불명'
}

export function renderCosDocument(document: CosDocument): string {
  const sections = [
    `## 개요\n\n${renderParagraphs(document.overview)}`,
    `## 분류 근거\n\n${classificationAxes.map((axis) => {
      const level = document.classification[axis.key]
      return `- **${axis.code} — ${axis.label} / L${level} ${getClassificationLabel(axis, level)}**: ${document.classificationRationale[axis.key]} _(${getClassificationMeaning(axis, level)})_`
    }).join('\n')}`,
    `## 식별 특성\n\n${renderList(document.identificationTraits)}`,
    `## 발견 경위\n\n${renderParagraphs(document.discovery)}`,
    document.narrative.personnel.length > 0
      ? `## 관련 인원\n\n${document.narrative.personnel.map((person) => `- **${person.name}** — ${person.role} / ${personnelStatusLabels[person.status]}\n  ${person.involvement}`).join('\n')}`
      : '',
    document.narrative.timeline.length > 0
      ? `## 사건 연대기\n\n${document.narrative.timeline.map((event) => `- **${event.date} — ${event.label}**: ${event.description}`).join('\n')}`
      : '',
    document.narrative.incidents.length > 0
      ? `## 주요 사건 기록\n\n${document.narrative.incidents.map((incident) => [
        `### ${incident.code} — ${incident.title}`,
        `**일시:** ${incident.date}  \n**장소:** ${incident.location}  \n**관련 인원:** ${incident.involvedPersonnel.join(', ')}`,
        renderParagraphs(incident.narrative),
        `**결과:** ${incident.outcome}`
      ].join('\n\n')).join('\n\n')}`
      : '',
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
    document.narrative.evidence.length > 0
      ? `## 증거물 및 자료\n\n${document.narrative.evidence.map((evidence) => `- **${evidence.code} / ${evidence.type}**: ${evidence.description}  \n  보관 상태: ${evidence.custodyStatus}`).join('\n')}`
      : '',
    `## 취급 절차\n\n${renderList(document.handlingProcedures)}`,
    `## 현재 가설\n\n${renderParagraphs(document.hypotheses)}`,
    `## 위험도\n\n${document.riskAssessment.map((risk) => `- ${risk.category}: ${risk.assessment}`).join('\n')}`,
    document.narrative.testimonies.length > 0
      ? `## 증언 기록\n\n${document.narrative.testimonies.map((testimony) => `**${testimony.speaker} / ${testimony.role} — ${testimony.context}**\n\n${testimony.statement.split('\n').map((line) => `> ${line}`).join('\n')}`).join('\n\n')}`
      : '',
    `## 비고\n\n${document.notes.map((note) => note.type === 'quotation'
      ? note.content.split('\n').map((line) => `> ${line}`).join('\n')
      : note.content
    ).join('\n\n')}`,
    ...document.amendments.map((amendment) => `## ${amendment.title}\n\n${renderParagraphs(amendment.paragraphs)}`),
    ...document.supplementalSections.map((section) => `## ${section.title}\n\n${renderParagraphs(section.paragraphs)}`)
  ].filter(Boolean)

  return `# COS${document.id} — ${document.title}\n\n${sections.join('\n\n')}\n`
}
