export type JobMatchResult = {
  found: string[]
  missing: string[]
  related: string[]
  score: number
}

const stopWords = new Set('about after again against also among because before being between both could does doing each from have into more most other should some such than that their them then there these they this through under until very what when where which while with would your the and for are was were has had not but all can our you who will job role work skills years required preferred'.split(' '))
const synonyms: Record<string, string[]> = {
  managed: ['led', 'coordinated'],
  liderou: ['coordenou', 'gerenciou'],
  developed: ['built', 'created'],
  desenvolveu: ['criou', 'construiu'],
  analysis: ['analytical'],
  análise: ['analítico'],
  communication: ['communicated'],
  comunicação: ['comunicou'],
}

export function compareResumeToJob(resumeText: string, jobText: string): JobMatchResult {
  const normalizedResume = resumeText.toLocaleLowerCase()
  const candidates = [...new Set((jobText.toLocaleLowerCase().match(/\b[\p{L}][\p{L}\p{N}+#.-]{3,}\b/gu) ?? [])
    .filter((word) => !stopWords.has(word) && !/^\d+$/.test(word)))]
  const terms = candidates.slice(0, 40)
  const found = terms.filter((word) => normalizedResume.includes(word))
  const related = terms.filter((word) => !found.includes(word) && (synonyms[word] ?? []).some((variant) => normalizedResume.includes(variant)))
  const missing = terms.filter((word) => !found.includes(word) && !related.includes(word))
  const score = terms.length ? Math.round((found.length + related.length * 0.5) / terms.length * 100) : 0
  return { found, related, missing, score }
}
