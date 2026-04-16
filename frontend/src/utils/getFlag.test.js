import { describe, it, expect } from 'vitest'
import { getFlag } from './getFlag'

describe('getFlag utility', () => {
  it('returns the correct flag for all supported nationalities', () => {
    expect(getFlag('American')).toBe('🇺🇸')
    expect(getFlag('Russian')).toBe('🇷🇺')
    expect(getFlag('Chinese')).toBe('🇨🇳')
    expect(getFlag('Japanese')).toBe('🇯🇵')
    expect(getFlag('Canadian')).toBe('🇨🇦')
    expect(getFlag('Italian')).toBe('🇮🇹')
    expect(getFlag('French')).toBe('🇫🇷')
    expect(getFlag('German')).toBe('🇩🇪')
    expect(getFlag('British')).toBe('🇬🇧')
    expect(getFlag('UK')).toBe('🇬🇧')
    expect(getFlag('Dutch')).toBe('🇳🇱')
    expect(getFlag('Swedish')).toBe('🇸🇪')
    expect(getFlag('Emirati')).toBe('🇦🇪')
    expect(getFlag('UAE')).toBe('🇦🇪')
    expect(getFlag('Saudi')).toBe('🇸🇦')
    expect(getFlag('Indian')).toBe('🇮🇳')
    expect(getFlag('Belgian')).toBe('🇧🇪')
    expect(getFlag('Danish')).toBe('🇩🇰')
  })

  it('is case-insensitive', () => {
    expect(getFlag('aMeRiCaN')).toBe('🇺🇸')
    expect(getFlag('RUSSIAN')).toBe('🇷🇺')
    expect(getFlag('uk')).toBe('🇬🇧')
    expect(getFlag('uAe')).toBe('🇦🇪')
  })

  it('works when nationality is embedded within a longer string', () => {
    expect(getFlag('United States of American')).toBe('🇺🇸')
    expect(getFlag('French Guiana')).toBe('🇫🇷')
  })

  it('returns the default globe emoji for unsupported nationalities', () => {
    expect(getFlag('Martian')).toBe('🌍')
    expect(getFlag('Atlantian')).toBe('🌍')
    expect(getFlag('Unknown')).toBe('🌍')
  })

  it('returns the default globe emoji for null, undefined, or empty inputs', () => {
    expect(getFlag(null)).toBe('🌍')
    expect(getFlag(undefined)).toBe('🌍')
    expect(getFlag('')).toBe('🌍')
  })
})
