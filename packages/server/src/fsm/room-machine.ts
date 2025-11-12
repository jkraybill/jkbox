import { setup, assign } from 'xstate'

// Minimum players required to start a game
const MIN_PLAYERS = 3

// Events
type RoomEvent =
  | { type: 'START_GAME' }
  | { type: 'GAME_END' }
  | { type: 'RESET' }
  | { type: 'UPDATE_PLAYER_COUNT'; count: number }

// Context
interface RoomContext {
  playerCount: number
}

// Input for machine creation
interface RoomInput {
  playerCount?: number
}

/**
 * Room state machine: lobby → playing → finished
 *
 * Guards ensure game can only start with sufficient players
 * Prevents invalid state transitions that could cause bugs
 */
export const roomMachine = setup({
  types: {
    context: {} as RoomContext,
    events: {} as RoomEvent,
    input: {} as RoomInput
  },
  guards: {
    hasEnoughPlayers: ({ context }) => context.playerCount >= MIN_PLAYERS
  },
  actions: {
    updatePlayerCount: assign({
      playerCount: ({ event }) => {
        if (event.type === 'UPDATE_PLAYER_COUNT') {
          return event.count
        }
        return 0 // Should never happen due to event typing
      }
    })
  }
}).createMachine({
  id: 'room',
  context: ({ input }) => ({
    playerCount: input?.playerCount ?? 0
  }),
  initial: 'lobby',
  states: {
    lobby: {
      on: {
        START_GAME: {
          guard: 'hasEnoughPlayers',
          target: 'playing'
        },
        UPDATE_PLAYER_COUNT: {
          actions: 'updatePlayerCount'
        }
      }
    },
    playing: {
      on: {
        GAME_END: 'finished',
        UPDATE_PLAYER_COUNT: {
          actions: 'updatePlayerCount'
        }
      }
    },
    finished: {
      on: {
        RESET: 'lobby'
      }
    }
  }
})
