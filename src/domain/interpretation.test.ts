import { describe, expect, it } from 'vitest'
import { interpretResume, parseResumeText } from './resume'
import { evaluateResume } from './scoring'

const headings = [
  'Experiência profissional', 'Experiências profissionais', 'Experiência', 'Histórico profissional',
  'Trajetória profissional', 'Histórico de carreira', 'Professional Experience', 'Work Experience',
  'Employment History', 'Career History', 'Experience', 'Professional Background',
  'Experiencia profesional', 'Experiencia laboral', 'Trayectoria profesional',
]

describe('interpretação de currículos', () => {
  it.each(headings)('reconhece o título %s com espaços e símbolos', (heading) => {
    const text = `Pessoa Exemplo\n${heading.toUpperCase().replace(/ /g, '\u00a0  ')} ✦\nGerente | Empresa Fictícia | 2019 – 2023\n• Melhorei processos e reduzi o prazo em 30%.\nFormação\nCurso superior`
    const { resume, interpretation } = interpretResume(text)
    expect(resume.rawText).toBe(text)
    expect(resume.experiences).toHaveLength(1)
    expect(resume.experiences[0].description).toContain('30%')
    expect(interpretation.status).toBe('high')
    expect(evaluateResume(text, resume, interpretation).overall).not.toBeNull()
  })

  it('reconhece trajetórias executivas e múltiplas experiências com datas e marcadores', () => {
    const text = `Marina Exemplo
Histórico profissional
Diretora | Empresa Aurora | 2018 – 2022
• Aumentei a receita em 25% e desenvolvi equipes.
Gerente | Empresa Horizonte | 2022 – atual
• Melhorei o processo de atendimento e reduzi retrabalho.
Formação
Administração`
    const { resume, interpretation } = interpretResume(text)
    expect(resume.experiences).toHaveLength(2)
    expect(resume.experiences.map((item) => item.company)).toEqual(['Empresa Aurora', 'Empresa Horizonte'])
    expect(resume.experiences[0].description).toContain('25%')
    expect(resume.experiences[1].description).toContain('retrabalho')
    expect(interpretation.impactIndicators).toHaveLength(2)
  })

  it('interpreta estrutura de Engineering Manager semelhante a LaTeX e Awesome-CV', () => {
    const text = `Jordan Example
Professional
Experience
Engineering Manager
Fictional Labs | Jan 2021 – Dec 2024
• Led engineering teams and improved delivery by 35%.
Senior Software Engineer
Example Systems | 2017 – 2020
• Delivered a reliable platform for customers.
Education
Computer Science`
    const { resume, interpretation } = interpretResume(text)
    expect(resume.experiences).toHaveLength(2)
    expect(resume.experiences[0]).toMatchObject({ role: 'Engineering Manager', company: 'Fictional Labs', dates: 'Jan 2021 – Dec 2024' })
    expect(resume.experiences[1].role).toBe('Senior Software Engineer')
    expect(interpretation.status).toBe('high')
  })

  it('associa empresa, cargo e datas em linhas separadas sem criar experiências fictícias', () => {
    const text = `Pessoa Exemplo
Experiência profissional
Empresa Aurora
Gerente de projetos
2018 - 2021
• Melhorei a entrega da equipe.
Empresa Horizonte
Diretora
2022 - 2024
• Reduzi o prazo dos projetos em 20%.
Formação
Administração`
    const { resume, interpretation } = interpretResume(text)
    expect(resume.experiences).toHaveLength(2)
    expect(resume.experiences[0]).toMatchObject({ role: 'Gerente de projetos', company: 'Empresa Aurora', dates: '2018 - 2021' })
    expect(resume.experiences[1]).toMatchObject({ role: 'Diretora', company: 'Empresa Horizonte', dates: '2022 - 2024' })
    expect(interpretation.status).toBe('high')
  })

  it('identifica indícios sem título, sem fingir certeza', () => {
    const text = `Luisa Exemplo
luisa@example.com
Engineering Manager | Example Labs | 2020 – 2024
• Improved delivery time by 40% for the team.
Education
Computer Science`
    const { resume, interpretation } = interpretResume(text)
    expect(resume.experiences).toHaveLength(1)
    expect(interpretation.status).toBe('partial')
    const evaluation = evaluateResume(text, resume, interpretation)
    expect(evaluation.overall).toBeNull()
    expect(evaluation.categories.find((category) => category.id === 'impact')?.status).toBe('unavailable')
    expect(evaluation.categories.find((category) => category.id === 'ats')?.score).not.toBe(100)
  })

  it('identifica profissão fora do vocabulário de cargos quando há empresa, período e atividades', () => {
    const text = `Carla Exemplo
Enfermeira | Clínica Exemplo | 2019 - 2023
• Organizei o atendimento e melhorei a comunicação com pacientes.
Formação
Enfermagem`
    const { resume, interpretation } = interpretResume(text)
    expect(resume.experiences).toHaveLength(1)
    expect(resume.experiences[0].role).toBe('Enfermeira')
    expect(interpretation.status).toBe('partial')
  })

  it('permite classificar texto original ou confirmar ausência sem alterar o currículo', () => {
    const passage = 'Coordinadora | Empresa Ejemplo | 2020 - 2023\n• Mejoré los procesos para clientes.'
    const text = `Luis Ejemplo\nPerfil\n${passage}\nEducación\nDiploma técnico`
    const corrected = interpretResume(text, { mode: 'selected', passages: [passage] })
    expect(corrected.resume.rawText).toBe(text)
    expect(corrected.resume.experiences[0].description).toContain('Mejoré')
    expect(evaluateResume(text, corrected.resume, corrected.interpretation).overall).not.toBeNull()
    const novice = 'Pessoa Exemplo\nFormação\nCurso técnico em andamento\nCompetências\nOrganização, atendimento e comunicação.'
    const unknown = interpretResume(novice)
    expect(unknown.interpretation.status).toBe('potential')
    expect(evaluateResume(novice, unknown.resume, unknown.interpretation).overall).toBeNull()
    const absent = interpretResume(novice, { mode: 'absent', passages: [] })
    const result = evaluateResume(novice, absent.resume, absent.interpretation)
    expect(result.categories.find((category) => category.id === 'impact')?.status).toBe('not-applicable')
    expect(result.coverage).toBe(55)
    expect(result.overall).toBeNull()
  })

  it('não presume avaliação completa a partir de um trecho manual insuficiente', () => {
    const text = 'Pessoa Exemplo\nEngineering Manager\nConteúdo adicional sobre a trajetória profissional e formação.'
    const { resume, interpretation } = interpretResume(text, { mode: 'selected', passages: ['Engineering Manager'] })
    expect(interpretation.status).toBe('partial')
    expect(evaluateResume(text, resume, interpretation).overall).toBeNull()
  })

  it('corrige cargo, empresa e período apenas com dados do trecho original', () => {
    const passage = 'Example Labs | Engineering Manager | 2020 - 2024\n• Improved team delivery and reduced delays.'
    const text = `Pessoa Exemplo\n${passage}\nEducation\nComputer Science`
    const details = [{ role: 'Engineering Manager', company: 'Example Labs', dates: '2020 - 2024' }]
    const result = interpretResume(text, { mode: 'selected', passages: [passage], details })
    expect(result.resume.rawText).toBe(text)
    expect(result.resume.experiences[0]).toMatchObject(details[0])
    expect(() => interpretResume(text, { mode: 'selected', passages: [passage], details: [{ ...details[0], company: 'Inventada' }] })).toThrow('classificação')
  })

  it('aceita trechos selecionados de texto com quebras de linha do Windows', () => {
    const passage = 'Gerente | Empresa | 2020 - 2024\n• Melhorei processos com a equipe.'
    const text = `Pessoa Exemplo\r\nExperiência\r\n${passage.replace('\n', '\r\n')}\r\nFormação\r\nAdministração`
    const result = interpretResume(text, { mode: 'selected', passages: [passage] })
    expect(result.resume.rawText).toBe(text)
    expect(result.interpretation.status).toBe('high')
  })

  it('não interpreta falha de extração como ausência de experiência', () => {
    const text = `Pessoa Exemplo\nEXPERIÊNCIA\nGerente | Empresa Exemplo | 2020 - 2024\n\uFFFD\uFFFD texto de extração danificado.`
    const { resume, interpretation } = interpretResume(text)
    const result = evaluateResume(text, resume, interpretation)
    expect(interpretation.status).toBe('failure')
    expect(result.coverage).toBe(0)
    expect(result.overall).toBeNull()
    expect(result.categories.every((category) => category.status === 'unavailable')).toBe(true)
  })

  it('reconhece datas, resultados qualitativos e campos acadêmicos sem mudar o texto', () => {
    const text = `Persona Ejemplo
EXPERIENCIA LABORAL
Investigadora | Universidad Ejemplo | 2018 - 2022
• Mejoré el proceso de investigación entre equipos.
Educación
Doctorado en Ciencias`
    const resume = parseResumeText(text)
    expect(resume.rawText).toBe(text)
    expect(resume.experiences[0].dates).toBe('2018 - 2022')
    expect(evaluateResume(text, resume).strengths).toContain('Ao menos uma experiência inclui uma ação concreta ou resultado.')
  })
})
