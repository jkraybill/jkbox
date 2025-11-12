import type { Socket } from 'socket.io'
import type { JoinMessage, Player } from '@jkbox/shared'
import { RoomManager } from './room-manager'
import { generatePlayerId, generateSessionToken } from './utils/session-token'

export class ConnectionHandler {
  private socketToPlayer: Map<string, { playerId: string; roomId: string }> = new Map()

  constructor(private roomManager: RoomManager) {}

  /**
   * Handle player join (new or reconnect)
   */
  handleJoin(socket: Socket, message: JoinMessage): void {
    const room = this.roomManager.getRoom(message.roomId)

    if (!room) {
      socket.emit('error', {
        type: 'error',
        code: 'ROOM_NOT_FOUND',
        message: `Room ${message.roomId} not found. Check the code and try again.`
      })
      return
    }

    // TODO: Handle reconnection with session token
    // For now, always create new player

    const player: Player = {
      id: generatePlayerId(),
      roomId: message.roomId,
      nickname: message.nickname,
      sessionToken: generateSessionToken(),
      isAdmin: false,
      isHost: false,
      score: 0,
      connectedAt: new Date(),
      lastSeenAt: new Date(),
      isConnected: true
    }

    const added = this.roomManager.addPlayer(message.roomId, player)

    if (!added) {
      socket.emit('error', {
        type: 'error',
        code: 'ROOM_FULL',
        message: `Can't join - party's full! (Max ${room.config.maxPlayers} players)`
      })
      return
    }

    // Track socket→player mapping
    this.socketToPlayer.set(socket.id, {
      playerId: player.id,
      roomId: message.roomId
    })

    // Send updated room state
    const updated = this.roomManager.getRoom(message.roomId)
    if (updated) {
      socket.emit('room:update', {
        type: 'room:update',
        room: updated
      })
    }
  }

  /**
   * Handle player disconnect
   */
  handleDisconnect(socket: Socket): void {
    const mapping = this.socketToPlayer.get(socket.id)
    if (!mapping) {
      return
    }

    // Mark player as disconnected (not removed - allow reconnection)
    this.roomManager.updatePlayer(mapping.roomId, mapping.playerId, {
      isConnected: false,
      lastSeenAt: new Date()
    })

    this.socketToPlayer.delete(socket.id)
  }

  /**
   * Get player ID for a socket
   */
  getPlayerId(socketId: string): string | undefined {
    return this.socketToPlayer.get(socketId)?.playerId
  }

  /**
   * Get room ID for a socket
   */
  getRoomId(socketId: string): string | undefined {
    return this.socketToPlayer.get(socketId)?.roomId
  }
}
