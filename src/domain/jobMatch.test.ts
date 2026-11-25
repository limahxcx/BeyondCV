import { describe, expect, it } from 'vitest'
import { compareResumeToJob } from './jobMatch'

describe('job text comparison', () => {
  it('separates direct, wording-related, and unlocated terms', () => {
    const result = compareResumeToJob('Led cross-functional teams using TypeScript.', 'TypeScript managed Kubernetes')
    expect(result.found).toContain('typescript')
    expect(result.related).toContain('managed')
    expect(result.missing).toContain('kubernetes')
    expect(result.score).toBeGreaterThan(0)
    expect(result.score).toBeLessThan(100)
  })

  it('does not imply a missing term is an absent skill', () => {
    const result = compareResumeToJob('Customer support experience.', 'Kubernetes required')
    expect(result.missing).toContain('kubernetes')
  })
})
