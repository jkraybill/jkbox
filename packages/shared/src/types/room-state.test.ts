import { describe, it, expect } from 'vitest';
import type { RoomState, LobbyState, CountdownState, PlayingState, ResultsState } from './room-state';

describe('RoomState discriminated union', () => {
  describe('Type narrowing', () => {
    it('should narrow to LobbyState when phase is lobby', () => {
      const state: RoomState = {
        phase: 'lobby',
        roomId: 'test-room',
        players: [],
        gameVotes: {},
        readyStates: {},
        selectedGame: null
      };

      if (state.phase === 'lobby') {
        // TypeScript should know this is LobbyState
        expect(state.gameVotes).toBeDefined();
        expect(state.readyStates).toBeDefined();
        expect(state.selectedGame).toBeDefined();
      }
    });

    it('should narrow to CountdownState when phase is countdown', () => {
      const state: RoomState = {
        phase: 'countdown',
        roomId: 'test-room',
        players: [],
        selectedGame: 'fake-facts',
        secondsRemaining: 5
      };

      if (state.phase === 'countdown') {
        // TypeScript should know this is CountdownState
        expect(state.secondsRemaining).toBe(5);
        expect(state.selectedGame).toBe('fake-facts');
      }
    });

    it('should narrow to PlayingState when phase is playing', () => {
      const state: RoomState = {
        phase: 'playing',
        roomId: 'test-room',
        players: [],
        gameId: 'fake-facts',
        gameState: { round: 1, score: {} }
      };

      if (state.phase === 'playing') {
        // TypeScript should know this is PlayingState
        expect(state.gameId).toBe('fake-facts');
        expect(state.gameState).toBeDefined();
      }
    });

    it('should narrow to ResultsState when phase is results', () => {
      const state: RoomState = {
        phase: 'results',
        roomId: 'test-room',
        players: [],
        gameId: 'fake-facts',
        winners: ['player-1'],
        scores: { 'player-1': 100 },
        achievements: []
      };

      if (state.phase === 'results') {
        // TypeScript should know this is ResultsState
        expect(state.winners).toEqual(['player-1']);
        expect(state.scores).toBeDefined();
        expect(state.achievements).toBeDefined();
      }
    });
  });

  describe('Phase validation', () => {
    it('should only allow valid phase values', () => {
      const validPhases: Array<RoomState['phase']> = ['lobby', 'countdown', 'playing', 'results'];

      validPhases.forEach(phase => {
        expect(['lobby', 'countdown', 'playing', 'results']).toContain(phase);
      });
    });
  });

  describe('LobbyState', () => {
    it('should support empty gameVotes and readyStates', () => {
      const lobby: LobbyState = {
        phase: 'lobby',
        roomId: 'test',
        players: [],
        gameVotes: {},
        readyStates: {},
        selectedGame: null
      };

      expect(lobby.gameVotes).toEqual({});
      expect(lobby.readyStates).toEqual({});
      expect(lobby.selectedGame).toBeNull();
    });

    it('should track game votes per player', () => {
      const lobby: LobbyState = {
        phase: 'lobby',
        roomId: 'test',
        players: [],
        gameVotes: {
          'player-1': 'fake-facts',
          'player-2': 'fake-facts',
          'player-3': 'drawing-game'
        },
        readyStates: {},
        selectedGame: 'fake-facts'
      };

      expect(lobby.gameVotes['player-1']).toBe('fake-facts');
      expect(lobby.selectedGame).toBe('fake-facts');
    });

    it('should track ready states per player', () => {
      const lobby: LobbyState = {
        phase: 'lobby',
        roomId: 'test',
        players: [],
        gameVotes: {},
        readyStates: {
          'player-1': true,
          'player-2': false,
          'player-3': true
        },
        selectedGame: null
      };

      expect(lobby.readyStates['player-1']).toBe(true);
      expect(lobby.readyStates['player-2']).toBe(false);
    });
  });

  describe('CountdownState', () => {
    it('should track countdown timer', () => {
      const countdown: CountdownState = {
        phase: 'countdown',
        roomId: 'test',
        players: [],
        selectedGame: 'fake-facts',
        secondsRemaining: 3
      };

      expect(countdown.secondsRemaining).toBe(3);
      expect(countdown.selectedGame).toBe('fake-facts');
    });
  });

  describe('PlayingState', () => {
    it('should contain game-specific state', () => {
      const playing: PlayingState = {
        phase: 'playing',
        roomId: 'test',
        players: [],
        gameId: 'fake-facts',
        gameState: {
          round: 2,
          submissions: { 'player-1': 'answer' }
        }
      };

      expect(playing.gameId).toBe('fake-facts');
      expect(playing.gameState).toBeDefined();
    });

    it('should allow any gameState shape (game-specific)', () => {
      const playing: PlayingState = {
        phase: 'playing',
        roomId: 'test',
        players: [],
        gameId: 'drawing-game',
        gameState: {
          canvas: [{ x: 10, y: 20, color: 'red' }],
          timeRemaining: 30
        }
      };

      expect(playing.gameState).toHaveProperty('canvas');
    });
  });

  describe('ResultsState', () => {
    it('should contain winners and scores', () => {
      const results: ResultsState = {
        phase: 'results',
        roomId: 'test',
        players: [],
        gameId: 'fake-facts',
        winners: ['player-1', 'player-2'],
        scores: {
          'player-1': 150,
          'player-2': 150,
          'player-3': 100
        }
      };

      expect(results.winners).toHaveLength(2);
      expect(results.scores['player-1']).toBe(150);
    });

    it('should support optional achievements', () => {
      const results: ResultsState = {
        phase: 'results',
        roomId: 'test',
        players: [],
        gameId: 'fake-facts',
        winners: ['player-1'],
        scores: { 'player-1': 200 },
        achievements: [
          { playerId: 'player-1', achievementId: 'perfect-round', label: 'Perfect Round!' }
        ]
      };

      expect(results.achievements).toHaveLength(1);
      expect(results.achievements?.[0].achievementId).toBe('perfect-round');
    });
  });
});
