import { describe, expect, it } from 'vitest'
import { LocalAIProvider, RuleBasedProvider } from './providers'

describe('assistant providers', () => {
  it('uses transparent rules to ask about missing contribution, outcome and scale', () => {
    const provider = new RuleBasedProvider()
    expect(provider.questionsFor('Responsible for platform support.')).toEqual(['contribution', 'outcome', 'scale'])
  })

  it('keeps unavailable local AI explicit instead of returning simulated output', () => {
    const provider = new LocalAIProvider()
    expect(provider.available).toBe(false)
    expect(() => provider.questionsFor()).toThrow('unavailable')
  })
})
