import { describe, it, expect } from 'vitest'
import type {
  JoinMessage,
  SubmitMessage,
  VoteMessage,
  AdminStartGameMessage,
  RoomUpdateMessage,
  RoundPhaseChangeMessage,
  TimerTickMessage,
  VoteOptionsMessage,
  ErrorMessage
} from './messages'

describe('WebSocket message types', () => {
  describe('Client → Server Messages', () => {
    describe('JoinMessage', () => {
      it('should have correct shape for new join', () => {
        const msg: JoinMessage = {
          type: 'join',
          roomId: 'WXYZ',
          nickname: 'Alice'
        }

        expect(msg.type).toBe('join')
        expect(msg.roomId).toBe('WXYZ')
        expect(msg.nickname).toBe('Alice')
        expect(msg.sessionToken).toBeUndefined()
      })

      it('should support reconnection with session token', () => {
        const msg: JoinMessage = {
          type: 'join',
          roomId: 'WXYZ',
          nickname: 'Alice',
          sessionToken: 'token-abc-123'
        }

        expect(msg.sessionToken).toBe('token-abc-123')
      })
    })

    describe('SubmitMessage', () => {
      it('should have correct shape', () => {
        const msg: SubmitMessage = {
          type: 'submit',
          roundId: 'round-1',
          content: 'banana'
        }

        expect(msg.type).toBe('submit')
        expect(msg.roundId).toBe('round-1')
        expect(msg.content).toBe('banana')
      })
    })

    describe('VoteMessage', () => {
      it('should have correct shape', () => {
        const msg: VoteMessage = {
          type: 'vote',
          roundId: 'round-1',
          votedForId: 'submission-a'
        }

        expect(msg.type).toBe('vote')
        expect(msg.roundId).toBe('round-1')
        expect(msg.votedForId).toBe('submission-a')
      })
    })

    describe('AdminStartGameMessage', () => {
      it('should have correct shape', () => {
        const msg: AdminStartGameMessage = {
          type: 'admin:start-game',
          gameId: 'interpreter',
          config: {
            roundTimers: {
              submit: 60,
              vote: 45,
              results: 10
            },
            scoring: {
              pointsPerVote: 100
            },
            contentPacks: ['1990s-scifi']
          }
        }

        expect(msg.type).toBe('admin:start-game')
        expect(msg.gameId).toBe('interpreter')
        expect(msg.config.roundTimers.submit).toBe(60)
      })
    })
  })

  describe('Server → Client Messages', () => {
    describe('RoomUpdateMessage', () => {
      it('should have correct shape', () => {
        const msg: RoomUpdateMessage = {
          type: 'room:update',
          room: {
            id: 'WXYZ',
            hostId: 'player-1',
            adminIds: ['player-1'],
            state: 'lobby',
            currentGame: null,
            players: [],
            createdAt: new Date(),
            config: {
              maxPlayers: 12,
              allowMidGameJoin: false,
              autoAdvanceTimers: true
            }
          }
        }

        expect(msg.type).toBe('room:update')
        expect(msg.room.id).toBe('WXYZ')
      })
    })

    describe('RoundPhaseChangeMessage', () => {
      it('should have correct shape', () => {
        const msg: RoundPhaseChangeMessage = {
          type: 'round:phase-change',
          phase: 'vote',
          timeRemaining: 45
        }

        expect(msg.type).toBe('round:phase-change')
        expect(msg.phase).toBe('vote')
        expect(msg.timeRemaining).toBe(45)
      })
    })

    describe('TimerTickMessage', () => {
      it('should have correct shape', () => {
        const msg: TimerTickMessage = {
          type: 'timer:tick',
          timeRemaining: 30
        }

        expect(msg.type).toBe('timer:tick')
        expect(msg.timeRemaining).toBe(30)
      })
    })

    describe('VoteOptionsMessage', () => {
      it('should have correct shape', () => {
        const msg: VoteOptionsMessage = {
          type: 'vote:options',
          options: [
            { id: 'sub-1', content: 'banana', isHouseAnswer: false },
            { id: 'sub-2', content: 'comedy gold', isHouseAnswer: false },
            { id: 'house-1', content: 'AI-generated', isHouseAnswer: true }
          ]
        }

        expect(msg.type).toBe('vote:options')
        expect(msg.options).toHaveLength(3)
        expect(msg.options[2]?.isHouseAnswer).toBe(true)
      })

      it('should distinguish house answers from player answers', () => {
        const msg: VoteOptionsMessage = {
          type: 'vote:options',
          options: [
            { id: 'p1', content: 'player answer', isHouseAnswer: false },
            { id: 'h1', content: 'house answer', isHouseAnswer: true }
          ]
        }

        const houseAnswers = msg.options.filter(o => o.isHouseAnswer)
        const playerAnswers = msg.options.filter(o => !o.isHouseAnswer)

        expect(houseAnswers).toHaveLength(1)
        expect(playerAnswers).toHaveLength(1)
      })
    })

    describe('ErrorMessage', () => {
      it('should have correct shape', () => {
        const msg: ErrorMessage = {
          type: 'error',
          code: 'ROOM_FULL',
          message: "Can't join - party's full! (Max 12 players)"
        }

        expect(msg.type).toBe('error')
        expect(msg.code).toBe('ROOM_FULL')
        expect(msg.message).toContain('party')
      })
    })
  })
})
