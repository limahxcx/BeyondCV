import { describe, expect, it } from 'vitest'
import { translate } from './i18n'

describe('interface translations', () => {
  it('provides separate interface copy for supported locales', () => {
    expect(translate('en', 'navAnalyze')).toBe('Resume Analyzer')
    expect(translate('pt', 'navAnalyze')).toBe('Analisar currículo')
    expect(translate('es', 'navAnalyze')).toBe('Analizar currículum')
  })
})
