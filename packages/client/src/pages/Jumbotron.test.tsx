import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { Jumbotron } from './Jumbotron'
import type { RoomState } from '@jkbox/shared'

// Mock fetch globally
global.fetch = vi.fn()

// Mock the store and socket
vi.mock('../store/game-store', () => ({
  useGameStore: vi.fn(() => ({
    room: null,
    setRoom: vi.fn()
  }))
}))

vi.mock('../lib/use-socket', () => ({
  useSocket: vi.fn(() => ({
    socket: {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn()
    },
    isConnected: true
  }))
}))

// Mock child components
vi.mock('../components/JumbotronVoting', () => ({
  JumbotronVoting: () => <div data-testid="jumbotron-voting">Voting Component</div>
}))

vi.mock('../components/Pippin', () => ({
  Pippin: ({ variant, onIntroComplete }: { variant: string; onIntroComplete?: () => void }) => (
    <div data-testid={`pippin-${variant}`} onClick={onIntroComplete}>
      Pippin {variant}
    </div>
  )
}))

vi.mock('../components/Countdown', () => ({
  Countdown: ({ count, gameName }: { count: number; gameName: string }) => (
    <div data-testid="countdown-overlay">
      Countdown: {count} - {gameName}
    </div>
  )
}))

vi.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value }: { value: string }) => (
    <div data-testid="qr-code" data-url={value}>QR Code</div>
  )
}))

describe('Jumbotron', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Mock fetch to prevent network calls
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ room: { phase: 'lobby', roomId: 'test', players: [] } })
    } as Response)

    // Reset fullscreen API mocks
    document.exitFullscreen = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      value: null
    })
  })

  describe('Phase Rendering', () => {
    it('renders title phase with Pippin intro', async () => {
      const titleState: RoomState = {
        phase: 'title',
        roomId: 'test-room',
        players: []
      }

      const { useGameStore } = await import('../store/game-store')
      const mockStore = {
        room: titleState,
        setRoom: vi.fn()
      }
      vi.mocked(useGameStore).mockReturnValue(mockStore as any)

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ room: titleState })
      } as Response)

      render(<Jumbotron />)

      await waitFor(() => {
        expect(screen.getByTestId('pippin-intro')).toBeInTheDocument()
      })
    })

    it('renders lobby phase with QR code when no players', async () => {
      const lobbyState: RoomState = {
        phase: 'lobby',
        roomId: 'test-room',
        players: [],
        gameVotes: {},
        readyStates: {},
        selectedGame: null
      }

      const { useGameStore } = await import('../store/game-store')
      const mockStore = {
        room: lobbyState,
        setRoom: vi.fn()
      }
      vi.mocked(useGameStore).mockReturnValue(mockStore as any)

      render(<Jumbotron />)

      await waitFor(() => {
        expect(screen.getByText(/Scan to Join/i)).toBeInTheDocument()
      })
      expect(screen.getByTestId('qr-code')).toBeInTheDocument()
      expect(screen.getByText(/Waiting for players/i)).toBeInTheDocument()
    })

    it('renders lobby phase with voting when players present', async () => {
      const lobbyState: RoomState = {
        phase: 'lobby',
        roomId: 'test-room',
        players: [
          { id: 'p1', nickname: 'Alice', sessionToken: 'token1', isConnected: true }
        ],
        gameVotes: {},
        readyStates: {},
        selectedGame: null
      }

      const { useGameStore } = await import('../store/game-store')
      const mockStore = {
        room: lobbyState,
        setRoom: vi.fn()
      }
      vi.mocked(useGameStore).mockReturnValue(mockStore as any)

      render(<Jumbotron />)

      await waitFor(() => {
        expect(screen.getByTestId('jumbotron-voting')).toBeInTheDocument()
      })
    })

    it('renders countdown phase with countdown display', async () => {
      const countdownState: RoomState = {
        phase: 'countdown',
        roomId: 'test-room',
        players: [
          { id: 'p1', nickname: 'Alice', sessionToken: 'token1', isConnected: true }
        ],
        selectedGame: 'fake-facts',
        secondsRemaining: 3
      }

      const { useGameStore } = await import('../store/game-store')
      const mockStore = {
        room: countdownState,
        setRoom: vi.fn()
      }
      vi.mocked(useGameStore).mockReturnValue(mockStore as any)

      render(<Jumbotron />)

      // Should show countdown display for countdown phase
      await waitFor(() => {
        expect(screen.getByText('3')).toBeInTheDocument()
      })
      expect(screen.getByText(/Fake Facts/i)).toBeInTheDocument()
    })

    it('renders playing phase with game display', async () => {
      const playingState: RoomState = {
        phase: 'playing',
        roomId: 'test-room',
        players: [
          { id: 'p1', nickname: 'Alice', sessionToken: 'token1', isConnected: true }
        ],
        gameId: 'fake-facts',
        gameState: { round: 1 }
      }

      // Mock fetch to return playing state
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ room: playingState })
      } as Response)

      const { useGameStore } = await import('../store/game-store')
      const mockStore = {
        room: playingState,
        setRoom: vi.fn()
      }
      vi.mocked(useGameStore).mockReturnValue(mockStore as any)

      await act(async () => {
        render(<Jumbotron />)
      })

      // Should show UnimplementedGameJumbotron for fake-facts
      expect(await screen.findByText(/Game Not Implemented Yet/i)).toBeInTheDocument()
      expect(screen.getByText(/Returning to lobby/i)).toBeInTheDocument()
    })

    it('renders results phase with winners and scores', async () => {
      const resultsState: RoomState = {
        phase: 'results',
        roomId: 'test-room',
        players: [
          { id: 'p1', nickname: 'Alice', sessionToken: 'token1', isConnected: true },
          { id: 'p2', nickname: 'Bob', sessionToken: 'token2', isConnected: true }
        ],
        gameId: 'fake-facts',
        winners: ['p1'],
        scores: {
          p1: 1000,
          p2: 500
        }
      }

      const { useGameStore } = await import('../store/game-store')
      const mockStore = {
        room: resultsState,
        setRoom: vi.fn()
      }
      vi.mocked(useGameStore).mockReturnValue(mockStore as any)

      render(<Jumbotron />)

      // Should show results
      await waitFor(() => {
        expect(screen.getByText(/Game Over/i)).toBeInTheDocument()
      })
      // Alice appears in both winners and scores, so check for multiple
      expect(screen.getAllByText(/Alice/i).length).toBeGreaterThan(0)
      expect(screen.getByText('1000')).toBeInTheDocument()
      expect(screen.getByText('500')).toBeInTheDocument()
      expect(screen.getByText(/Winners/i)).toBeInTheDocument()
      expect(screen.getByText(/Final Scores/i)).toBeInTheDocument()
    })
  })
})
