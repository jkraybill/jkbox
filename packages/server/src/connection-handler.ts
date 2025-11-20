import type { Socket, Server } from 'socket.io'
import type {
  JoinMessage,
  JoinSuccessMessage,
  RoomStateMessage,
  WatchMessage,
  Player,
  LobbyVoteGameMessage,
  LobbyReadyToggleMessage,
  LobbyVotingUpdateMessage,
  LobbyCountdownMessage,
  GameId
} from '@jkbox/shared'
import { RoomManager } from './room-manager'
import { VotingHandler } from './voting-handler'
import { generatePlayerId, generateSessionToken } from './utils/session-token'

export class ConnectionHandler {
  private socketToPlayer: Map<string, { playerId: string; roomId: string }> = new Map()
  private votingHandlers: Map<string, VotingHandler> = new Map() // roomId → VotingHandler

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

    // Block joins if game is in progress (playing phase)
    if (room.phase === 'playing') {
      socket.emit('error', {
        type: 'error',
        code: 'GAME_IN_PROGRESS',
        message: `Can't join - game is in progress. Wait until the next round!`
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
        message: `Can't join - party's full! (Max 12 players)`
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

    // Add player to voting handler
    const votingHandler = this.getVotingHandler(message.roomId)
    votingHandler.addPlayer(player.id)

    // Send join success with player and room state to the joining player
    const updated = this.roomManager.getRoom(message.roomId)
    if (updated) {
      const joinSuccess: JoinSuccessMessage = {
        type: 'join:success',
        player,
        state: updated
      }
      socket.emit('join:success', joinSuccess)

      // Broadcast room state to all clients in the room (including jumbotron)
      const roomStateMessage: RoomStateMessage = {
        type: 'room:state',
        state: updated
      }
      this.io.to(message.roomId).emit('room:state', roomStateMessage)

      // Broadcast current voting state to new player
      this.broadcastVotingUpdate(message.roomId)
    }
  }

  /**
   * Handle session recovery (Socket.io Connection State Recovery)
   * Called when a player reconnects after brief disconnect (<2 min)
   */
  handleReconnect(socket: Socket): void {
    const mapping = this.socketToPlayer.get(socket.id)
    if (!mapping) {
      // Socket recovered but we don't have player mapping (shouldn't happen)
      console.warn(`Session recovered for ${socket.id} but no player mapping found`)
      return
    }

    // Mark player as reconnected
    this.roomManager.updatePlayer(mapping.roomId, mapping.playerId, {
      isConnected: true,
      lastSeenAt: new Date()
    })

    // Re-add player to voting handler (they may have been removed on disconnect)
    const votingHandler = this.getVotingHandler(mapping.roomId)
    votingHandler.addPlayer(mapping.playerId)

    // Broadcast room state to all clients in the room
    const updated = this.roomManager.getRoom(mapping.roomId)
    if (updated) {
      const roomStateMessage: RoomStateMessage = {
        type: 'room:state',
        state: updated
      }
      this.io.to(mapping.roomId).emit('room:state', roomStateMessage)

      // Broadcast updated voting state
      this.broadcastVotingUpdate(mapping.roomId)
    }

    console.log(`Player ${mapping.playerId} reconnected in room ${mapping.roomId}`)
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

    // Remove player from voting (they can re-vote on reconnect)
    const votingHandler = this.getVotingHandler(mapping.roomId)
    votingHandler.removePlayer(mapping.playerId)

    // DON'T delete socket mapping yet - Socket.io may recover the session
    // We'll clean up stale mappings after maxDisconnectionDuration (2 min)

    // Broadcast room state to all clients in the room
    const updated = this.roomManager.getRoom(mapping.roomId)
    if (updated) {
      const roomStateMessage: RoomStateMessage = {
        type: 'room:state',
        state: updated
      }
      this.io.to(mapping.roomId).emit('room:state', roomStateMessage)

      // Broadcast updated voting state (player removed)
      this.broadcastVotingUpdate(mapping.roomId)
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

    // Send initial room state (snapshot for jumbotron reload tolerance)
    const roomStateMessage: RoomStateMessage = {
      type: 'room:state',
      state: room
    }
    socket.emit('room:state', roomStateMessage)
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

  /**
   * Get or create voting handler for a room
   */
  private getVotingHandler(roomId: string): VotingHandler {
    let handler = this.votingHandlers.get(roomId)
    if (!handler) {
      handler = new VotingHandler()
      this.votingHandlers.set(roomId, handler)
    }
    return handler
  }

  /**
   * Handle lobby game vote
   */
  handleLobbyVote(socket: Socket, message: LobbyVoteGameMessage): void {
    const mapping = this.socketToPlayer.get(socket.id)
    if (!mapping) {
      socket.emit('error', {
        type: 'error',
        code: 'NOT_IN_ROOM',
        message: 'You must join a room first'
      })
      return
    }

    const handler = this.getVotingHandler(mapping.roomId)
    handler.submitVote(mapping.playerId, message.gameId)

    // Broadcast voting update to all clients in room
    this.broadcastVotingUpdate(mapping.roomId)
  }

  /**
   * Handle lobby ready toggle
   */
  handleLobbyReadyToggle(socket: Socket, message: LobbyReadyToggleMessage): void {
    const mapping = this.socketToPlayer.get(socket.id)
    if (!mapping) {
      socket.emit('error', {
        type: 'error',
        code: 'NOT_IN_ROOM',
        message: 'You must join a room first'
      })
      return
    }

    const handler = this.getVotingHandler(mapping.roomId)

    try {
      handler.toggleReady(mapping.playerId, message.isReady)

      // Broadcast voting update
      this.broadcastVotingUpdate(mapping.roomId)

      // If all ready, start countdown
      const votingState = handler.getVotingState()
      if (votingState.allReady && votingState.selectedGame) {
        this.startCountdown(mapping.roomId, votingState.selectedGame)
      }
    } catch (error) {
      socket.emit('error', {
        type: 'error',
        code: 'INVALID_READY_TOGGLE',
        message: error instanceof Error ? error.message : 'Failed to toggle ready'
      })
    }
  }

  /**
   * Start countdown for game launch
   */
  private async startCountdown(roomId: string, selectedGame: GameId): Promise<void> {
    const COUNTDOWN_FROM = 5

    // Emit countdown messages (5, 4, 3, 2, 1, 0)
    for (let i = COUNTDOWN_FROM; i >= 0; i--) {
      const countdownMessage: LobbyCountdownMessage = {
        type: 'lobby:countdown',
        countdown: i,
        selectedGame
      }

      this.io.to(roomId).emit('lobby:countdown', countdownMessage)

      // Wait 1 second between counts
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    // After countdown, start the game
    // TODO: Implement game start logic (this will be part of the actual game modules)
    console.log(`Starting game ${selectedGame} in room ${roomId}`)

    // Reset voting handler for next round
    const handler = this.getVotingHandler(roomId)
    handler.reset()
    this.broadcastVotingUpdate(roomId)
  }

  /**
   * Broadcast voting state update to all clients in room
   */
  private broadcastVotingUpdate(roomId: string): void {
    const handler = this.getVotingHandler(roomId)
    const votingState = handler.getVotingState()

    const update: LobbyVotingUpdateMessage = {
      type: 'lobby:voting-update',
      votingState
    }

    this.io.to(roomId).emit('lobby:voting-update', update)
  }
}
