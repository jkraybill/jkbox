import { describe, it, expect } from 'vitest'
import { generateRoomCode } from './room-code'

describe('generateRoomCode', () => {
  it('should generate a 4-character code', () => {
    const code = generateRoomCode()
    expect(code).toHaveLength(4)
  })

  it('should generate uppercase letters only', () => {
    const code = generateRoomCode()
    expect(code).toMatch(/^[A-Z]{4}$/)
  })

  it('should generate different codes on successive calls', () => {
    const codes = new Set<string>()
    for (let i = 0; i < 100; i++) {
      codes.add(generateRoomCode())
    }

    // Should have high uniqueness (allow small collision rate)
    expect(codes.size).toBeGreaterThan(90)
  })
})
