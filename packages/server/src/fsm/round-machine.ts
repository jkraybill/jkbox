import { setup, assign } from 'xstate'

// Events
type RoundEvent =
  | { type: 'TIME_UP' }
  | { type: 'ADMIN_SKIP' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }

// Context
interface RoundContext {
  submitTimer: number
  voteTimer: number
  resultsTimer: number
  isPaused: boolean
}

// Input for machine creation
interface RoundInput {
  submitTimer: number
  voteTimer: number
  resultsTimer: number
}

/**
 * Round state machine: submit → vote → results → complete
 *
 * Guards prevent advancing when paused
 * Supports admin skip for faster pacing
 * Timer durations stored in context for reference
 */
export const roundMachine = setup({
  types: {
    context: {} as RoundContext,
    events: {} as RoundEvent,
    input: {} as RoundInput
  },
  guards: {
    isNotPaused: ({ context }) => !context.isPaused
  },
  actions: {
    pause: assign({
      isPaused: true
    }),
    resume: assign({
      isPaused: false
    })
  }
}).createMachine({
  id: 'round',
  context: ({ input }) => ({
    submitTimer: input.submitTimer,
    voteTimer: input.voteTimer,
    resultsTimer: input.resultsTimer,
    isPaused: false
  }),
  initial: 'submit',
  states: {
    submit: {
      on: {
        TIME_UP: {
          guard: 'isNotPaused',
          target: 'vote'
        },
        ADMIN_SKIP: 'vote',
        PAUSE: {
          actions: 'pause'
        },
        RESUME: {
          actions: 'resume'
        }
      }
    },
    vote: {
      on: {
        TIME_UP: {
          guard: 'isNotPaused',
          target: 'results'
        },
        ADMIN_SKIP: 'results',
        PAUSE: {
          actions: 'pause'
        },
        RESUME: {
          actions: 'resume'
        }
      }
    },
    results: {
      on: {
        TIME_UP: {
          guard: 'isNotPaused',
          target: 'complete'
        },
        ADMIN_SKIP: 'complete'
      }
    },
    complete: {
      type: 'final'
    }
  }
})
