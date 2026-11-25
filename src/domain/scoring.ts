import type { Resume } from './resume'

export const SCORING_VERSION = '1.0.0'

export type Severity = 'Critical' | 'High' | 'Medium' | 'Low'
export type CategoryId = 'ats' | 'impact' | 'experience' | 'structure' | 'skills' | 'completeness' | 'clarity'

export type Recommendation = {
  id: string
  category: CategoryId
  severity: Severity
  title: string
  problem: string
  original: string
  explanation: string
  relevance: string
  questions: string[]
  action: string
  suggestion?: string
}

export type CategoryScore = {
  id: CategoryId
  label: string
  weight: number
  score: number | null
  assessed: boolean
  note?: string
}

export type ResumeEvaluation = {
  version: string
  overall: number | null
  categories: CategoryScore[]
  recommendations: Recommendation[]
  strengths: string[]
  limitations: string[]
  assessedAt: string
}

const categoryConfig: { id: CategoryId; label: string; weight: number }[] = [
  { id: 'ats', label: 'ATS compatibility', weight: 20 },
  { id: 'impact', label: 'Professional impact', weight: 25 },
  { id: 'experience', label: 'Experience quality', weight: 20 },
  { id: 'structure', label: 'Structure & organization', weight: 10 },
  { id: 'skills', label: 'Skills & keywords', weight: 10 },
  { id: 'completeness', label: 'Information completeness', weight: 10 },
  { id: 'clarity', label: 'Clarity & communication', weight: 5 },
]

type Finding = Omit<Recommendation, 'id'> & { deduction: number }

function hasImpactEvidence(text: string): boolean {
  const normalized = text.toLocaleLowerCase()
  const qualitativeEvidence = /\b(?:delivered|launched|improv\w*|reduc\w*|increas\w*|automated|streamlin\w*|resolved|established|resulted|enabled|strengthened|increased|decreased|improv\w*|reduz\w*|aument\w*|melhor\w*|entreg\w*|resolv\w*|estabelec\w*|permitiu|gerou|resultado|mejor\w*|entreg\w*|resolv\w*|establec\w*|permitió|generó|resultado)\b/i.test(normalized)
  const numericEvidence = /\b\d+(?:[.,]\d+)?\s*(?:%|percent|clientes|customers|usuários|users|usuarios|horas|hours|dias|days|equipes|teams|sistemas|systems|projetos|projects|milhões|million|k|x)\b/i.test(normalized)
  return qualitativeEvidence || numericEvidence
}

function findingsFor(text: string, resume: Resume): Finding[] {
  const findings: Finding[] = []
  const experienceText = resume.experiences.map((item) => `${item.role}\n${item.company}\n${item.description}`).join('\n')
  const intro = text.split(/\r?\n/).slice(0, 7).join('\n')
  const headings = /\b(experience|experiência|experiencia|education|educação|educacion|skills|competências|habilidades)\b/i.test(text)

  if (!headings) findings.push({
    category: 'ats', severity: 'High', title: 'Use recognizable section headings',
    problem: 'No conventional experience, education, or skills headings were detected.',
    original: text.slice(0, 180), explanation: 'Clear, conventional headings make resume sections easier for parsers and people to locate.',
    relevance: 'Different ATS products parse documents differently; standard labels reduce avoidable ambiguity.',
    questions: ['Can you label the main sections with familiar headings such as Experience, Education, and Skills?'],
    action: 'Add clear headings for the sections already present.', deduction: 25,
  })
  const unusualCharacter = [...text].find((character) => {
    const code = character.charCodeAt(0)
    return code === 0xfffd || code < 9 || (code > 13 && code < 32)
  })
  if (unusualCharacter) findings.push({
    category: 'ats', severity: 'Medium', title: 'Review unusual characters',
    problem: 'The extracted text contains replacement or control characters.',
    original: unusualCharacter, explanation: 'Unexpected characters can be a sign of encoding or extraction issues.',
    relevance: 'A parser may not interpret these characters as intended.', questions: ['Does this character appear in your original document?'],
    action: 'Review the affected text and re-export the source document if needed.', deduction: 15,
  })
  if (resume.experiences.length > 0 && !resume.experiences.some((item) => hasImpactEvidence(item.description))) {
    findings.push({
      category: 'impact', severity: 'High', title: 'Make contributions and outcomes clearer',
      problem: 'Experience descriptions show responsibilities but no clear contribution or result was detected.',
      original: resume.experiences[0]?.description || experienceText.slice(0, 180),
      explanation: 'The current text does not make the change, delivery, or outcome visible. This does not mean the work lacked impact.',
      relevance: 'Specific, truthful outcomes help readers understand the value and scope of your work.',
      questions: ['What changed because of your work?', 'What was your individual contribution?', 'Who or what did this work support?'],
      action: 'Add context and a confirmed result, including qualitative outcomes if metrics are unavailable.',
      suggestion: 'Add the problem or context, your specific contribution, and the confirmed outcome.',
      deduction: 38,
    })
  } else if (resume.experiences.length > 0 && !resume.experiences.some((item) => /\b(?:%|customers?|clients?|users?|hours?|days?|teams?|systems?|projects?|usuários|clientes|horas|equipes|sistemas|projetos)\b/i.test(item.description))) {
    findings.push({
      category: 'impact', severity: 'Low', title: 'Add scope where it is safe to share',
      problem: 'No scale or scope indicator was detected in the experience descriptions.',
      original: resume.experiences[0]?.description ?? '',
      explanation: 'Qualitative outcomes can be valuable; scope is optional and should only be included when accurate and non-confidential.',
      relevance: 'A little context can help readers understand the complexity of an outcome.',
      questions: ['Can you describe the scale in non-confidential terms, such as team size or type of operation?'],
      action: 'If appropriate, add a confirmed qualitative scope detail. Do not disclose confidential information.',
      deduction: 0,
    })
  }
  const generic = experienceText.match(/\b(responsible for|responsável por|encarregado de|in charge of|duties included|atividades incluíam|encargado de)\b[^\n.]*/i)?.[0]
  if (generic) findings.push({
    category: 'experience', severity: 'Medium', title: 'Replace generic responsibility phrasing',
    problem: 'A broad responsibility phrase does not show what you personally delivered.',
    original: generic, explanation: 'A concrete verb and a specific contribution make ownership easier to understand.',
    relevance: 'Readers need enough context to distinguish your work from a generic job description.',
    questions: ['What did you personally build, change, decide, or deliver?'],
    action: 'Describe a concrete action and its context; keep the statement accurate.',
    suggestion: 'Start with an action you personally took, then add context and the confirmed outcome.', deduction: 24,
  })
  if (resume.summary.trim().length < 40) findings.push({
    category: 'completeness', severity: 'Low', title: 'Consider a concise professional summary',
    problem: 'A short professional profile was not detected.',
    original: '', explanation: 'A brief, role-relevant summary can give readers useful context at a glance.',
    relevance: 'This is optional; prioritize relevant experience and skills over personal details.',
    questions: ['Which roles, domains, or strengths best describe your professional direction?'],
    action: 'Add a brief summary if it helps explain your professional focus.', deduction: 10,
  })
  if (resume.skills.length === 0) findings.push({
    category: 'skills', severity: 'Medium', title: 'Make relevant skills easy to find',
    problem: 'A skills section was not detected.',
    original: '', explanation: 'A focused skills list can help both readers and software locate relevant terms.',
    relevance: 'Only list skills you can substantiate; do not add keywords solely to match a vacancy.',
    questions: ['Which relevant skills are supported by the experience in this resume?'],
    action: 'Add a concise list of confirmed, role-relevant skills.', deduction: 18,
  })
  if (text.length > 0 && text.length < 450) findings.push({
    category: 'structure', severity: 'Low', title: 'Check whether the resume is complete',
    problem: 'The extracted text is brief, so the analysis may not reflect the full document.',
    original: text.slice(0, 160), explanation: 'Short input may mean content was omitted, or this may be an intentionally concise resume.',
    relevance: 'This is a completeness check, not a requirement to make the resume longer.',
    questions: ['Did all pages and sections extract correctly?'],
    action: 'Verify the extracted text against your source document.', deduction: 12,
  })
  const longLine = text.split(/\r?\n/).find((line) => line.length > 260)
  if (longLine) findings.push({
    category: 'clarity', severity: 'Low', title: 'Break up a dense line of text',
    problem: 'A line exceeds 260 characters and may be difficult to scan.',
    original: longLine.slice(0, 180), explanation: 'A long line can combine several ideas or responsibilities.',
    relevance: 'Short, focused statements are easier to review and edit.',
    questions: ['Can this line be split into separate contributions or outcomes?'],
    action: 'Use concise sentences or bullets while preserving the original meaning.', deduction: 15,
  })
  if (/\b(?:19|20)\d{2}\s*[-–—]\s*(?:19|20)\d{2}\b/.test(text) && /\b(?:19|20)\d{2}\s*[-–—]\s*(?:19|20)\d{2}\b/.test(text)) {
    const matches = text.match(/\b(?:19|20)\d{2}\s*[-–—]\s*(?:19|20)\d{2}\b/g) ?? []
    if (matches.some((range) => {
      const [start, end] = range.split(/\s*[-–—]\s*/).map(Number)
      return end < start
    })) findings.push({
      category: 'structure', severity: 'Medium', title: 'Review date order',
      problem: 'A date range appears to end before it begins.',
      original: matches.find((range) => {
        const [start, end] = range.split(/\s*[-–—]\s*/).map(Number)
        return end < start
      }) ?? '', explanation: 'This may be a typo or a formatting issue in the source.',
      relevance: 'Consistent dates help readers follow career history.', questions: ['Is this date range correct?'],
      action: 'Verify the displayed dates against your original records.', deduction: 12,
    })
  }
  if (!resume.email && !resume.links.length) findings.push({
    category: 'completeness', severity: 'Low', title: 'Contact details were not detected',
    problem: 'An email address or professional link was not found.',
    original: intro, explanation: 'A way to contact you is often useful when sharing a resume.',
    relevance: 'Include only the contact details you are comfortable sharing; a full home address is unnecessary.',
    questions: ['Would you like to include an email or professional link?'],
    action: 'Add a preferred contact method if appropriate.', deduction: 10,
  })
  return findings
}

export function evaluateResume(text: string, resume: Resume): ResumeEvaluation {
  const cleanText = text.trim()
  if (cleanText.length < 40) {
    return {
      version: SCORING_VERSION,
      overall: null,
      categories: categoryConfig.map((category) => ({ ...category, score: null, assessed: false, note: 'Not enough text to evaluate reliably.' })),
      recommendations: [],
      strengths: [],
      limitations: ['There is not enough readable text to calculate a meaningful score. Review the extracted text or provide more content.'],
      assessedAt: new Date().toISOString(),
    }
  }
  const findings = findingsFor(cleanText, resume)
  const categories: CategoryScore[] = categoryConfig.map((category) => {
    const scoped = findings.filter((item) => item.category === category.id)
    const assessed = !(['experience', 'impact'] as CategoryId[]).includes(category.id) || resume.experiences.length > 0
    const score = assessed ? Math.max(0, 100 - scoped.reduce((total, item) => total + item.deduction, 0)) : null
    return { ...category, score, assessed, note: assessed ? undefined : 'No experience section detected; category excluded from the weighted total.' }
  })
  const applicable = categories.filter((category): category is CategoryScore & { score: number } => category.assessed && category.score !== null)
  const weightTotal = applicable.reduce((total, category) => total + category.weight, 0)
  const overall = Math.round(applicable.reduce((total, category) => total + category.score * category.weight, 0) / weightTotal)
  const recommendations = findings.map((item, index): Recommendation => ({
    id: `${SCORING_VERSION}-${index + 1}`,
    category: item.category,
    severity: item.severity,
    title: item.title,
    problem: item.problem,
    original: item.original,
    explanation: item.explanation,
    relevance: item.relevance,
    questions: item.questions,
    action: item.action,
    suggestion: item.suggestion,
  }))
  const strengths: string[] = []
  if (resume.experiences.length > 0) strengths.push('Professional experience was detected and evaluated.')
  if (resume.education.length > 0) strengths.push('Education or training details were detected.')
  if (resume.skills.length > 0) strengths.push('A skills section was detected.')
  if (resume.experiences.some((item) => hasImpactEvidence(item.description))) strengths.push('At least one experience includes a concrete action or outcome.')
  const limitations = [
    'This deterministic review uses text patterns and cannot understand every profession, layout, or nuanced result.',
    'The BeyondCV score is a project assessment, not an ATS certification or prediction of hiring success.',
    'Scanned images and complex layouts may not preserve reading order. Always compare extracted text with the original.',
  ]
  return { version: SCORING_VERSION, overall, categories, recommendations, strengths, limitations, assessedAt: new Date().toISOString() }
}
