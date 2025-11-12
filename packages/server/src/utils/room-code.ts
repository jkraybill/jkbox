/**
 * Generate a random 4-character room code (e.g., "WXYZ")
 * Uses uppercase letters only for easy verbal communication
 */
export function generateRoomCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  let code = ''

  for (let i = 0; i < 4; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length)
    code += chars[randomIndex]
  }

  return code
}
