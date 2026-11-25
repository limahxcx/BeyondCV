import { describe, expect, it } from 'vitest'
import { parseResumeText } from './resume'
import { evaluateResume } from './scoring'

const genericResume = `Taylor Morgan
taylor@example.com
Experience
Operations Coordinator | Northwind | 2021 - 2024
Responsible for daily shipping operations.
Education
Diploma in Logistics
Skills
Scheduling, customer service`

describe('resume scoring', () => {
  it('is deterministic for identical resume text', () => {
    const resume = parseResumeText(genericResume)
    const first = evaluateResume(genericResume, resume)
    const second = evaluateResume(genericResume, resume)
    expect(first.overall).toBe(second.overall)
    expect(first.categories.map(({ id, score }) => [id, score])).toEqual(second.categories.map(({ id, score }) => [id, score]))
    expect(first.overall).toBeGreaterThanOrEqual(0)
    expect(first.overall).toBeLessThanOrEqual(100)
  })

  it('identifies generic responsibilities and provides contextual questions', () => {
    const resume = parseResumeText(genericResume)
    const result = evaluateResume(genericResume, resume)
    const generic = result.recommendations.find((item) => item.title === 'Replace generic responsibility phrasing')
    expect(generic?.original).toContain('Responsible for')
    expect(generic?.questions.length).toBeGreaterThan(0)
    expect(result.recommendations.some((item) => item.title === 'Make contributions and outcomes clearer')).toBe(true)
  })

  it('recognizes qualitative delivery without requiring a number', () => {
    const text = `Alex Rivera
alex@example.com
Experience
Warehouse Lead | Contoso | 2019 - 2022
Implemented a shift handover process to improve continuity between teams.
Education
Certificate in Operations
Skills
Scheduling, inventory`
    const resume = parseResumeText(text)
    const result = evaluateResume(text, resume)
    expect(resume.experiences).toHaveLength(1)
    expect(resume.experiences[0]?.description).toContain('Implemented')
    expect(result.strengths).toContain('At least one experience includes a concrete action or outcome.')
    expect(result.recommendations.some((item) => item.title === 'Make contributions and outcomes clearer')).toBe(false)
  })

  it('recognizes result metrics and resumes in Portuguese and Spanish', () => {
    const portuguese = `Ana Souza
ana@example.com
Resumo profissional
Profissional de operações.
Experiência
Coordenadora | Acme | 2021 - 2024
Reduzi o tempo de processamento em 35% após reorganizar o fluxo da equipe.
Competências
Operações, planejamento`
    const spanish = `Luis Perez
luis@example.com
Experiencia
Coordinador | Acme | 2020 - 2023
Mejoré la coordinación entre equipos y reduje retrabajo.
Educación
Formación técnica
Habilidades
Operaciones`
    const ptResume = parseResumeText(portuguese)
    const esResume = parseResumeText(spanish)
    expect(ptResume.experiences).toHaveLength(1)
    expect(ptResume.skills).toContain('Operações')
    expect(evaluateResume(portuguese, ptResume).strengths).toContain('At least one experience includes a concrete action or outcome.')
    expect(esResume.experiences).toHaveLength(1)
    expect(esResume.education).toContain('Formación técnica')
  })

  it('does not reduce completeness for not listing education', () => {
    const text = `Taylor Morgan
taylor@example.com
SUMMARY
Experienced operations coordinator working across service teams.
EXPERIENCE
Operations Coordinator | Northwind | 2021 - 2024
Improved service coordination and resolved daily operational issues.
SKILLS
Scheduling, customer service`
    const result = evaluateResume(text, parseResumeText(text))
    expect(result.recommendations.some((item) => item.title.includes('Education'))).toBe(false)
    expect(result.categories.find((category) => category.id === 'completeness')?.score).toBe(100)
  })

  it('does not count years or a phone number as impact metrics', () => {
    const text = `Jamie Lee
jamie@example.com
Phone 555-010-1020
Experience
Operations Associate | Northwind | 2018 - 2021
Handled routine scheduling and records.
Education
Coursework in operations
Skills
Scheduling`
    const resume = parseResumeText(text)
    const result = evaluateResume(text, resume)
    expect(resume.experiences).toHaveLength(1)
    expect(resume.phone).toBe('555-010-1020')
    expect(result.recommendations.some((item) => item.title === 'Make contributions and outcomes clearer')).toBe(true)
  })

  it('does not mistake an experience date range for a phone number', () => {
    const text = `Taylor Morgan
Experience
Operations Associate | Northwind | 2021 - 2024
Supported daily operations across multiple teams.`
    expect(parseResumeText(text).phone).toBe('')
  })

  it('withholds the score when readable content is insufficient', () => {
    const text = 'Short draft'
    const result = evaluateResume(text, parseResumeText(text))
    expect(result.overall).toBeNull()
    expect(result.categories.every((category) => !category.assessed)).toBe(true)
  })
})
