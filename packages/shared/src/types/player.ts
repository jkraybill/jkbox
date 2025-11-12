// Player types for jkbox

export interface Player {
  id: string
  roomId: string
  nickname: string
  sessionToken: string
  isAdmin: boolean
  isHost: boolean
  score: number
  connectedAt: Date
  lastSeenAt: Date
  isConnected: boolean
}
