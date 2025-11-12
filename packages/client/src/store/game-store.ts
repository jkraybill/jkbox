import { create } from 'zustand'
import type { Room, Player } from '@jkbox/shared'

interface GameState {
  // Room state
  room: Room | null
  setRoom: (room: Room) => void

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
  // Initial state
  room: null,
  currentPlayer: null,
  isConnected: false,
  sessionToken: null,

  // Actions
  setRoom: (room) => set({ room }),

  setCurrentPlayer: (player) => set({ currentPlayer: player }),

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
    set({
      room: null,
      currentPlayer: null,
      isConnected: false,
      sessionToken: null
    })
  }
}))
