import { describe, it, expect } from 'vitest'
import type {
  GameModule,
  GameAction,
  GameResults,
  Achievement,
  JumbotronProps,
  ControllerProps,
  GameRegistry,
  GameId
} from './game-module'
import type { Player } from './player'

describe('GameModule Types', () => {
  describe('GameId', () => {
    it('should accept valid game IDs', () => {
      const fakeFactsId: GameId = 'fake-facts'
      const cinephileId: GameId = 'cinephile'
      const cinemaPippinId: GameId = 'cinema-pippin'

      expect(fakeFactsId).toBe('fake-facts')
      expect(cinephileId).toBe('cinephile')
      expect(cinemaPippinId).toBe('cinema-pippin')
    })
  })

  describe('GameAction', () => {
    it('should have playerId, type, and payload', () => {
      const action: GameAction = {
        playerId: 'player-1',
        type: 'submit-answer',
        payload: { answer: 'test answer' }
      }

      expect(action.playerId).toBe('player-1')
      expect(action.type).toBe('submit-answer')
      expect(action.payload).toEqual({ answer: 'test answer' })
    })

    it('should allow unknown payload type', () => {
      const action: GameAction = {
        playerId: 'player-1',
        type: 'vote',
        payload: 42  // number payload
      }

      expect(action.payload).toBe(42)
    })
  })

  describe('GameResults', () => {
    it('should have winners and scores', () => {
      const results: GameResults = {
        winners: ['player-1'],
        scores: {
          'player-1': 100,
          'player-2': 75,
          'player-3': 50
        }
      }

      expect(results.winners).toHaveLength(1)
      expect(results.scores['player-1']).toBe(100)
    })

    it('should support multiple winners (ties)', () => {
      const results: GameResults = {
        winners: ['player-1', 'player-2'],
        scores: {
          'player-1': 100,
          'player-2': 100,
          'player-3': 75
        }
      }

      expect(results.winners).toHaveLength(2)
    })

    it('should support optional achievements', () => {
      const results: GameResults = {
        winners: ['player-1'],
        scores: { 'player-1': 100 },
        achievements: [
          {
            playerId: 'player-1',
            achievementId: 'perfect-round',
            label: 'Perfect Round!'
          }
        ]
      }

      expect(results.achievements).toHaveLength(1)
      expect(results.achievements?.[0]?.label).toBe('Perfect Round!')
    })

    it('should support optional stats', () => {
      const results: GameResults = {
        winners: ['player-1'],
        scores: { 'player-1': 100 },
        stats: {
          totalRounds: 3,
          avgResponseTime: 4.5
        }
      }

      expect(results.stats).toBeDefined()
    })
  })

  describe('Achievement', () => {
    it('should have required fields', () => {
      const achievement: Achievement = {
        playerId: 'player-1',
        achievementId: 'comeback-king',
        label: 'Comeback King!'
      }

      expect(achievement.playerId).toBe('player-1')
      expect(achievement.achievementId).toBe('comeback-king')
      expect(achievement.label).toBe('Comeback King!')
    })

    it('should support optional description', () => {
      const achievement: Achievement = {
        playerId: 'player-1',
        achievementId: 'perfect',
        label: 'Perfect!',
        description: 'Got every answer correct'
      }

      expect(achievement.description).toBe('Got every answer correct')
    })
  })

  describe('JumbotronProps', () => {
    it('should have gameState and players', () => {
      const mockPlayers: Player[] = [
        {
          id: 'player-1',
          roomId: 'ABCD',
          nickname: 'Alice',
          sessionToken: 'token-1',
          isAdmin: false,
          isHost: false,
          score: 0,
          connectedAt: new Date(),
          lastSeenAt: new Date(),
          isConnected: true
        }
      ]

      const props: JumbotronProps = {
        gameState: { round: 1 },
        players: mockPlayers
      }

      expect(props.gameState).toEqual({ round: 1 })
      expect(props.players).toHaveLength(1)
    })

    it('should support optional admin actions', () => {
      const mockPlayers: Player[] = []
      const onAdminAction = (action: string) => console.log(action)

      const props: JumbotronProps = {
        gameState: {},
        players: mockPlayers,
        onAdminAction
      }

      expect(props.onAdminAction).toBeDefined()
    })
  })

  describe('ControllerProps', () => {
    it('should have gameState, playerId, and onAction', () => {
      const onAction = (action: GameAction) => console.log(action)

      const props: ControllerProps = {
        gameState: { round: 1 },
        playerId: 'player-1',
        onAction
      }

      expect(props.gameState).toEqual({ round: 1 })
      expect(props.playerId).toBe('player-1')
      expect(props.onAction).toBeDefined()
    })
  })

  describe('GameModule interface', () => {
    it('should define all required methods', async () => {
      // Mock implementation to verify interface shape
      const mockModule: GameModule = {
        id: 'fake-facts',
        name: 'Fake Facts',
        minPlayers: 3,
        maxPlayers: 12,

        initialize: async (players: Player[]) => ({
          round: 1,
          playerCount: players.length
        }),

        handleAction: async (action: GameAction, state: unknown) => ({
          ...state,
          lastAction: action.type
        }),

        isComplete: (state: unknown) => false,

        getResults: (state: unknown) => ({
          winners: [],
          scores: {}
        }),

        loadJumbotronComponent: async () => {
          // Would return actual React component in real implementation
          return (() => null) as any
        },

        loadControllerComponent: async () => {
          // Would return actual React component in real implementation
          return (() => null) as any
        }
      }

      expect(mockModule.id).toBe('fake-facts')
      expect(mockModule.name).toBe('Fake Facts')
      expect(mockModule.minPlayers).toBe(3)
      expect(mockModule.maxPlayers).toBe(12)

      const state = await mockModule.initialize([])
      expect(state).toBeDefined()

      const newState = await mockModule.handleAction(
        { playerId: 'p1', type: 'test', payload: null },
        state
      )
      expect(newState).toBeDefined()

      expect(mockModule.isComplete(state)).toBe(false)

      const results = mockModule.getResults(state)
      expect(results.winners).toEqual([])

      const JumbotronComponent = await mockModule.loadJumbotronComponent()
      expect(JumbotronComponent).toBeDefined()

      const ControllerComponent = await mockModule.loadControllerComponent()
      expect(ControllerComponent).toBeDefined()
    })
  })

  describe('GameRegistry interface', () => {
    it('should define registry methods', () => {
      // Mock implementation to verify interface shape
      const registry: GameRegistry = {
        register: (module: GameModule) => {},
        get: (gameId: GameId) => undefined,
        list: () => []
      }

      expect(registry.register).toBeDefined()
      expect(registry.get).toBeDefined()
      expect(registry.list).toBeDefined()
    })
  })
})
