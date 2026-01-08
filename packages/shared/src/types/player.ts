// Player types for jkbox

export interface Player {
	id: string
	roomId: string
	nickname: string
	sessionToken: string
	deviceId: string // IP address or other device identifier (prevents duplicate connections from same device)
	isAdmin: boolean
	isHost: boolean
	isAI?: boolean // True if this is an AI player
	aiConstraint?: string // AI player's constraint for answer generation
	soundId?: string // Assigned player sound effect ID (for audio feedback on actions)
	score: number
	connectedAt: Date
	lastSeenAt: Date
	isConnected: boolean
}
