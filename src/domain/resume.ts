import { z } from 'zod'

export type Experience = {
  id: string
  role: string
  company: string
  dates: string
  description: string
}

export type ResumeTemplate = 'classic' | 'modern' | 'executive'

export type Resume = {
  id: string
  name: string
  email: string
  phone: string
  location: string
  links: string[]
  summary: string
  experiences: Experience[]
  education: string[]
  certifications: string[]
  skills: string[]
  languages: string[]
  projects: string[]
  customSections: { title: string; content: string }[]
  rawText: string
  updatedAt: string
  template: ResumeTemplate
  sectionOrder: string[]
}

export const ResumeSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  phone: z.string(),
  location: z.string(),
  links: z.array(z.string()),
  summary: z.string(),
  experiences: z.array(z.object({
    id: z.string(),
    role: z.string(),
    company: z.string(),
    dates: z.string(),
    description: z.string(),
  })),
  education: z.array(z.string()),
  certifications: z.array(z.string()),
  skills: z.array(z.string()),
  languages: z.array(z.string()),
  projects: z.array(z.string()),
  customSections: z.array(z.object({ title: z.string(), content: z.string() })),
  rawText: z.string(),
  updatedAt: z.string(),
  template: z.enum(['classic', 'modern', 'executive']),
  sectionOrder: z.array(z.string()),
})

export function createEmptyResume(): Resume {
  return {
    id: crypto.randomUUID(),
    name: '',
    email: '',
    phone: '',
    location: '',
    links: [],
    summary: '',
    experiences: [],
    education: [],
    certifications: [],
    skills: [],
    languages: [],
    projects: [],
    customSections: [],
    rawText: '',
    updatedAt: new Date().toISOString(),
    template: 'classic',
    sectionOrder: ['summary', 'experiences', 'education', 'certifications', 'skills', 'languages', 'projects'],
  }
}

const sectionLabels: Record<string, keyof Pick<Resume, 'summary' | 'experiences' | 'education' | 'certifications' | 'skills' | 'languages' | 'projects'>> = {
  summary: 'summary',
  'professional summary': 'summary',
  'resumo profissional': 'summary',
  'perfil profissional': 'summary',
  perfil: 'summary',
  experience: 'experiences',
  experiences: 'experiences',
  'work experience': 'experiences',
  'professional experience': 'experiences',
  'employment history': 'experiences',
  'career history': 'experiences',
  'professional background': 'experiences',
  'historico profissional': 'experiences',
  'trajetoria profissional': 'experiences',
  'historico de carreira': 'experiences',
  'experiencia profesional': 'experiences',
  'experiencia laboral': 'experiences',
  'trayectoria profesional': 'experiences',
  experiência: 'experiences',
  experiências: 'experiences',
  'experiência profissional': 'experiences',
  'experiências profissionais': 'experiences',
  experiencia: 'experiences',
  experiencias: 'experiences',
  educación: 'education',
  educacion: 'education',
  education: 'education',
  formação: 'education',
  'formação acadêmica': 'education',
  'formación académica': 'education',
  certifications: 'certifications',
  certification: 'certifications',
  certificações: 'certifications',
  certificados: 'certifications',
  skills: 'skills',
  'technical skills': 'skills',
  competências: 'skills',
  habilidades: 'skills',
  idiomas: 'languages',
  languages: 'languages',
  projects: 'projects',
  projetos: 'projects',
  proyectos: 'projects',
}

function normalizedHeading(value: string): string {
  return value
    .toLocaleLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\p{Cf}/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getSection(line: string): keyof typeof sectionLabels | undefined {
  const normalized = normalizedHeading(line)
  return Object.keys(sectionLabels).find((label) => normalized === normalizedHeading(label))
}

function asLines(text: string): string[] {
  return text.replace(/\r\n?/g, '\n').split('\n').map((line) => line.replace(/\p{Cf}/gu, '').trim()).filter(Boolean)
}

const dateRange = /\b(?:(?:jan(?:uary|eiro)?|feb(?:ruary)?|fev(?:ereiro)?|mar(?:ch|ço|zo)?|apr(?:il)?|abr(?:il)?|may|mai(?:o)?|jun(?:e|ho|io)?|jul(?:y|ho|io)?|aug(?:ust)?|ago(?:sto)?|sep(?:tember)?|set(?:embro)?|oct(?:ober)?|out(?:ubro)?|octubre|nov(?:ember|embro|iembre)?|dec(?:ember)?|dez(?:embro)?|dic(?:iembre)?)\.?\s+)?(?:19|20)\d{2}\b\s*(?:[-–—−]|a|até|to|al|hasta)\s*(?:(?:(?:jan|feb|fev|mar|apr|abr|may|mai|jun|jul|aug|ago|sep|set|oct|out|nov|dec|dez|dic)[\p{L}]*\.?\s+)?(?:19|20)\d{2}\b|present(?:e)?|current|atual|actual|hoje)/iu
const roleWords = /\b(?:manager|director|engineer|developer|lead|analyst|consultant|coordinator|professor|researcher|executive|officer|designer|architect|specialist|gerente|diretor(?:a)?|engenheir[oa]|desenvolvedor(?:a)?|coordenador(?:a)?|analista|consultor(?:a)?|professor(?:a)?|pesquisador(?:a)?|especialista|gestor(?:a)?|arquitet[oa]|jefe|ingenier[oa]|investigador(?:a)?|respons[aá]vel)\b/i
const bullet = /^(?:[-*•●▪◦‣]|\d+[.)])\s*/
const impactPattern = /(?:\d+(?:[.,]\d+)?\s*(?:%|percent|por cento)|\b(?:improv\w*|reduc\w*|delivered|launched|resolved|aument\w*|melhor\w*|reduz\w*|entreg\w*|resolv\w*|mejor\w*|reduj\w*|resultado)\b)/i

function parseExperience(lines: string[]): Experience[] {
  const starts = [0]
  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i]
    if (bullet.test(line)) continue
    const isHeader = dateRange.test(line) || (roleWords.test(line) && line.length < 110 && !/[.!?]$/.test(line))
    if (!isHeader) continue
    const previous = lines[i - 1]
    const previousIsHeader = !bullet.test(previous) && previous.length < 110 && !/[.!?]$/.test(previous)
    const precedingChunk = lines.slice(starts[starts.length - 1], i - 1)
    if (dateRange.test(line) && previousIsHeader && !dateRange.test(previous) && i - 1 > starts[starts.length - 1] && precedingChunk.some((part) => dateRange.test(part) || bullet.test(part) || /[.!?]$/.test(part))) {
      starts.push(i - 1)
    } else if (roleWords.test(line) && previousIsHeader && i > 1 && bullet.test(lines[i - 2]) && i + 1 < lines.length && dateRange.test(lines[i + 1])) {
      starts.push(i - 1)
    } else if (i > starts[starts.length - 1] && (dateRange.test(lines.slice(starts[starts.length - 1], i).join(' ')) || bullet.test(previous) || /[.!?]$/.test(previous))) {
      starts.push(i)
    }
  }
  return starts.map((start, index) => {
    const chunk = lines.slice(start, starts[index + 1] ?? lines.length)
    const dateIndex = chunk.findIndex((line) => dateRange.test(line))
    const headerEnd = dateIndex >= 0 ? Math.min(dateIndex + 1, 3) : 1
    const headers = chunk.slice(0, headerEnd)
    const dates = headers.join(' ').match(dateRange)?.[0] ?? ''
    const parts = headers.flatMap((line) => line.split(/\s*[|@]\s*/)).map((part) => part.replace(dateRange, '').trim()).filter(Boolean)
    const roleIndex = parts.findIndex((part) => roleWords.test(part))
    const role = roleIndex >= 0 ? parts[roleIndex] : parts[0] ?? ''
    const company = parts.find((_, partIndex) => partIndex !== (roleIndex >= 0 ? roleIndex : 0)) ?? ''
    const description = chunk.slice(headerEnd).join('\n') || (dateIndex < 0 && chunk.length === 1 ? chunk[0] : '')
    return { id: `experience-${index + 1}`, role, company, dates, description }
  }).filter((item) => item.role || item.company || item.description)
}

export type InterpretationStatus = 'high' | 'partial' | 'potential' | 'absent' | 'failure'
export type Interpretation = {
  status: InterpretationStatus
  sections: { label: string; confidence: 'high' | 'partial' }[]
  unclassified: string[]
  impactIndicators: string[]
}

export type ExperienceCorrection = {
  mode: 'automatic' | 'selected' | 'absent'
  passages: string[]
  details?: { role: string; company: string; dates: string }[]
}

export function interpretResume(text: string, correction?: ExperienceCorrection): { resume: Resume; interpretation: Interpretation } {
  const resume = parseResumeText(text)
  const lines = asLines(text)
  const sections: Interpretation['sections'] = []
  for (let index = 0; index < lines.length; index += 1) {
    const combined = index + 1 < lines.length ? `${lines[index]} ${lines[index + 1]}` : ''
    if (combined && getSection(combined)) {
      sections.push({ label: combined, confidence: 'high' })
      index += 1
    } else if (getSection(lines[index])) sections.push({ label: lines[index], confidence: 'high' })
  }
  const corrupted = [...text].some((character) => {
    const code = character.charCodeAt(0)
    return code === 0xfffd || code < 9 || (code > 13 && code < 32)
  }) || (text.trim().length >= 40 && (text.match(/\p{L}/gu)?.length ?? 0) < 20)
  let status: InterpretationStatus = corrupted || text.trim().length < 40 ? 'failure' : resume.experiences.length ? 'high' : 'potential'
  if (resume.experiences.length && resume.experiences.some((item) => !item.description.trim() || (!item.dates && !roleWords.test(item.role)))) status = 'partial'
  const hasExplicitExperience = sections.some((section) => sectionLabels[getSection(section.label)!] === 'experiences')
  if (resume.experiences.length && !hasExplicitExperience && status === 'high') status = 'partial'
  if (resume.experiences.length && !hasExplicitExperience) sections.push({ label: 'Experiências sem título explícito', confidence: 'partial' })
  if (correction?.mode === 'absent') {
    resume.experiences = []
    status = corrupted ? 'failure' : 'absent'
  } else if (correction?.mode === 'selected' && correction.passages.length) {
    if (correction.passages.some((passage) => !passage.trim() || !text.includes(passage))) throw new Error('O trecho selecionado não corresponde ao texto extraído.')
    resume.experiences = correction.passages.flatMap((passage, index) => {
      const details = correction.details?.[index]
      if (details && Object.values(details).some((value) => value.trim() && !passage.includes(value.trim()))) throw new Error('A classificação deve corresponder ao trecho selecionado.')
      return parseExperience(asLines(passage)).map((item, itemIndex) => ({
        ...item, id: `manual-${index}-${itemIndex}`,
        role: itemIndex === 0 && details?.role.trim() ? details.role.trim() : item.role,
        company: itemIndex === 0 && details?.company.trim() ? details.company.trim() : item.company,
        dates: itemIndex === 0 && details?.dates.trim() ? details.dates.trim() : item.dates,
      }))
    })
    const sufficient = resume.experiences.length > 0 && resume.experiences.every((item) => item.description.trim().length >= 20 && item.description.trim() !== item.role.trim())
    status = corrupted ? 'failure' : sufficient ? 'high' : 'partial'
    sections.push({ label: 'Experiências classificadas por você', confidence: status === 'high' ? 'high' : 'partial' })
  }
  if (corrupted) sections.forEach((section) => { section.confidence = 'partial' })
  const known = new Set([...sections.map((section) => section.label), ...resume.experiences.flatMap((item) => [item.role, item.company, item.dates, ...asLines(item.description)]), ...asLines(resume.summary), ...resume.education, ...resume.skills, ...resume.certifications, ...resume.languages, ...resume.projects])
  const unclassified = lines.filter((line) => !known.has(line) && !resume.experiences.some((experience) => line.includes(experience.role) && experience.role.length > 0))
  const impactIndicators = resume.experiences.flatMap((experience) => asLines(experience.description).filter((line) => impactPattern.test(line)))
  return { resume, interpretation: { status, sections, unclassified, impactIndicators } }
}

export function parseResumeText(text: string): Resume {
  const resume = createEmptyResume()
  resume.rawText = text
  resume.email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? ''
  resume.phone = (text.match(/(?:\+?\d[\d\s().-]{7,}\d)/g) ?? []).find((candidate) => {
    const value = candidate.trim()
    return !/^(?:19|20)\d{2}\s*[-–—]\s*(?:19|20)\d{2}$/.test(value) && value.replace(/\D/g, '').length >= 8
  })?.trim() ?? ''
  resume.links = [...new Set(text.match(/(?:https?:\/\/|www\.)[^\s)]+/gi) ?? [])]

  const lines = asLines(text)
  const sections = new Map<string, string[]>()
  let current = 'intro'
  sections.set(current, [])
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const combined = index + 1 < lines.length ? getSection(`${line} ${lines[index + 1]}`) : undefined
    const heading = combined ?? getSection(line)
    if (heading) {
      if (combined) index += 1
      current = sectionLabels[heading]
      if (!sections.has(current)) sections.set(current, [])
    } else {
      sections.get(current)?.push(line)
    }
  }

  const intro = sections.get('intro') ?? []
  resume.name = intro.find((line) => !line.includes('@') && !/^\+?[\d\s().-]{8,}$/.test(line) && !/^https?:\/\//i.test(line)) ?? ''
  resume.summary = (sections.get('summary') ?? []).join('\n')
  const experienceLines = sections.get('experiences') ?? []
  resume.experiences = experienceLines.length ? parseExperience(experienceLines) : []
  if (!experienceLines.length) {
    const introLines = sections.get('intro') ?? []
    const candidates: string[] = []
    for (let index = 0; index < introLines.length; index += 1) {
      const line = introLines[index]
      if (!dateRange.test(line) || bullet.test(line)) continue
      const previous = introLines[index - 1]
      const next = introLines[index + 1]
      if ((!roleWords.test(`${previous ?? ''} ${line}`) && !/[|@]/.test(line)) || !next || !(bullet.test(next) || next.length > 30)) continue
      if (previous && !candidates.includes(previous) && !dateRange.test(previous) && roleWords.test(previous)) candidates.push(previous)
      candidates.push(line)
      let end = index + 1
      while (end < introLines.length && !dateRange.test(introLines[end]) && !(roleWords.test(introLines[end]) && end + 1 < introLines.length && dateRange.test(introLines[end + 1]))) {
        candidates.push(introLines[end])
        end += 1
      }
      index = end - 1
    }
    if (candidates.length) resume.experiences = parseExperience(candidates)
  }
  resume.education = sections.get('education') ?? []
  resume.certifications = sections.get('certifications') ?? []
  resume.skills = (sections.get('skills') ?? []).flatMap((line) => line.split(/[,;|•]/).map((part) => part.trim()).filter(Boolean))
  resume.languages = sections.get('languages') ?? []
  resume.projects = sections.get('projects') ?? []
  return resume
}

export function resumeToText(resume: Resume): string {
  const sections: Record<string, string> = {
    summary: resume.summary ? `RESUMO PROFISSIONAL\n${resume.summary}` : '',
    experiences: resume.experiences.length ? `EXPERIÊNCIA PROFISSIONAL\n${resume.experiences.map((item) => `${item.role}${item.company ? ` | ${item.company}` : ''}${item.dates ? ` | ${item.dates}` : ''}\n${item.description}`).join('\n\n')}` : '',
    education: resume.education.length ? `FORMAÇÃO\n${resume.education.join('\n')}` : '',
    certifications: resume.certifications.length ? `CERTIFICAÇÕES\n${resume.certifications.join('\n')}` : '',
    skills: resume.skills.length ? `COMPETÊNCIAS\n${resume.skills.join(', ')}` : '',
    languages: resume.languages.length ? `IDIOMAS\n${resume.languages.join('\n')}` : '',
    projects: resume.projects.length ? `PROJETOS\n${resume.projects.join('\n')}` : '',
  }
  const header = [resume.name, resume.email, resume.phone, resume.location, ...resume.links].filter(Boolean).join('\n')
  const ordered = resume.sectionOrder.map((key) => sections[key]).filter((section): section is string => Boolean(section))
  const custom = resume.customSections.map((section) => `${section.title.toUpperCase()}\n${section.content}`)
  return [header, ...ordered, ...custom].filter(Boolean).join('\n\n')
}
