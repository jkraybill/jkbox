import type { Socket, Server } from 'socket.io'
import type { JoinMessage, JoinSuccessMessage, RoomUpdateMessage, WatchMessage, Player } from '@jkbox/shared'
import { RoomManager } from './room-manager'
import { generatePlayerId, generateSessionToken } from './utils/session-token'

export class ConnectionHandler {
  private socketToPlayer: Map<string, { playerId: string; roomId: string }> = new Map()

  constructor(
    private roomManager: RoomManager,
    private io: Server
  ) {}

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

    // Note: Reconnection with session tokens tracked in issue #4
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

    // Make socket join the Socket.io room
    socket.join(message.roomId)

    // Send join success with player and room to the joining player
    const updated = this.roomManager.getRoom(message.roomId)
    if (updated) {
      const joinSuccess: JoinSuccessMessage = {
        type: 'join:success',
        player,
        room: updated
      }
      socket.emit('join:success', joinSuccess)

      // Broadcast room update to all clients in the room (including jumbotron)
      const roomUpdate: RoomUpdateMessage = {
        type: 'room:update',
        room: updated
      }
      this.io.to(message.roomId).emit('room:update', roomUpdate)
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

    // Broadcast room update to all clients in the room
    const updated = this.roomManager.getRoom(mapping.roomId)
    if (updated) {
      const roomUpdate: RoomUpdateMessage = {
        type: 'room:update',
        room: updated
      }
      this.io.to(mapping.roomId).emit('room:update', roomUpdate)
    }
  }

  /**
   * Handle watch (for jumbotron/spectator views)
   */
  handleWatch(socket: Socket, message: WatchMessage): void {
    const room = this.roomManager.getRoom(message.roomId)

    if (!room) {
      socket.emit('error', {
        type: 'error',
        code: 'ROOM_NOT_FOUND',
        message: `Room ${message.roomId} not found. Check the code and try again.`
      })
      return
    }

    // Make socket join the Socket.io room to receive broadcasts
    socket.join(message.roomId)

    // Send initial room state
    const roomUpdate: RoomUpdateMessage = {
      type: 'room:update',
      room
    }
    socket.emit('room:update', roomUpdate)
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
