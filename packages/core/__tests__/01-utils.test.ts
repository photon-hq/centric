/**
 * Core Utility Function Tests
 * Tests for pure utility functions: sanitizeEmDashes, isCatalogQuery,
 * isVagueFollowUp, buildSearchQueries
 */

import { describe, it, expect } from 'bun:test'
import { sanitizeEmDashes } from '../src/lib/prompts.ts'
import { isCatalogQuery, isVagueFollowUp, buildSearchQueries } from '../src/lib/vector-store.ts'

describe('sanitizeEmDashes', () => {
  it('replaces em-dash with comma-space (absorbs surrounding whitespace)', () => {
    // regex \s*[\u2014]\s* consumes spaces, replacement is ", "
    expect(sanitizeEmDashes('Hello ,  world')).toBe('Hello, world')
  })

  it('replaces en-dash with comma-space', () => {
    expect(sanitizeEmDashes('Hello ,  world')).toBe('Hello, world')
  })

  it('handles multiple dashes', () => {
    const result = sanitizeEmDashes('A ,  B ,  C')
    expect(result).toBe('A, B, C')
  })

  it('leaves regular hyphens untouched', () => {
    expect(sanitizeEmDashes('step-by-step')).toBe('step-by-step')
  })

  it('handles empty string', () => {
    expect(sanitizeEmDashes('')).toBe('')
  })

  it('handles text with no dashes', () => {
    expect(sanitizeEmDashes('Hello world')).toBe('Hello world')
  })

  it('strips surrounding whitespace around dash', () => {
    expect(sanitizeEmDashes('before, after')).toBe('before, after')
    expect(sanitizeEmDashes('before  ,   after')).toBe('before, after')
  })
})

describe('isCatalogQuery', () => {
  it('returns true for product listing queries', () => {
    expect(isCatalogQuery('what products do you have')).toBe(true)
    expect(isCatalogQuery('show me all your plans')).toBe(true)
    expect(isCatalogQuery('list everything you offer')).toBe(true)
  })

  it('returns false for specific product queries', () => {
    expect(isCatalogQuery('how do I reset my password')).toBe(false)
    expect(isCatalogQuery('what is the price of the pro plan')).toBe(false)
  })
})

describe('isVagueFollowUp', () => {
  it('returns true for vague follow-up queries', () => {
    expect(isVagueFollowUp('what about pricing')).toBe(true)
    expect(isVagueFollowUp('how about that')).toBe(true)
  })

  it('returns false for long queries (>20 words) even if they start with vague words', () => {
    // The threshold is strictly > 20 words
    const longQuery = 'what is the full detailed breakdown of the cancellation policy for every single plan you currently offer including monthly yearly and lifetime options'
    const wordCount = longQuery.trim().split(/\s+/).length
    expect(wordCount).toBeGreaterThan(20)
    expect(isVagueFollowUp(longQuery)).toBe(false)
  })

  it('returns false for queries containing specific technical keywords', () => {
    // install/setup/configure/compare etc. signal a specific intent
    expect(isVagueFollowUp('how do I install and configure this')).toBe(false)
    expect(isVagueFollowUp('what is the difference between plan A and plan B')).toBe(false)
  })
})

describe('buildSearchQueries', () => {
  it('returns at least one query', () => {
    const queries = buildSearchQueries('how do I get a refund')
    expect(queries.length).toBeGreaterThan(0)
  })

  it('includes the original query', () => {
    const original = 'what is the return policy'
    const queries = buildSearchQueries(original)
    expect(queries).toContain(original)
  })

  it('returns an array', () => {
    expect(Array.isArray(buildSearchQueries('test'))).toBe(true)
  })
})
