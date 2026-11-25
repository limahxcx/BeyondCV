import { interpretResume, type Interpretation, type Resume } from './resume'

export const SCORING_VERSION = '1.1.0'

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
  status: 'assessed' | 'unavailable' | 'not-applicable'
  note?: string
}

export type ResumeEvaluation = {
  version: string
  overall: number | null
  coverage: number
  categories: CategoryScore[]
  recommendations: Recommendation[]
  strengths: string[]
  limitations: string[]
  assessedAt: string
}

const categoryConfig: { id: CategoryId; label: string; weight: number }[] = [
  { id: 'ats', label: 'Compatibilidade com ATS', weight: 20 },
  { id: 'impact', label: 'Impacto profissional e resultados', weight: 25 },
  { id: 'experience', label: 'Qualidade das experiências', weight: 20 },
  { id: 'structure', label: 'Estrutura e organização', weight: 10 },
  { id: 'skills', label: 'Competências e palavras-chave', weight: 10 },
  { id: 'completeness', label: 'Completude das informações', weight: 10 },
  { id: 'clarity', label: 'Clareza e comunicação', weight: 5 },
]

export function categoryLabel(id: CategoryId): string {
  return categoryConfig.find((category) => category.id === id)!.label
}

type Finding = Omit<Recommendation, 'id'> & { deduction: number }

function hasImpactEvidence(text: string): boolean {
  const normalized = text.toLocaleLowerCase()
  const qualitativeEvidence = /(?:^|[^\p{L}])(?:delivered|launched|improv\p{L}*|reduc\p{L}*|increas\p{L}*|automated|streamlin\p{L}*|resolved|established|resulted|enabled|strengthened|decreased|reduz\p{L}*|aument\p{L}*|melhor\p{L}*|entreg\p{L}*|resolv\p{L}*|estabelec\p{L}*|permitiu|gerou|resultado|mejor\p{L}*|reduj\p{L}*|establec\p{L}*|permitió|generó)(?!\p{L})/iu.test(normalized)
  const numericEvidence = /\b\d+(?:[.,]\d+)?\s*(?:%|(?:percent|clientes|customers|usuários|users|usuarios|horas|hours|dias|days|equipes|teams|sistemas|systems|projetos|projects|milhões|million|k|x)(?!\p{L}))/iu.test(normalized)
  return qualitativeEvidence || numericEvidence
}

function findingsFor(text: string, resume: Resume): Finding[] {
  const findings: Finding[] = []
  const experienceText = resume.experiences.map((item) => `${item.role}\n${item.company}\n${item.description}`).join('\n')
  const intro = text.split(/\r?\n/).slice(0, 7).join('\n')
  const headings = /\b(experience|experiência|experiencia|education|educação|educacion|skills|competências|habilidades)\b/i.test(text)

  if (!headings) findings.push({
    category: 'ats', severity: 'High', title: 'Use títulos de seção reconhecíveis',
    problem: 'Não foram identificados títulos convencionais de experiência, formação ou competências.',
    original: text.slice(0, 180), explanation: 'Títulos claros e convencionais ajudam pessoas e sistemas a localizar as seções do currículo.',
    relevance: 'Sistemas ATS interpretam documentos de maneiras diferentes; títulos convencionais reduzem ambiguidades.',
    questions: ['Você pode identificar as seções principais com títulos como Experiência, Formação e Competências?'],
    action: 'Adicione títulos claros às seções existentes.', deduction: 25,
  })
  const unusualCharacter = [...text].find((character) => {
    const code = character.charCodeAt(0)
    return code === 0xfffd || code < 9 || (code > 13 && code < 32)
  })
  if (unusualCharacter) findings.push({
    category: 'ats', severity: 'Medium', title: 'Revise caracteres incomuns',
    problem: 'O texto extraído contém caracteres de substituição ou controle.',
    original: unusualCharacter, explanation: 'Caracteres inesperados podem indicar problemas de codificação ou extração.',
    relevance: 'Um sistema pode interpretar esses caracteres de maneira diferente da esperada.', questions: ['Esse caractere aparece no documento original?'],
    action: 'Revise o trecho e, se necessário, exporte novamente o documento original.', deduction: 15,
  })
  if (resume.experiences.length > 0 && !resume.experiences.some((item) => hasImpactEvidence(item.description))) {
    findings.push({
      category: 'impact', severity: 'High', title: 'Deixe suas contribuições e resultados mais claros',
      problem: 'As descrições apresentam responsabilidades, mas nenhuma contribuição ou resultado claro foi identificado.',
      original: resume.experiences[0]?.description || experienceText.slice(0, 180),
      explanation: 'O texto não evidencia mudanças, entregas ou resultados. Isso não significa que o trabalho não teve impacto.',
      relevance: 'Resultados específicos e verdadeiros ajudam a compreender o valor e a abrangência do seu trabalho.',
      questions: ['O que mudou como resultado do seu trabalho?', 'Qual foi sua contribuição individual?', 'Quem ou o que foi beneficiado por esse trabalho?'],
      action: 'Adicione contexto e um resultado confirmado; resultados qualitativos também são válidos.',
      suggestion: 'Inclua o problema ou contexto, sua contribuição específica e o resultado confirmado.',
      deduction: 38,
    })
  } else if (resume.experiences.length > 0 && !resume.experiences.some((item) => /\b(?:%|customers?|clients?|users?|hours?|days?|teams?|systems?|projects?|usuários|clientes|horas|equipes|sistemas|projetos)\b/i.test(item.description))) {
    findings.push({
      category: 'impact', severity: 'Low', title: 'Inclua a abrangência quando puder compartilhá-la',
      problem: 'Nenhum indicador de escala ou abrangência foi identificado nas experiências.',
      original: resume.experiences[0]?.description ?? '',
      explanation: 'Resultados qualitativos são importantes. A abrangência é opcional e deve ser verdadeira e não confidencial.',
      relevance: 'O contexto ajuda a compreender a complexidade de um resultado.',
      questions: ['Você pode descrever a abrangência sem revelar informações confidenciais, como o tamanho da equipe ou o tipo de operação?'],
      action: 'Se fizer sentido, adicione uma informação qualitativa confirmada sobre a abrangência, sem revelar dados confidenciais.',
      deduction: 0,
    })
  }
  const generic = experienceText.match(/\b(responsible for|responsável por|encarregado de|in charge of|duties included|atividades incluíam|encargado de)\b[^\n.]*/i)?.[0]
  if (generic) findings.push({
    category: 'experience', severity: 'Medium', title: 'Torne a descrição da responsabilidade mais específica',
    problem: 'Uma descrição genérica não mostra claramente o que você realizou.',
    original: generic, explanation: 'Um verbo de ação e uma contribuição específica ajudam a entender sua participação.',
    relevance: 'O contexto permite diferenciar seu trabalho de uma descrição genérica de cargo.',
    questions: ['O que você criou, mudou, decidiu ou entregou pessoalmente?'],
    action: 'Descreva uma ação concreta e seu contexto, mantendo as informações verdadeiras.',
    suggestion: 'Comece com uma ação realizada por você e acrescente o contexto e o resultado confirmado.', deduction: 24,
  })
  if (resume.summary.trim().length < 40) findings.push({
    category: 'completeness', severity: 'Low', title: 'Considere adicionar um resumo profissional conciso',
    problem: 'Nenhum resumo profissional breve foi identificado.',
    original: '', explanation: 'Um resumo breve e relevante pode apresentar seu perfil rapidamente.',
    relevance: 'O resumo é opcional; priorize experiências e competências relevantes em vez de dados pessoais.',
    questions: ['Quais funções, áreas ou pontos fortes descrevem melhor seus objetivos profissionais?'],
    action: 'Adicione um resumo breve se ele ajudar a explicar seu objetivo profissional.', deduction: 10,
  })
  if (resume.skills.length === 0) findings.push({
    category: 'skills', severity: 'Medium', title: 'Destaque suas competências relevantes',
    problem: 'Nenhuma seção de competências foi identificada.',
    original: '', explanation: 'Uma lista objetiva ajuda pessoas e sistemas a localizar competências relevantes.',
    relevance: 'Liste apenas competências que você possa comprovar; não adicione termos apenas para combinar com uma vaga.',
    questions: ['Quais competências relevantes são demonstradas pelas experiências neste currículo?'],
    action: 'Adicione uma lista concisa de competências confirmadas e relevantes para a função.', deduction: 18,
  })
  if (text.length > 0 && text.length < 450) findings.push({
    category: 'structure', severity: 'Low', title: 'Confira se o currículo está completo',
    problem: 'O texto extraído é curto; por isso, a análise pode não refletir o documento completo.',
    original: text.slice(0, 160), explanation: 'Um texto curto pode indicar conteúdo omitido ou um currículo propositalmente conciso.',
    relevance: 'Esta é uma verificação de integridade, não uma exigência para aumentar o currículo.',
    questions: ['Todas as páginas e seções foram extraídas corretamente?'],
    action: 'Compare o texto extraído com o documento original.', deduction: 12,
  })
  const longLine = text.split(/\r?\n/).find((line) => line.length > 260)
  if (longLine) findings.push({
    category: 'clarity', severity: 'Low', title: 'Divida um trecho muito extenso',
    problem: 'Uma linha tem mais de 260 caracteres e pode ser difícil de ler rapidamente.',
    original: longLine.slice(0, 180), explanation: 'Uma linha longa pode reunir várias ideias ou responsabilidades.',
    relevance: 'Frases curtas e objetivas facilitam a leitura e a revisão.',
    questions: ['Esse trecho pode ser dividido em contribuições ou resultados separados?'],
    action: 'Use frases ou tópicos concisos, preservando o significado original.', deduction: 15,
  })
  if (/\b(?:19|20)\d{2}\s*[-–—]\s*(?:19|20)\d{2}\b/.test(text) && /\b(?:19|20)\d{2}\s*[-–—]\s*(?:19|20)\d{2}\b/.test(text)) {
    const matches = text.match(/\b(?:19|20)\d{2}\s*[-–—]\s*(?:19|20)\d{2}\b/g) ?? []
    if (matches.some((range) => {
      const [start, end] = range.split(/\s*[-–—]\s*/).map(Number)
      return end < start
    })) findings.push({
      category: 'structure', severity: 'Medium', title: 'Revise a ordem das datas',
      problem: 'Um período parece terminar antes de começar.',
      original: matches.find((range) => {
        const [start, end] = range.split(/\s*[-–—]\s*/).map(Number)
        return end < start
      }) ?? '', explanation: 'Isso pode ser um erro de digitação ou formatação no documento.',
      relevance: 'Datas coerentes ajudam a compreender a trajetória profissional.', questions: ['Esse período está correto?'],
      action: 'Confira as datas com seus registros originais.', deduction: 12,
    })
  }
  if (!resume.email && !resume.links.length) findings.push({
    category: 'completeness', severity: 'Low', title: 'Informações de contato não foram identificadas',
    problem: 'Nenhum e-mail ou link profissional foi encontrado.',
    original: intro, explanation: 'Uma forma de contato costuma ser útil ao compartilhar um currículo.',
    relevance: 'Inclua apenas os dados que deseja compartilhar; o endereço residencial completo não é necessário.',
    questions: ['Você gostaria de incluir um e-mail ou link profissional?'],
    action: 'Se desejar, adicione uma forma de contato.', deduction: 10,
  })
  return findings
}

export function evaluateResume(text: string, resume: Resume, interpretation: Interpretation = interpretResume(text).interpretation): ResumeEvaluation {
  const cleanText = text.trim()
  if (cleanText.length < 40) {
    return {
      version: SCORING_VERSION,
      overall: null,
      coverage: 0,
      categories: categoryConfig.map((category) => ({ ...category, score: null, assessed: false, status: 'unavailable', note: 'Não há texto suficiente para uma avaliação confiável.' })),
      recommendations: [],
      strengths: [],
      limitations: ['Não há texto legível suficiente para calcular uma pontuação confiável. Revise a extração ou acrescente conteúdo.'],
      assessedAt: new Date().toISOString(),
    }
  }
  const findings = findingsFor(cleanText, resume)
  const categories: CategoryScore[] = categoryConfig.map((category) => {
    const scoped = findings.filter((item) => item.category === category.id)
    const experienceCategory = category.id === 'experience' || category.id === 'impact'
    const failure = interpretation.status === 'failure'
    const uncertain = interpretation.status === 'potential' || interpretation.status === 'partial'
    const notApplicable = experienceCategory && interpretation.status === 'absent'
    const preliminary = Math.max(0, 100 - scoped.reduce((total, item) => total + item.deduction, 0))
    const unavailable = failure || (experienceCategory && uncertain) || (category.id === 'ats' && uncertain && preliminary === 100)
    const assessed = !notApplicable && !unavailable
    const note = notApplicable ? 'Não aplicável: ausência de experiência confirmada por você.' : unavailable ? 'Não foi possível avaliar com confiança. Revise a interpretação; isso não comprova incompatibilidade com sistemas ATS.' : undefined
    return { ...category, score: assessed ? preliminary : null, assessed, status: notApplicable ? 'not-applicable' : unavailable ? 'unavailable' : 'assessed', note }
  })
  const applicable = categories.filter((category): category is CategoryScore & { score: number } => category.assessed && category.score !== null)
  const weightTotal = applicable.reduce((total, category) => total + category.weight, 0)
  const overall = weightTotal >= 80 && !categories.some((category) => category.status === 'unavailable' && (category.id === 'experience' || category.id === 'impact')) ? Math.round(applicable.reduce((total, category) => total + category.score * category.weight, 0) / weightTotal) : null
  const recommendations = findings.filter((item) => categories.find((category) => category.id === item.category)?.assessed).map((item, index): Recommendation => ({
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
  if (resume.experiences.length > 0 && interpretation.status === 'high') strengths.push('Experiências profissionais foram identificadas e avaliadas.')
  if (resume.education.length > 0) strengths.push('Informações de formação ou cursos foram identificadas.')
  if (resume.skills.length > 0) strengths.push('Uma seção de competências foi identificada.')
  if (interpretation.status === 'high' && resume.experiences.some((item) => hasImpactEvidence(item.description))) strengths.push('Ao menos uma experiência inclui uma ação concreta ou resultado.')
  const limitations = [
    'Esta análise usa padrões de texto e pode não compreender todas as profissões, formatos ou resultados.',
    'A pontuação BeyondCV é uma avaliação do projeto, não uma certificação ATS ou previsão de contratação.',
    'Imagens digitalizadas e formatos complexos podem não preservar a ordem de leitura. Compare o texto extraído com o original.',
  ]
  if (overall === null) limitations.unshift('Avaliação incompleta: revise a interpretação. Uma categoria não avaliada não representa um problema no currículo.')
  return { version: SCORING_VERSION, overall, coverage: weightTotal, categories, recommendations, strengths, limitations, assessedAt: new Date().toISOString() }
}
