import { setup, assign } from 'xstate'

// Events
type ConnectionEvent =
  | { type: 'CONNECT' }
  | { type: 'CONNECTED' }
  | { type: 'DISCONNECT' }
  | { type: 'CONNECTION_LOST' }
  | { type: 'CONNECT_ERROR' }
  | { type: 'RETRY' }
  | { type: 'GIVE_UP' }

// Context
interface ConnectionContext {
  retryCount: number
  retryDelay: number
  maxRetries: number
}

const MAX_RETRIES = 5
const BASE_DELAY = 1000 // 1 second

/**
 * Connection state machine: disconnected ⇄ connecting ⇄ connected
 *
 * Handles auto-reconnection with exponential backoff
 * Critical for mobile chaos tolerance (screen locks, network drops)
 */
export const connectionMachine = setup({
  types: {
    context: {} as ConnectionContext,
    events: {} as ConnectionEvent
  },
  guards: {
    canRetry: ({ context }) => context.retryCount < context.maxRetries
  },
  actions: {
    incrementRetry: assign({
      retryCount: ({ context }) => Math.min(context.retryCount + 1, context.maxRetries),
      retryDelay: ({ context }) => {
        // Exponential backoff: 1s, 2s, 4s, 8s, 16s (capped at 16s)
        const nextRetry = context.retryCount + 1
        return Math.min(BASE_DELAY * Math.pow(2, nextRetry - 1), 16000)
      }
    }),
    resetRetry: assign({
      retryCount: 0,
      retryDelay: BASE_DELAY
    })
  }
}).createMachine({
  id: 'connection',
  context: {
    retryCount: 0,
    retryDelay: BASE_DELAY,
    maxRetries: MAX_RETRIES
  },
  initial: 'disconnected',
  states: {
    disconnected: {
      on: {
        CONNECT: 'connecting'
      }
    },
    connecting: {
      on: {
        CONNECTED: {
          target: 'connected',
          actions: 'resetRetry'
        },
        CONNECT_ERROR: {
          target: 'reconnecting',
          actions: 'incrementRetry'
        }
      }
    },
    connected: {
      on: {
        DISCONNECT: 'disconnected',
        CONNECTION_LOST: {
          target: 'reconnecting',
          actions: 'incrementRetry'
        }
      }
    },
    reconnecting: {
      on: {
        RETRY: 'connecting',
        CONNECT: 'connecting',
        GIVE_UP: 'disconnected'
      }
    }
  }
})
