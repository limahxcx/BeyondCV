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
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[:#•*-]/g, '')
    .trim()
}

function getSection(line: string): keyof typeof sectionLabels | undefined {
  const normalized = normalizedHeading(line)
  return Object.keys(sectionLabels).find((label) => normalized === normalizedHeading(label))
}

function asLines(text: string): string[] {
  return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
}

function parseExperience(lines: string[]): Experience[] {
  const chunks: string[][] = []
  for (const line of lines) {
    if (/^(?:[-*•]|\d+[.)])\s*/.test(line) && chunks.length > 0) {
      chunks[chunks.length - 1].push(line.replace(/^(?:[-*•]|\d+[.)])\s*/, ''))
    } else if (chunks.length === 0 || /\b(?:19|20)\d{2}\b/.test(line) || /\s[|@]\s/.test(line)) {
      chunks.push([line])
    } else {
      chunks[chunks.length - 1].push(line)
    }
  }
  return chunks.map((chunk, index) => {
    const heading = chunk[0] ?? ''
    const dates = heading.match(/\b(?:19|20)\d{2}\b(?:\s*[-–—]\s*(?:present|current|atual|presente|19|20)\d{0,4})?/i)?.[0] ?? ''
    const parts = heading.split(/\s+[|@]\s+|\s+-\s+/).map((part) => part.trim())
    return {
      id: `experience-${index + 1}`,
      role: parts[0] ?? heading,
      company: parts[1] ?? '',
      dates,
      description: chunk.slice(1).join('\n') || (parts.length > 1 ? heading : ''),
    }
  })
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
  for (const line of lines) {
    const heading = getSection(line)
    if (heading) {
      current = sectionLabels[heading]
      if (!sections.has(current)) sections.set(current, [])
    } else {
      sections.get(current)?.push(line)
    }
  }

  const intro = sections.get('intro') ?? []
  resume.name = intro.find((line) => !line.includes('@') && !/^\+?[\d\s().-]{8,}$/.test(line) && !/^https?:\/\//i.test(line)) ?? ''
  resume.summary = (sections.get('summary') ?? []).join('\n')
  resume.experiences = parseExperience(sections.get('experiences') ?? [])
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
