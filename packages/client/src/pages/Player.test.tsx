import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
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
      id: 'TEST',
      state: 'lobby',
      players: []
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
  })

  it('should render player nickname', () => {
    render(
      <BrowserRouter>
        <Player />
      </BrowserRouter>
    )

    expect(screen.getByText(/Alice/)).toBeDefined()
  })

  it('should show voting UI in lobby state', () => {
    render(
      <BrowserRouter>
        <Player />
      </BrowserRouter>
    )

    expect(screen.getByText(/Choose Your Game/i)).toBeDefined()
    expect(screen.getByText(/Good to Go\?/i)).toBeDefined()
  })

  it('should show connection status', () => {
    render(
      <BrowserRouter>
        <Player />
      </BrowserRouter>
    )

    expect(screen.getByText(/connected/i)).toBeDefined()
  })
})
