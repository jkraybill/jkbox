import { describe, it, expect } from 'vitest'
import type { Player } from './player'

describe('Player types', () => {
  describe('Player', () => {
    it('should have correct shape', () => {
      const player: Player = {
        id: 'player-123',
        roomId: 'WXYZ',
        nickname: 'Alice',
        sessionToken: 'token-abc-123',
        deviceId: '192.168.1.100',
        isAdmin: false,
        isHost: false,
        score: 0,
        connectedAt: new Date(),
        lastSeenAt: new Date(),
        isConnected: true
      }

      expect(player.id).toBe('player-123')
      expect(player.roomId).toBe('WXYZ')
      expect(player.nickname).toBe('Alice')
      expect(player.sessionToken).toBe('token-abc-123')
      expect(player.deviceId).toBe('192.168.1.100')
      expect(player.isAdmin).toBe(false)
      expect(player.isHost).toBe(false)
      expect(player.score).toBe(0)
      expect(player.connectedAt).toBeInstanceOf(Date)
      expect(player.lastSeenAt).toBeInstanceOf(Date)
      expect(player.isConnected).toBe(true)
    })

    it('should support host player', () => {
      const host: Player = {
        id: 'host-1',
        roomId: 'ROOM1',
        nickname: 'JK',
        sessionToken: 'token-host',
        deviceId: '192.168.1.1',
        isAdmin: true,
        isHost: true,
        score: 0,
        connectedAt: new Date(),
        lastSeenAt: new Date(),
        isConnected: true
      }

      expect(host.isHost).toBe(true)
      expect(host.isAdmin).toBe(true)
    })

    it('should support delegated admin (not host)', () => {
      const admin: Player = {
        id: 'player-2',
        roomId: 'ROOM1',
        nickname: 'Bob',
        sessionToken: 'token-bob',
        deviceId: '192.168.1.101',
        isAdmin: true,
        isHost: false,
        score: 100,
        connectedAt: new Date(),
        lastSeenAt: new Date(),
        isConnected: true
      }

      expect(admin.isAdmin).toBe(true)
      expect(admin.isHost).toBe(false)
    })

    it('should track connection state', () => {
      const disconnected: Player = {
        id: 'player-3',
        roomId: 'ROOM1',
        nickname: 'Charlie',
        sessionToken: 'token-charlie',
        deviceId: '192.168.1.102',
        isAdmin: false,
        isHost: false,
        score: 50,
        connectedAt: new Date(Date.now() - 60000), // 1 min ago
        lastSeenAt: new Date(Date.now() - 30000),  // 30s ago
        isConnected: false
      }

      expect(disconnected.isConnected).toBe(false)
      expect(disconnected.lastSeenAt.getTime()).toBeLessThan(Date.now())
    })

    it('should track score', () => {
      const player: Player = {
        id: 'player-4',
        roomId: 'ROOM1',
        nickname: 'Diana',
        sessionToken: 'token-diana',
        deviceId: '192.168.1.103',
        isAdmin: false,
        isHost: false,
        score: 1337,
        connectedAt: new Date(),
        lastSeenAt: new Date(),
        isConnected: true
      }

      expect(player.score).toBe(1337)
      expect(typeof player.score).toBe('number')
    })
  })
})
