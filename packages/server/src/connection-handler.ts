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
  LobbyCountdownCancelledMessage,
  GameStartMessage,
  AdminBootPlayerMessage,
  AdminBackToLobbyMessage,
  AdminHardResetMessage,
  GameId,
  CountdownState,
  LobbyState,
  PlayingState,
  TitleState
} from '@jkbox/shared'
import { RoomManager } from './room-manager'
import { VotingHandler } from './voting-handler'
import { generatePlayerId, generateSessionToken } from './utils/session-token'

const HEARTBEAT_INTERVAL = 2000 // Client sends ping every 2s
const DISCONNECT_THRESHOLD = 5000 // Mark disconnected after 5s
const BOOT_THRESHOLD = 60000 // Boot player after 60s

export class ConnectionHandler {
  private socketToPlayer: Map<string, { playerId: string; roomId: string }> = new Map()
  private votingHandlers: Map<string, VotingHandler> = new Map() // roomId → VotingHandler
  private heartbeatMonitor: NodeJS.Timeout | null = null
  private bootedPlayers: Map<string, { nickname: string; score: number; roomId: string }> = new Map() // Track booted players for rejoin
  private countdownTimers: Map<string, NodeJS.Timeout> = new Map() // roomId → countdown timer

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

    // Extract device identifier (prefer client-provided UUID, fallback to IP address)
    const deviceId = message.deviceId || socket.handshake.address || 'unknown'
    console.log(`[JOIN] Player joining: ${message.nickname}, deviceId: ${deviceId}, hasClientDeviceId: ${!!message.deviceId}`)

    // Remove all existing players from this device before adding new player
    // This prevents duplicate connections from the same device (e.g., refreshing browser)
    const existingPlayers = room.players.filter(p => p.deviceId === deviceId)
    for (const existingPlayer of existingPlayers) {
      console.log(`Removing existing player ${existingPlayer.nickname} (${existingPlayer.id}) from device ${deviceId}`)
      this.roomManager.removePlayer(message.roomId, existingPlayer.id)

      // Remove from voting handler
      const votingHandler = this.getVotingHandler(message.roomId)
      votingHandler.removePlayer(existingPlayer.id)

      // Clean up socket mapping
      for (const [socketId, mapping] of this.socketToPlayer.entries()) {
        if (mapping.playerId === existingPlayer.id) {
          this.socketToPlayer.delete(socketId)
          break
        }
      }
    }

    // Note: Reconnection with session tokens tracked in issue #4
    // For now, always create new player

    // Check for admin suffix (~) in nickname
    let nickname = message.nickname
    let isAdmin = false
    if (nickname.endsWith('~')) {
      nickname = nickname.slice(0, -1) // Strip the ~
      isAdmin = true
      console.log(`Granting admin access to player: ${nickname}`)
    }

    // Check if this is a booted player rejoining with same nickname
    const bootedPlayerKey = `${message.roomId}:${nickname}`
    const bootedPlayer = this.bootedPlayers.get(bootedPlayerKey)

    const player: Player = {
      id: generatePlayerId(),
      roomId: message.roomId,
      nickname,
      sessionToken: generateSessionToken(),
      deviceId,
      isAdmin,
      isHost: false,
      score: bootedPlayer?.score ?? 0, // Preserve score if rejoining
      connectedAt: new Date(),
      lastSeenAt: new Date(),
      isConnected: true
    }

    // Clear booted player data after restoring
    if (bootedPlayer) {
      this.bootedPlayers.delete(bootedPlayerKey)
      console.log(`Restored score ${bootedPlayer.score} for rejoining player ${message.nickname}`)
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

    // Check if room is in countdown phase - cancel if so
    const room = this.roomManager.getRoom(mapping.roomId)
    if (room?.phase === 'countdown') {
      this.cancelCountdown(mapping.roomId, 'player_disconnect')
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

    // Transition room to countdown phase
    const room = this.roomManager.getRoom(roomId)
    if (!room) {
      return
    }

    const countdownState: CountdownState = {
      phase: 'countdown',
      roomId,
      players: room.players,
      selectedGame,
      secondsRemaining: COUNTDOWN_FROM
    }

    this.roomManager.updateRoomState(roomId, countdownState)

    // Broadcast initial countdown state
    const stateMessage: RoomStateMessage = {
      type: 'room:state',
      state: countdownState
    }
    this.io.to(roomId).emit('room:state', stateMessage)

    // Emit countdown messages (5, 4, 3, 2, 1, 0)
    for (let i = COUNTDOWN_FROM; i >= 0; i--) {
      // Check if countdown was cancelled
      const currentRoom = this.roomManager.getRoom(roomId)
      if (currentRoom?.phase !== 'countdown') {
        console.log(`Countdown cancelled for room ${roomId}`)
        return
      }

      const countdownMessage: LobbyCountdownMessage = {
        type: 'lobby:countdown',
        countdown: i,
        selectedGame
      }

      this.io.to(roomId).emit('lobby:countdown', countdownMessage)

      // Update countdown state
      countdownState.secondsRemaining = i
      this.roomManager.updateRoomState(roomId, countdownState)

      // Wait 1 second between counts
      if (i > 0) {
        await new Promise(resolve => {
          const timer = setTimeout(resolve, 1000)
          this.countdownTimers.set(roomId, timer)
        })
      }
    }

    // Clean up timer tracking
    this.countdownTimers.delete(roomId)

    // After countdown, start the game
    await this.startGame(roomId, selectedGame)
  }

  /**
   * Start game - transition to playing phase
   */
  private async startGame(roomId: string, selectedGame: GameId): Promise<void> {
    const room = this.roomManager.getRoom(roomId)
    if (!room) {
      return
    }

    // Initialize game state (placeholder for now - will be game module's responsibility)
    const gameState = {
      initialized: true,
      selectedGame
    }

    // Transition to playing phase
    const playingState: PlayingState = {
      phase: 'playing',
      roomId,
      players: room.players,
      gameId: selectedGame,
      gameState
    }

    this.roomManager.updateRoomState(roomId, playingState)

    // Emit game:start message
    const gameStartMessage: GameStartMessage = {
      type: 'game:start',
      gameId: selectedGame,
      gameState
    }
    this.io.to(roomId).emit('game:start', gameStartMessage)

    // Broadcast updated room state
    const stateMessage: RoomStateMessage = {
      type: 'room:state',
      state: playingState
    }
    this.io.to(roomId).emit('room:state', stateMessage)

    // Reset voting handler for next round
    const handler = this.getVotingHandler(roomId)
    handler.reset()
    this.broadcastVotingUpdate(roomId)

    console.log(`Game ${selectedGame} started in room ${roomId}`)
  }

  /**
   * Cancel ongoing countdown and return to lobby
   */
  private cancelCountdown(roomId: string, reason: 'player_disconnect' | 'manual_cancel'): void {
    const room = this.roomManager.getRoom(roomId)
    if (!room || room.phase !== 'countdown') {
      return
    }

    // Clear countdown timer if exists
    const timer = this.countdownTimers.get(roomId)
    if (timer) {
      clearTimeout(timer)
      this.countdownTimers.delete(roomId)
    }

    // Get voting state before transitioning
    const votingHandler = this.getVotingHandler(roomId)
    const votingState = votingHandler.getVotingState()

    // Transition back to lobby phase
    const lobbyState: LobbyState = {
      phase: 'lobby',
      roomId,
      players: room.players,
      gameVotes: {},
      readyStates: {},
      selectedGame: votingState.selectedGame
    }

    this.roomManager.updateRoomState(roomId, lobbyState)

    // Broadcast countdown cancelled message
    const cancelMessage: LobbyCountdownCancelledMessage = {
      type: 'lobby:countdown-cancelled',
      reason
    }
    this.io.to(roomId).emit('lobby:countdown-cancelled', cancelMessage)

    // Broadcast updated room state
    const stateMessage: RoomStateMessage = {
      type: 'room:state',
      state: lobbyState
    }
    this.io.to(roomId).emit('room:state', stateMessage)

    console.log(`Countdown cancelled for room ${roomId} (reason: ${reason})`)
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

  /**
   * Handle heartbeat ping from client
   */
  handleHeartbeat(socket: Socket): void {
    const mapping = this.socketToPlayer.get(socket.id)
    if (!mapping) {
      return
    }

    // Update lastSeenAt timestamp
    this.roomManager.updatePlayer(mapping.roomId, mapping.playerId, {
      lastSeenAt: new Date(),
      isConnected: true
    })
  }

  /**
   * Handle admin boot player request
   */
  handleBootPlayer(socket: Socket, message: AdminBootPlayerMessage): void {
    const mapping = this.socketToPlayer.get(socket.id)
    if (!mapping) {
      socket.emit('error', {
        type: 'error',
        code: 'NOT_IN_ROOM',
        message: 'You must join a room first'
      })
      return
    }

    // Verify admin permission
    const room = this.roomManager.getRoom(mapping.roomId)
    const adminPlayer = room?.players.find(p => p.id === mapping.playerId)
    if (!adminPlayer?.isAdmin) {
      socket.emit('error', {
        type: 'error',
        code: 'UNAUTHORIZED',
        message: 'Admin access required'
      })
      return
    }

    // Prevent self-boot
    if (message.playerId === mapping.playerId) {
      socket.emit('error', {
        type: 'error',
        code: 'CANNOT_BOOT_SELF',
        message: 'Cannot boot yourself'
      })
      return
    }

    // Boot the player
    const targetPlayer = room?.players.find(p => p.id === message.playerId)
    if (!targetPlayer) {
      socket.emit('error', {
        type: 'error',
        code: 'PLAYER_NOT_FOUND',
        message: 'Player not found'
      })
      return
    }

    console.log(`Admin ${adminPlayer.nickname} booting player ${targetPlayer.nickname} from room ${mapping.roomId}`)

    // Remove player from room
    this.roomManager.removePlayer(mapping.roomId, message.playerId)

    // Remove from voting handler
    const votingHandler = this.getVotingHandler(mapping.roomId)
    votingHandler.removePlayer(message.playerId)

    // Clean up socket mapping
    for (const [socketId, socketMapping] of this.socketToPlayer.entries()) {
      if (socketMapping.playerId === message.playerId) {
        this.socketToPlayer.delete(socketId)
        break
      }
    }

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
  }

  /**
   * Admin: Force room back to lobby (kill any in-progress game)
   */
  handleBackToLobby(socket: Socket, message: AdminBackToLobbyMessage): void {
    const mapping = this.socketToPlayer.get(socket.id)
    if (!mapping) {
      socket.emit('error', {
        type: 'error',
        code: 'NOT_IN_ROOM',
        message: 'You must join a room first'
      })
      return
    }

    // Verify admin permission
    const room = this.roomManager.getRoom(mapping.roomId)
    const adminPlayer = room?.players.find(p => p.id === mapping.playerId)
    if (!adminPlayer?.isAdmin) {
      socket.emit('error', {
        type: 'error',
        code: 'UNAUTHORIZED',
        message: 'Admin access required'
      })
      return
    }

    console.log(`Admin ${adminPlayer.nickname} forcing room ${mapping.roomId} back to lobby`)

    // Transition room back to lobby phase
    const lobbyRoom: LobbyState = {
      phase: 'lobby',
      roomId: mapping.roomId,
      players: room.players,
      gameVotes: {},
      readyStates: {},
      selectedGame: null
    }
    this.roomManager.updateRoomState(mapping.roomId, lobbyRoom)

    // Reset voting state
    const votingHandler = this.getVotingHandler(mapping.roomId)
    votingHandler.reset()

    // Broadcast updated room state
    const updated = this.roomManager.getRoom(mapping.roomId)
    if (updated) {
      const roomStateMessage: RoomStateMessage = {
        type: 'room:state',
        state: updated
      }
      this.io.to(mapping.roomId).emit('room:state', roomStateMessage)
      this.broadcastVotingUpdate(mapping.roomId)
    }
  }

  /**
   * Admin: Hard reset - clear all ephemeral server state
   */
  handleHardReset(socket: Socket, message: AdminHardResetMessage): void {
    const mapping = this.socketToPlayer.get(socket.id)
    if (!mapping) {
      socket.emit('error', {
        type: 'error',
        code: 'NOT_IN_ROOM',
        message: 'You must join a room first'
      })
      return
    }

    // Verify admin permission
    const room = this.roomManager.getRoom(mapping.roomId)
    const adminPlayer = room?.players.find(p => p.id === mapping.playerId)
    if (!adminPlayer?.isAdmin) {
      socket.emit('error', {
        type: 'error',
        code: 'UNAUTHORIZED',
        message: 'Admin access required'
      })
      return
    }

    console.log(`Admin ${adminPlayer.nickname} performing hard reset on room ${mapping.roomId}`)

    const roomId = mapping.roomId

    // Clear all players from room
    const currentRoom = this.roomManager.getRoom(roomId)
    if (currentRoom) {
      // Remove all players
      for (const player of currentRoom.players) {
        this.roomManager.removePlayer(roomId, player.id)
      }
    }

    // Clear voting handler
    const votingHandler = this.getVotingHandler(roomId)
    votingHandler.reset()

    // Clear socket mappings for this room
    for (const [socketId, socketMapping] of this.socketToPlayer.entries()) {
      if (socketMapping.roomId === roomId) {
        this.socketToPlayer.delete(socketId)
      }
    }

    // Clear booted players for this room
    for (const [key] of this.bootedPlayers.entries()) {
      if (key.startsWith(`${roomId}:`)) {
        this.bootedPlayers.delete(key)
      }
    }

    // Fully reset server state: back to title phase (intro/lobby mode)
    const titleRoom: TitleState = {
      phase: 'title',
      roomId,
      players: []
    }
    this.roomManager.updateRoomState(roomId, titleRoom)

    // Broadcast reset to all clients in room (they'll see title/intro state)
    const roomStateMessage: RoomStateMessage = {
      type: 'room:state',
      state: titleRoom
    }
    this.io.to(roomId).emit('room:state', roomStateMessage)
  }

  /**
   * Start monitoring player heartbeats
   */
  startHeartbeatMonitor(): void {
    // Clear existing monitor if running
    if (this.heartbeatMonitor) {
      clearInterval(this.heartbeatMonitor)
    }

    // Check all players every second
    this.heartbeatMonitor = setInterval(() => {
      const now = Date.now()
      const rooms = this.roomManager.getAllRooms()

      for (const room of rooms) {
        let stateChanged = false

        for (const player of room.players) {
          const timeSinceLastSeen = now - player.lastSeenAt.getTime()

          // Boot after 60s without heartbeat
          if (timeSinceLastSeen >= BOOT_THRESHOLD) {
            // Save player data for rejoin
            this.bootedPlayers.set(`${room.roomId}:${player.nickname}`, {
              nickname: player.nickname,
              score: player.score,
              roomId: room.roomId
            })

            // Remove player from room
            this.roomManager.removePlayer(room.roomId, player.id)

            // Remove from voting
            const votingHandler = this.getVotingHandler(room.roomId)
            votingHandler.removePlayer(player.id)

            stateChanged = true
            console.log(`Booted player ${player.nickname} from room ${room.roomId} (60s inactive)`)
          }
          // Mark disconnected after 5s without heartbeat
          else if (timeSinceLastSeen >= DISCONNECT_THRESHOLD && player.isConnected) {
            this.roomManager.updatePlayer(room.roomId, player.id, {
              isConnected: false
            })

            stateChanged = true
            console.log(`Marked player ${player.nickname} as disconnected in room ${room.roomId}`)
          }
        }

        // Broadcast room state if anything changed
        if (stateChanged) {
          const updated = this.roomManager.getRoom(room.roomId)
          if (updated) {
            const roomStateMessage: RoomStateMessage = {
              type: 'room:state',
              state: updated
            }
            this.io.to(room.roomId).emit('room:state', roomStateMessage)

            // Also broadcast voting update in case player was removed
            this.broadcastVotingUpdate(room.roomId)
          }
        }
      }
    }, 1000) // Check every second
  }

  /**
   * Stop monitoring heartbeats
   */
  stopHeartbeatMonitor(): void {
    if (this.heartbeatMonitor) {
      clearInterval(this.heartbeatMonitor)
      this.heartbeatMonitor = null
    }
  }
}
