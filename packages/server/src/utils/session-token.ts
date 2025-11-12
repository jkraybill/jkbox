import { randomBytes } from 'crypto'

/**
 * Generate a cryptographically secure session token
 * Used for player reconnection (stored in localStorage)
 */
export function generateSessionToken(): string {
  // 32 bytes = 256 bits of entropy
  return randomBytes(32).toString('hex')
}

/**
 * Generate a unique player ID
 */
export function generatePlayerId(): string {
  // 16 bytes = 128 bits of entropy
  return `player-${randomBytes(16).toString('hex')}`
}
