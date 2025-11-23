import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { Player } from './Player'

// Mock dependencies
vi.mock('../lib/use-socket', () => ({
  useSocket: () => ({
    socket: {
      on: vi.fn(),
      off: vi.fn()
    },
    isConnected: true
  })
}))

vi.mock('../store/game-store', () => ({
  useGameStore: () => ({
    currentPlayer: {
      id: 'player-123',
      nickname: 'Alice',
      score: 0,
      isConnected: true
    },
    room: {
      phase: 'lobby',
      roomId: 'TEST',
      players: [],
      gameVotes: {},
      readyStates: {},
      selectedGame: null
    }
  })
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useParams: () => ({ roomId: 'TEST' })
  }
})

describe('Player', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Mock fetch for LobbyVoting game fetching
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        games: [
          {
            id: 'fake-facts',
            name: 'Fake Facts',
            description: 'A test game',
            minPlayers: 2,
            maxPlayers: 8
          }
        ]
      })
    } as Response)
  })

  it('should render player nickname', async () => {
    await act(async () => {
      render(
        <BrowserRouter>
          <Player />
        </BrowserRouter>
      )
    })

    expect(screen.getByText(/Alice/)).toBeDefined()
  })

  it('should show voting UI in lobby state', async () => {
    await act(async () => {
      render(
        <BrowserRouter>
          <Player />
        </BrowserRouter>
      )
    })

    // findByText automatically waits for the element to appear
    expect(await screen.findByText(/Choose Your Game/i)).toBeDefined()
    expect(await screen.findByText(/Good to Go\?/i)).toBeDefined()
  })

  it('should show connection status', async () => {
    await act(async () => {
      render(
        <BrowserRouter>
          <Player />
        </BrowserRouter>
      )
    })

    expect(screen.getByText(/connected/i)).toBeDefined()
  })
})
