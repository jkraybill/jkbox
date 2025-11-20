// Player types for jkbox

export interface Player {
  id: string
  roomId: string
  nickname: string
  sessionToken: string
  deviceId: string  // IP address or other device identifier (prevents duplicate connections from same device)
  isAdmin: boolean
  isHost: boolean
  score: number
  connectedAt: Date
  lastSeenAt: Date
  isConnected: boolean
}
