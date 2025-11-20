import { create } from 'zustand'
import type { RoomState, Player } from '@jkbox/shared'

interface GameState {
	// Room state
	room: RoomState | null
	setRoom: (room: RoomState) => void

	// Current player
	currentPlayer: Player | null
	setCurrentPlayer: (player: Player) => void

	// Connection state
	isConnected: boolean
	setConnected: (connected: boolean) => void

	// Session management
	sessionToken: string | null
	setSessionToken: (token: string) => void

	// Clear all state (for disconnect/leave)
	clearState: () => void
}

export const useGameStore = create<GameState>((set) => ({
	// Initial state - Try to restore from localStorage
	room: null,
	currentPlayer: null,
	isConnected: false,
	sessionToken: (() => {
		try {
			return localStorage.getItem('jkbox-session-token')
		} catch {
			return null
		}
	})(),

	// Actions
	setRoom: (room) => set({ room }),

	setCurrentPlayer: (player) => {
		// Store playerId in localStorage for reconnection
		if (player) {
			try {
				localStorage.setItem('jkbox-player-id', player.id)
				localStorage.setItem('jkbox-room-id', player.roomId || '')
			} catch (e) {
				console.error('Failed to persist player session:', e)
			}
		}
		set({ currentPlayer: player })
	},

	setConnected: (connected) => set({ isConnected: connected }),

	setSessionToken: (token) => {
		// Store in localStorage for reconnection
		if (token) {
			localStorage.setItem('jkbox-session-token', token)
		}
		set({ sessionToken: token })
	},

	clearState: () => {
		localStorage.removeItem('jkbox-session-token')
		localStorage.removeItem('jkbox-player-id')
		localStorage.removeItem('jkbox-room-id')
		set({
			room: null,
			currentPlayer: null,
			isConnected: false,
			sessionToken: null
		})
	}
}))
