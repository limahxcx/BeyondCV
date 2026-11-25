export type InterviewQuestionId = 'contribution' | 'context' | 'outcome' | 'scale'

export interface CareerImpactProvider {
  readonly id: 'rules' | 'local-ai'
  readonly available: boolean
  questionsFor(description: string): InterviewQuestionId[]
}

export class RuleBasedProvider implements CareerImpactProvider {
  readonly id = 'rules' as const
  readonly available = true

  questionsFor(description: string): InterviewQuestionId[] {
    const questions: InterviewQuestionId[] = []
    if (!/\b(?:built|created|designed|developed|implemented|led|coordinated|delivered|managed|reduz|melhor|criou|desenvolv|implement|lider|coorden|entreg|resolv|creó|desarroll|implement|lider|coordin|entreg|resolv)\w*/i.test(description)) {
      questions.push('contribution')
    }
    if (!/\b(?:customer|client|problem|project|platform|process|operation|objective|team|cliente|problema|projeto|plataforma|processo|operaç|equipe|cliente|proyecto|proceso|operación|equipo)\w*/i.test(description)) {
      questions.push('context')
    }
    if (!/\b(?:result|outcome|improv|reduc|increas|launch|deliver|impact|resultado|melhor|reduz|aument|entreg|impacto|resultado|mejor|reduj|aument|impacto)\w*/i.test(description)) {
      questions.push('outcome')
    }
    if (!/\b\d+(?:[.,]\d+)?\s*(?:%|clients?|customers?|users?|hours?|days?|teams?|systems?|projects?|clientes|usuários|horas|dias|equipes|sistemas|projetos|usuarios|equipos|sistemas|proyectos)\b/i.test(description)) {
      questions.push('scale')
    }
    return questions.length ? questions : ['outcome']
  }
}

export class LocalAIProvider implements CareerImpactProvider {
  readonly id = 'local-ai' as const
  readonly available = false

  questionsFor(): InterviewQuestionId[] {
    throw new Error('Local AI is unavailable in this version. No model is downloaded or used.')
  }
}

export const ruleBasedProvider = new RuleBasedProvider()
