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
	AdminUpdateConfigMessage,
	AdminPauseMessage,
	AdminUnpauseMessage,
	AdminReplayClipMessage,
	ClipReplayMessage,
	RestoreSessionMessage,
	GameId,
	CountdownState,
	LobbyState,
	PlayingState,
	TitleState,
	GameAction,
	GameState
} from '@jkbox/shared'
import { RoomManager } from './room-manager'
import { VotingHandler } from './voting-handler'
import { generatePlayerId, generateSessionToken } from './utils/session-token'
import { GameModuleHost } from './game-module-host'
import { gameRegistry } from './games/game-registry'

// Heartbeat intervals
const DISCONNECT_THRESHOLD = 5000 // Mark disconnected after 5s (client pings every 2s)
const BOOT_THRESHOLD = 60000 // Boot player after 60s

export class ConnectionHandler {
	private socketToPlayer: Map<string, { playerId: string; roomId: string }> = new Map()
	private votingHandlers: Map<string, VotingHandler> = new Map() // roomId → VotingHandler
	private heartbeatMonitor: NodeJS.Timeout | null = null
	private bootedPlayers: Map<string, { nickname: string; score: number; roomId: string }> =
		new Map() // Track booted players for rejoin
	private countdownTimers: Map<string, NodeJS.Timeout> = new Map() // roomId → countdown timer
	private gameHosts: Map<string, GameModuleHost> = new Map() // roomId → active game host

	constructor(
		private roomManager: RoomManager,
		private io: Server
	) {}

	/**
	 * Handle player join (new or reconnect)
	 */
	handleJoin(socket: Socket, message: JoinMessage): void {
		console.log(`[JOIN] Received join request:`, JSON.stringify(message, null, 2))
		const room = this.roomManager.getRoom(message.roomId)

		if (!room) {
			console.error(`[JOIN] Room not found: ${message.roomId}`)
			socket.emit('error', {
				type: 'error',
				code: 'ROOM_NOT_FOUND',
				message: `Room ${message.roomId} not found. Check the code and try again.`
			})
			return
		}

		console.log(
			`[JOIN] Room found: ${room.roomId}, phase: ${room.phase}, players: ${room.players.length}`
		)

		// Track if this is a mid-game join (allowed, but handled differently)
		const isMidGameJoin = room.phase === 'playing'
		if (isMidGameJoin) {
			console.log(`[JOIN] Mid-game join attempt for room ${room.roomId}`)
		}

		// Extract device identifier (prefer client-provided UUID, fallback to IP address)
		const deviceId = message.deviceId || socket.handshake.address || 'unknown'
		console.log(
			`[JOIN] Player joining: ${message.nickname}, deviceId: ${deviceId}, hasClientDeviceId: ${!!message.deviceId}`
		)

		// Remove all existing players from this device before adding new player
		// This prevents duplicate connections from the same device (e.g., refreshing browser)
		const existingPlayers = room.players.filter((p) => p.deviceId === deviceId)
		for (const existingPlayer of existingPlayers) {
			console.log(
				`Removing existing player ${existingPlayer.nickname} (${existingPlayer.id}) from device ${deviceId}`
			)
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

		// Reject nicknames ending in "bot" (case-insensitive) - reserved for AI players
		if (nickname.toLowerCase().endsWith('bot')) {
			socket.emit('error', {
				type: 'error',
				code: 'INVALID_NICKNAME',
				message:
					'Nicknames ending in "Bot" are reserved for AI players. Please choose a different nickname.'
			})
			console.log(`[JOIN] Rejected nickname "${nickname}" - ends with "bot"`)
			return
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
		void socket.join(message.roomId)

		// Add player to voting handler (AI players excluded from voting)
		const votingHandler = this.getVotingHandler(message.roomId)
		votingHandler.addPlayer(player.id, player.isAI ?? false)

		// If mid-game join, notify the active game
		if (isMidGameJoin) {
			const gameHost = this.gameHosts.get(message.roomId)
			if (gameHost) {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
				const game = gameHost.getGame()
				if (game && 'handlePlayerJoin' in game) {
					const cinemaPippinGame = game as { handlePlayerJoin: (playerId: string) => boolean }
					const added = cinemaPippinGame.handlePlayerJoin(player.id)
					console.log(
						`[JOIN] Mid-game join for ${player.nickname}: ${added ? 'added to game' : 'already in game'}`
					)
				}
			}
		}

		// Send join success with player and room state to the joining player
		const updated = this.roomManager.getRoom(message.roomId)
		if (updated) {
			const joinSuccess: JoinSuccessMessage = {
				type: 'join:success',
				player,
				state: updated
			}
			console.log(`[JOIN] Sending join:success to ${player.nickname} (${player.id})`)
			socket.emit('join:success', joinSuccess)
			console.log(`[JOIN] join:success emitted successfully`)

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
	 * Handle session restoration (player reload/reconnect with stored session)
	 * Called when a player tries to restore their session using playerId + sessionToken
	 */
	handleRestoreSession(socket: Socket, message: RestoreSessionMessage): void {
		console.log(
			`[RESTORE] Attempting session restore for player ${message.playerId} in room ${message.roomId}`
		)

		const room = this.roomManager.getRoom(message.roomId)
		if (!room) {
			console.error(`[RESTORE] Room not found: ${message.roomId}`)
			socket.emit('error', {
				type: 'error',
				code: 'ROOM_NOT_FOUND',
				message: `Room ${message.roomId} not found`
			})
			return
		}

		// Find player in room
		const player = room.players.find((p) => p.id === message.playerId)
		if (!player) {
			console.error(`[RESTORE] Player ${message.playerId} not found in room ${message.roomId}`)
			socket.emit('error', {
				type: 'error',
				code: 'PLAYER_NOT_FOUND',
				message: `Session expired or player removed`
			})
			return
		}

		// Validate session token
		if (player.sessionToken !== message.sessionToken) {
			console.error(`[RESTORE] Invalid session token for player ${message.playerId}`)
			socket.emit('error', {
				type: 'error',
				code: 'INVALID_SESSION',
				message: `Invalid session token`
			})
			return
		}

		// Session is valid! Re-map socket to player
		console.log(`[RESTORE] Session valid - restoring player ${player.nickname} (${player.id})`)

		// Update socket→player mapping
		this.socketToPlayer.set(socket.id, {
			playerId: player.id,
			roomId: message.roomId
		})

		// Make socket join the Socket.io room
		void socket.join(message.roomId)

		// Update player connection state
		this.roomManager.updatePlayer(message.roomId, player.id, {
			isConnected: true,
			lastSeenAt: new Date()
		})

		// Add player to voting handler (they may have been removed on disconnect)
		const votingHandler = this.getVotingHandler(message.roomId)
		votingHandler.addPlayer(player.id, player.isAI ?? false)

		// Send restore success with player and current room state
		const updated = this.roomManager.getRoom(message.roomId)
		if (updated) {
			const joinSuccess: JoinSuccessMessage = {
				type: 'join:success',
				player,
				state: updated
			}
			console.log(`[RESTORE] Sending join:success to ${player.nickname} (${player.id})`)
			socket.emit('join:success', joinSuccess)

			// Broadcast room state update to all clients
			const roomStateMessage: RoomStateMessage = {
				type: 'room:state',
				state: updated
			}
			this.io.to(message.roomId).emit('room:state', roomStateMessage)

			// Broadcast updated voting state
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

		// Broadcast room state to all clients in the room
		const updated = this.roomManager.getRoom(mapping.roomId)

		if (updated) {
			// Re-add player to voting handler (they may have been removed on disconnect)
			const player = updated.players.find((p) => p.id === mapping.playerId)
			const votingHandler = this.getVotingHandler(mapping.roomId)
			votingHandler.addPlayer(mapping.playerId, player?.isAI ?? false)

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
		void socket.join(message.roomId)

		// Map socket to room for game action handling (jumbotron can send game actions)
		this.socketToPlayer.set(socket.id, {
			playerId: 'jumbotron',
			roomId: message.roomId
		})

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
	 * Sync AI players for a room with the voting handler
	 * Called from HTTP endpoints (e.g., title→lobby transition)
	 */
	syncAIPlayersForRoom(roomId: string): void {
		const room = this.roomManager.getRoom(roomId)
		if (room) {
			this.syncAIPlayersWithVotingHandler(roomId, room.players)
		}
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
	 * Sync AI players with VotingHandler
	 * Ensures all AI players in the room are registered, and removed AI players are unregistered
	 */
	private syncAIPlayersWithVotingHandler(roomId: string, players: Player[]): void {
		const votingHandler = this.getVotingHandler(roomId)

		// Get current AI player IDs from room
		const currentAIPlayerIds = new Set(players.filter((p) => p.isAI).map((p) => p.id))

		// Remove AI players that are no longer in the room
		// (VotingHandler tracks playerIds internally, we need to sync removals)
		// For now, we'll just ensure all current AI players are added
		// The VotingHandler.addPlayer is idempotent for the aiPlayerIds set

		// Add all current AI players
		for (const player of players) {
			if (player.isAI) {
				votingHandler.addPlayer(player.id, true)
			}
		}

		console.log(`[VotingHandler] Synced ${currentAIPlayerIds.size} AI players for room ${roomId}`)
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

			// If player un-readied and room is in countdown, cancel it
			if (!message.isReady) {
				const room = this.roomManager.getRoom(mapping.roomId)
				if (room?.phase === 'countdown') {
					this.cancelCountdown(mapping.roomId, 'player_unready')
				}
			}

			// If all ready, start countdown
			const votingState = handler.getVotingState()
			if (votingState.allReady && votingState.selectedGame) {
				void this.startCountdown(mapping.roomId, votingState.selectedGame)
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
	 * Start countdown for game launch (with pause support)
	 * Cinema Pippin skips the room countdown - it has its own film countdown animation
	 */
	private async startCountdown(roomId: string, selectedGame: GameId): Promise<void> {
		const room = this.roomManager.getRoom(roomId)
		if (!room) {
			return
		}

		// Cinema Pippin has its own countdown animation in film_select phase
		// Skip the room-level countdown to avoid double countdown
		if (selectedGame === 'cinema-pippin') {
			console.log(`[ConnectionHandler] Skipping room countdown for Cinema Pippin`)
			await this.startGame(roomId, selectedGame)
			return
		}

		const COUNTDOWN_FROM = 5

		const countdownState: CountdownState = {
			phase: 'countdown',
			roomId,
			players: room.players,
			selectedGame,
			secondsRemaining: COUNTDOWN_FROM,
			config: room.config,
			pauseState: {
				isPaused: false,
				pausedBy: null,
				pausedByName: null,
				pausedAt: null
			}
		}

		this.roomManager.updateRoomState(roomId, countdownState)

		// Broadcast initial countdown state
		const stateMessage: RoomStateMessage = {
			type: 'room:state',
			state: countdownState
		}
		this.io.to(roomId).emit('room:state', stateMessage)

		// Countdown with pause support
		let currentCount = COUNTDOWN_FROM
		while (currentCount >= 0) {
			// Check if countdown was cancelled
			const currentRoom = this.roomManager.getRoom(roomId)
			if (currentRoom?.phase !== 'countdown') {
				console.log(`Countdown cancelled for room ${roomId}`)
				return
			}

			// Check if paused - if so, wait and retry
			if (currentRoom.pauseState.isPaused) {
				await new Promise((resolve) => {
					const timer = setTimeout(resolve, 100) // Check pause state every 100ms
					this.countdownTimers.set(roomId, timer)
				})
				continue // Skip to next iteration without decrementing
			}

			// Emit countdown message
			const countdownMessage: LobbyCountdownMessage = {
				type: 'lobby:countdown',
				countdown: currentCount,
				selectedGame
			}
			this.io.to(roomId).emit('lobby:countdown', countdownMessage)

			// Update countdown state
			countdownState.secondsRemaining = currentCount
			this.roomManager.updateRoomState(roomId, countdownState)

			// Wait 1 second before next count (or finish if at 0)
			if (currentCount > 0) {
				await new Promise((resolve) => {
					const timer = setTimeout(resolve, 1000)
					this.countdownTimers.set(roomId, timer)
				})
				currentCount--
			} else {
				break
			}
		}

		// Clean up timer tracking
		this.countdownTimers.delete(roomId)

		// After countdown, start the game
		await this.startGame(roomId, selectedGame)
	}

	/**
	 * Start game - transition to playing phase
	 * FSM boundary: countdown → playing (game module takes control)
	 */
	private async startGame(roomId: string, selectedGame: GameId): Promise<void> {
		const room = this.roomManager.getRoom(roomId)
		if (!room) {
			console.error(`[ConnectionHandler] Cannot start game: room ${roomId} not found`)
			return
		}

		// Get game module from registry
		const gameModule = gameRegistry.get(selectedGame)
		if (!gameModule) {
			console.error(`[ConnectionHandler] Game module not found: ${selectedGame}`)
			// TODO: Show error to players
			return
		}

		console.log(`[ConnectionHandler] Starting game ${selectedGame} in room ${roomId}`)

		// Create game module host
		const gameHost = new GameModuleHost({
			roomId,
			gameModule,
			players: room.players,
			roomManager: this.roomManager,
			onGameComplete: () => this.handleGameComplete(roomId)
		})

		// Store host for this room
		this.gameHosts.set(roomId, gameHost)

		// Subscribe to async state changes (e.g., AI completing in background)
		// When state changes, broadcast to all clients in the room
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		if ('onStateChange' in gameHost.module && typeof gameHost.module.onStateChange === 'function') {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
			gameHost.module.onStateChange((updatedState: GameState) => {
				console.log(
					`[ConnectionHandler] Async state change in room ${roomId}, broadcasting to clients`
				)

				// Update room manager with new game state
				const room = this.roomManager.getRoom(roomId)
				if (room && room.phase === 'playing') {
					const updatedRoom: PlayingState = {
						...room,
						gameState: updatedState
					}
					this.roomManager.updateRoomState(roomId, updatedRoom)

					// Broadcast to all clients
					const stateMessage: RoomStateMessage = {
						type: 'room:state',
						state: updatedRoom
					}
					this.io.to(roomId).emit('room:state', stateMessage)
				}
			})
			console.log(`[ConnectionHandler] Subscribed to async state changes for room ${roomId}`)
		}

		// Initialize game (FSM boundary crossed - game owns state now)
		const gameState = await gameHost.initialize()

		// Transition to playing phase (preserve config from countdown/lobby)
		const playingState: PlayingState = {
			phase: 'playing',
			roomId,
			players: room.players,
			gameId: selectedGame,
			gameState, // Opaque to lobby system
			config: room.config,
			pauseState: {
				isPaused: false,
				pausedBy: null,
				pausedByName: null,
				pausedAt: null
			}
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

		console.log(`✅ Game ${selectedGame} started in room ${roomId}`)
	}

	/**
	 * Handle game completion - broadcast results and schedule cleanup (with pause support)
	 * Called by: GameModuleHost when game calls context.complete()
	 */
	private handleGameComplete(roomId: string): void {
		console.log(`[ConnectionHandler] Game completed in room ${roomId}, showing results`)

		// Broadcast updated room state (now in results phase)
		const room = this.roomManager.getRoom(roomId)
		if (room) {
			const stateMessage: RoomStateMessage = {
				type: 'room:state',
				state: room
			}
			this.io.to(roomId).emit('room:state', stateMessage)
		}

		// Schedule automatic transition back to lobby after 10 seconds (with pause support)
		void (async () => {
			const RESULTS_DISPLAY_TIME = 10000 // 10 seconds
			const CHECK_INTERVAL = 100 // Check every 100ms
			let elapsed = 0

			while (elapsed < RESULTS_DISPLAY_TIME) {
				// Check if room still exists and is in results phase
				const currentRoom = this.roomManager.getRoom(roomId)
				if (!currentRoom || currentRoom.phase !== 'results') {
					console.log(`[ConnectionHandler] Results phase cancelled for room ${roomId}`)
					return
				}

				// If paused, don't increment elapsed time
				if (!currentRoom.pauseState.isPaused) {
					elapsed += CHECK_INTERVAL
				}

				await new Promise((resolve) => setTimeout(resolve, CHECK_INTERVAL))
			}

			console.log(
				`[ConnectionHandler] Results display time elapsed, returning room ${roomId} to lobby`
			)

			// Cleanup game host
			const gameHost = this.gameHosts.get(roomId)
			if (gameHost) {
				await gameHost.cleanup()
				this.gameHosts.delete(roomId)
			}

			// Transition to lobby
			const lobbyRoom = this.roomManager.transitionResultsToLobby(roomId)
			if (lobbyRoom) {
				// Reset voting state
				const handler = this.getVotingHandler(roomId)
				handler.reset()

				// Broadcast new lobby state
				const lobbyMessage: RoomStateMessage = {
					type: 'room:state',
					state: lobbyRoom
				}
				this.io.to(roomId).emit('room:state', lobbyMessage)
				this.broadcastVotingUpdate(roomId)

				console.log(`✅ Room ${roomId} returned to lobby`)
			}
		})()
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

		// Transition back to lobby phase (preserve config from countdown)
		const lobbyState: LobbyState = {
			phase: 'lobby',
			roomId,
			players: room.players,
			gameVotes: {},
			readyStates: {},
			selectedGame: votingState.selectedGame,
			config: room.config,
			pauseState: {
				isPaused: false,
				pausedBy: null,
				pausedByName: null,
				pausedAt: null
			}
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
		const adminPlayer = room?.players.find((p) => p.id === mapping.playerId)
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
		const targetPlayer = room?.players.find((p) => p.id === message.playerId)
		if (!targetPlayer) {
			socket.emit('error', {
				type: 'error',
				code: 'PLAYER_NOT_FOUND',
				message: 'Player not found'
			})
			return
		}

		console.log(
			`Admin ${adminPlayer.nickname} booting player ${targetPlayer.nickname} from room ${mapping.roomId}`
		)

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
	handleBackToLobby(socket: Socket, _message: AdminBackToLobbyMessage): void {
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
		if (!room) {
			socket.emit('error', {
				type: 'error',
				code: 'ROOM_NOT_FOUND',
				message: 'Room not found'
			})
			return
		}

		const adminPlayer = room.players.find((p) => p.id === mapping.playerId)
		if (!adminPlayer?.isAdmin) {
			socket.emit('error', {
				type: 'error',
				code: 'UNAUTHORIZED',
				message: 'Admin access required'
			})
			return
		}

		console.log(`Admin ${adminPlayer.nickname} forcing room ${mapping.roomId} back to lobby`)

		// Cleanup game host if exists
		const gameHost = this.gameHosts.get(mapping.roomId)
		if (gameHost) {
			void gameHost.cleanup().catch((err) => {
				console.error(`[ConnectionHandler] Error cleaning up game host:`, err)
			})
			this.gameHosts.delete(mapping.roomId)
		}

		// Transition room back to lobby phase (preserve config)
		const lobbyRoom: LobbyState = {
			phase: 'lobby',
			roomId: mapping.roomId,
			players: room.players,
			gameVotes: {},
			readyStates: {},
			selectedGame: null,
			config: room.config,
			pauseState: {
				isPaused: false,
				pausedBy: null,
				pausedByName: null,
				pausedAt: null
			}
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
	handleHardReset(socket: Socket, _message: AdminHardResetMessage): void {
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
		const adminPlayer = room?.players.find((p) => p.id === mapping.playerId)
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
			players: [],
			config: currentRoom?.config || { cinemaPippinAIPlayers: 1 }
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
	 * Admin: Update room configuration (e.g., AI guesses setting)
	 */
	async handleUpdateConfig(socket: Socket, message: AdminUpdateConfigMessage): Promise<void> {
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
		const adminPlayer = room?.players.find((p) => p.id === mapping.playerId)
		if (!adminPlayer?.isAdmin) {
			socket.emit('error', {
				type: 'error',
				code: 'UNAUTHORIZED',
				message: 'Admin access required'
			})
			return
		}

		console.log(`Admin ${adminPlayer.nickname} updating config:`, message.config)

		// If updating Cinema Pippin AI players, sync to global config
		if (
			message.config.cinemaPippinAIPlayers !== undefined &&
			message.config.cinemaPippinAIPlayers !== null
		) {
			const { getGlobalConfigStorage } = await import('./storage/global-config-storage')
			const globalConfig = getGlobalConfigStorage()
			globalConfig.setAIPlayerCount(message.config.cinemaPippinAIPlayers)
			console.log(
				`[Global Config] Updated Cinema Pippin AI players to ${message.config.cinemaPippinAIPlayers}`
			)
		}

		// Update config in room manager
		const updatedRoom = this.roomManager.updateRoomConfig(mapping.roomId, message.config)
		if (!updatedRoom) {
			socket.emit('error', {
				type: 'error',
				code: 'ROOM_NOT_FOUND',
				message: 'Room not found'
			})
			return
		}

		// Sync AI players with VotingHandler
		// AI players are managed by room-manager but need to be registered with voting handler
		if (message.config.cinemaPippinAIPlayers !== undefined) {
			this.syncAIPlayersWithVotingHandler(mapping.roomId, updatedRoom.players)
		}

		// Broadcast updated room state to all clients
		const roomStateMessage: RoomStateMessage = {
			type: 'room:state',
			state: updatedRoom
		}
		this.io.to(mapping.roomId).emit('room:state', roomStateMessage)
	}

	/**
	 * Admin: Pause the game
	 */
	handlePause(socket: Socket, _message: AdminPauseMessage): void {
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
		const adminPlayer = room?.players.find((p) => p.id === mapping.playerId)
		if (!adminPlayer?.isAdmin) {
			socket.emit('error', {
				type: 'error',
				code: 'UNAUTHORIZED',
				message: 'Admin access required'
			})
			return
		}

		if (!room) {
			return
		}

		// Only pause during countdown, playing, or results phases
		if (room.phase !== 'countdown' && room.phase !== 'playing' && room.phase !== 'results') {
			socket.emit('error', {
				type: 'error',
				code: 'INVALID_PHASE',
				message: 'Can only pause during countdown, playing, or results phases'
			})
			return
		}

		console.log(`Admin ${adminPlayer.nickname} pausing game in room ${mapping.roomId}`)

		// Update pause state
		const updatedRoom = {
			...room,
			pauseState: {
				isPaused: true,
				pausedBy: adminPlayer.id,
				pausedByName: adminPlayer.nickname,
				pausedAt: new Date()
			}
		}

		this.roomManager.updateRoomState(mapping.roomId, updatedRoom)

		// Broadcast updated room state to all clients
		const roomStateMessage: RoomStateMessage = {
			type: 'room:state',
			state: updatedRoom
		}
		this.io.to(mapping.roomId).emit('room:state', roomStateMessage)
	}

	/**
	 * Admin: Unpause the game
	 */
	handleUnpause(socket: Socket, _message: AdminUnpauseMessage): void {
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
		const adminPlayer = room?.players.find((p) => p.id === mapping.playerId)
		if (!adminPlayer?.isAdmin) {
			socket.emit('error', {
				type: 'error',
				code: 'UNAUTHORIZED',
				message: 'Admin access required'
			})
			return
		}

		if (!room) {
			return
		}

		console.log(`Admin ${adminPlayer.nickname} unpausing game in room ${mapping.roomId}`)

		// Update pause state
		const updatedRoom = {
			...room,
			pauseState: {
				isPaused: false,
				pausedBy: null,
				pausedByName: null,
				pausedAt: null
			}
		}

		this.roomManager.updateRoomState(mapping.roomId, updatedRoom)

		// Broadcast updated room state to all clients
		const roomStateMessage: RoomStateMessage = {
			type: 'room:state',
			state: updatedRoom
		}
		this.io.to(mapping.roomId).emit('room:state', roomStateMessage)
	}

	/**
	 * Admin: Replay the current clip on jumbotron during answer collection
	 */
	handleReplayClip(socket: Socket, _message: AdminReplayClipMessage): void {
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
		const adminPlayer = room?.players.find((p) => p.id === mapping.playerId)
		if (!adminPlayer?.isAdmin) {
			socket.emit('error', {
				type: 'error',
				code: 'UNAUTHORIZED',
				message: 'Admin access required'
			})
			return
		}

		if (!room) {
			return
		}

		// Get the game host to check game phase
		const gameHost = this.gameHosts.get(mapping.roomId)
		if (!gameHost) {
			socket.emit('error', {
				type: 'error',
				code: 'NO_GAME',
				message: 'No game is currently running'
			})
			return
		}

		// Get game state to check phase
		const gameState = gameHost.getState()
		const phase = (gameState as { phase?: string })?.phase

		// Only allow replay during answer collection phases
		if (phase !== 'answer_collection' && phase !== 'film_title_collection') {
			socket.emit('error', {
				type: 'error',
				code: 'INVALID_PHASE',
				message: 'Can only replay clip during answer collection'
			})
			return
		}

		console.log(`Admin ${adminPlayer.nickname} replaying clip in room ${mapping.roomId}`)

		// Broadcast replay message to all watchers (jumbotron)
		const replayMessage: ClipReplayMessage = {
			type: 'clip:replay'
		}
		this.io.to(mapping.roomId).emit('clip:replay', replayMessage)
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

	/**
	 * Handle game action from player or jumbotron
	 */
	async handleGameAction(_socket: Socket, action: GameAction): Promise<void> {
		console.log('[ConnectionHandler] Received game:action:', action)

		// Get room ID from socket mapping or action
		const mapping = this.socketToPlayer.get(_socket.id)
		if (!mapping) {
			console.error('[ConnectionHandler] game:action from unmapped socket:', _socket.id)
			return
		}

		const { roomId } = mapping
		const room = this.roomManager.getRoom(roomId)

		if (!room) {
			console.error(`[ConnectionHandler] game:action for non-existent room: ${roomId}`)
			return
		}

		if (room.phase !== 'playing') {
			console.warn(
				`[ConnectionHandler] game:action received but room ${roomId} is in ${room.phase} phase, not playing`
			)
			return
		}

		// Get the game host for this room
		const gameHost = this.gameHosts.get(roomId)
		if (!gameHost) {
			console.error(`[ConnectionHandler] No game host found for room ${roomId}`)
			return
		}

		// Forward action to game host
		try {
			const newGameState: GameState = await gameHost.handleAction(action)

			// Update room with new game state
			const updatedRoom = this.roomManager.updateGameState(
				roomId,
				newGameState
			) as PlayingState | null
			if (updatedRoom) {
				// Broadcast updated state to all clients
				const stateMessage: RoomStateMessage = {
					type: 'room:state',
					state: updatedRoom
				}
				this.io.to(roomId).emit('room:state', stateMessage)
				console.log(`[ConnectionHandler] game:action processed, state updated for room ${roomId}`)
			}
		} catch (error) {
			console.error('[ConnectionHandler] Error handling game action:', error)
		}
	}

	/**
	 * Handle player quitting from game
	 * Called when a player explicitly quits during gameplay
	 */
	handleGameQuit(socket: Socket): void {
		const mapping = this.socketToPlayer.get(socket.id)
		if (!mapping) {
			console.error('[ConnectionHandler] game:quit from unmapped socket:', socket.id)
			return
		}

		const { playerId, roomId } = mapping
		const room = this.roomManager.getRoom(roomId)

		if (!room) {
			console.error(`[ConnectionHandler] game:quit for non-existent room: ${roomId}`)
			return
		}

		if (room.phase !== 'playing') {
			console.warn(
				`[ConnectionHandler] game:quit received but room ${roomId} is in ${room.phase} phase`
			)
			return
		}

		console.log(`[ConnectionHandler] Player ${playerId} quitting game in room ${roomId}`)

		// Get the game host and call handlePlayerQuit
		const gameHost = this.gameHosts.get(roomId)
		if (gameHost) {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
			const game = gameHost.getGame()
			if (game && 'handlePlayerQuit' in game) {
				const cinemaPippinGame = game as {
					handlePlayerQuit: (playerId: string) => boolean
					shouldAutoAdvance: () => boolean
					isGameEnded: () => boolean
					getActivePlayerCount: () => number
				}

				const removed = cinemaPippinGame.handlePlayerQuit(playerId)

				if (removed) {
					// Remove player from room
					this.roomManager.removePlayer(roomId, playerId)

					// Remove from voting handler
					const votingHandler = this.getVotingHandler(roomId)
					votingHandler.removePlayer(playerId)

					// Clean up socket mapping
					this.socketToPlayer.delete(socket.id)

					// Leave socket room
					void socket.leave(roomId)

					// Check if game has ended (not enough players)
					if (cinemaPippinGame.isGameEnded()) {
						console.log(`[ConnectionHandler] Game ended - not enough players in room ${roomId}`)
						// Return to lobby
						this.handleBackToLobby(socket, { type: 'admin:back-to-lobby' })
						return
					}

					// Broadcast updated room state
					const updatedRoom = this.roomManager.getRoom(roomId)
					if (updatedRoom) {
						const stateMessage: RoomStateMessage = {
							type: 'room:state',
							state: updatedRoom
						}
						this.io.to(roomId).emit('room:state', stateMessage)
					}

					// Check if should auto-advance (all remaining players have completed)
					if (cinemaPippinGame.shouldAutoAdvance()) {
						console.log(`[ConnectionHandler] Auto-advancing after player quit in room ${roomId}`)
						// Trigger state change callback if set
						const stateChangeCallback = (game as { stateChangeCallback?: () => void })
							.stateChangeCallback
						if (stateChangeCallback) {
							stateChangeCallback()
						}
					}

					// Notify quitter that they've left
					socket.emit('game:quit:success', { type: 'game:quit:success' })
				}
			}
		}
	}
}
