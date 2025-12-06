import type {
	Player,
	RoomState,
	RoomConfig,
	PauseState,
	LobbyState,
	TitleState,
	ResultsState,
	ModuleGameResults as GameResults
} from '@jkbox/shared'
import { generateRoomCode } from './utils/room-code'
import type { RoomStorage } from './storage/room-storage'
import { getGlobalConfigStorage } from './storage/global-config-storage'
import { loadConstraints, shuffleConstraints } from './games/cinema-pippin/ai-player'

/**
 * Default room configuration
 * These are the starting values for all new rooms
 */
function getDefaultConfig(): RoomConfig {
	const globalConfig = getGlobalConfigStorage()
	return {
		cinemaPippinAIPlayers: globalConfig.getAIPlayerCount() // Default from global config
	}
}

/**
 * Default pause state (unpaused)
 */
function getDefaultPauseState(): PauseState {
	return {
		isPaused: false,
		pausedBy: null,
		pausedByName: null,
		pausedAt: null
	}
}

export class RoomManager {
	private rooms: Map<string, RoomState> = new Map()
	private storage?: RoomStorage
	private singletonRoomId: string | null = null // For single-room mode

	constructor(storage?: RoomStorage) {
		this.storage = storage
	}

	/**
	 * Restore server state from crash-recovery storage (call on server startup)
	 * Clears server state if stale (>5 minutes old) - like a fresh boot
	 */
	restoreFromStorage(): void {
		if (!this.storage) {
			return
		}

		// Check if server state is stale (>5 minutes old)
		const SERVER_STATE_STALENESS_THRESHOLD = 5 * 60 * 1000 // 5 minutes in milliseconds
		const lastUpdate = this.storage.getLastUpdateTimestamp()

		if (lastUpdate !== null) {
			const age = Date.now() - lastUpdate
			const ageMinutes = Math.floor(age / 60000)

			if (age > SERVER_STATE_STALENESS_THRESHOLD) {
				console.log(`⚠️  Server state is stale (${ageMinutes} minutes old) - resetting`)
				this.storage.clearAllServerState()
				return // Don't restore stale data
			}
		}

		// Server state is fresh - restore it (crash recovery)
		const rooms = this.storage.getAllRooms()
		for (const room of rooms) {
			this.rooms.set(room.roomId, room)
		}

		console.log(`✓ Restored ${rooms.length} room(s) from server state (crash recovery)`)
	}

	/**
	 * Save room to crash-recovery storage (auto-save helper)
	 * This is server state persistence, not long-term persistent data
	 */
	private persistRoom(room: RoomState): void {
		if (this.storage) {
			this.storage.saveRoom(room)
		}
	}

	/**
	 * Create a new room with a unique ID (always starts in lobby phase)
	 */
	createRoom(): LobbyState {
		const roomId = generateRoomCode()

		const room: LobbyState = {
			phase: 'lobby',
			roomId,
			players: [],
			gameVotes: {},
			readyStates: {},
			selectedGame: null,
			config: getDefaultConfig(),
			pauseState: getDefaultPauseState()
		}

		this.rooms.set(roomId, room)
		this.persistRoom(room) // Auto-save
		return room
	}

	/**
	 * Get room by ID
	 */
	getRoom(roomId: string): RoomState | undefined {
		return this.rooms.get(roomId)
	}

	/**
	 * Find room containing a specific player
	 */
	getRoomByPlayerId(playerId: string): RoomState | undefined {
		for (const room of this.rooms.values()) {
			if (room.players.some((p) => p.id === playerId)) {
				return room
			}
		}
		return undefined
	}

	/**
	 * Add player to room
	 * Returns false if room is full or doesn't exist
	 */
	addPlayer(roomId: string, player: Player): boolean {
		const room = this.rooms.get(roomId)
		if (!room) {
			return false
		}

		// Check capacity (hardcoded max 12 for now)
		const MAX_PLAYERS = 12
		if (room.players.length >= MAX_PLAYERS) {
			return false
		}

		room.players.push(player)
		this.persistRoom(room) // Auto-save
		return true
	}

	/**
	 * Remove player from room
	 */
	removePlayer(roomId: string, playerId: string): void {
		const room = this.rooms.get(roomId)
		if (!room) {
			return
		}

		room.players = room.players.filter((p) => p.id !== playerId)
		this.persistRoom(room) // Auto-save
	}

	/**
	 * Update player properties in room
	 */
	updatePlayer(roomId: string, playerId: string, updates: Partial<Player>): void {
		const room = this.rooms.get(roomId)
		if (!room) {
			return
		}

		const playerIndex = room.players.findIndex((p) => p.id === playerId)
		if (playerIndex === -1) {
			return
		}

		room.players[playerIndex] = {
			...room.players[playerIndex]!,
			...updates
		}
		this.persistRoom(room) // Auto-save
	}

	/**
	 * Update entire room state (for phase transitions: lobby → countdown → playing → results)
	 */
	updateRoomState(roomId: string, newState: RoomState): void {
		this.rooms.set(roomId, newState)
		this.persistRoom(newState) // Auto-save
	}

	/**
	 * Delete room
	 */
	deleteRoom(roomId: string): void {
		this.rooms.delete(roomId)
		if (this.storage) {
			this.storage.deleteRoom(roomId)
		}
	}

	/**
	 * Get all rooms (for debugging/admin)
	 */
	getAllRooms(): RoomState[] {
		return Array.from(this.rooms.values())
	}

	/**
	 * Get or create singleton room (for single-room Jumbotron mode)
	 * Room starts in 'title' phase for Pippin intro animation
	 */
	getOrCreateSingletonRoom(): RoomState {
		// If singleton room exists, return it
		if (this.singletonRoomId) {
			const room = this.rooms.get(this.singletonRoomId)
			if (room) {
				return room
			}
		}

		// Check if any room exists (from storage restore)
		const existingRooms = Array.from(this.rooms.values())
		if (existingRooms.length > 0) {
			const room = existingRooms[0]!
			this.singletonRoomId = room.roomId
			return room
		}

		// Create new room in title phase
		const roomId = generateRoomCode()
		const room: TitleState = {
			phase: 'title',
			roomId,
			players: [],
			config: getDefaultConfig()
		}

		this.rooms.set(roomId, room)
		this.singletonRoomId = roomId
		this.persistRoom(room)

		console.log(`✨ Created singleton room ${roomId} in title phase`)
		return room
	}

	/**
	 * Transition singleton room from title → lobby
	 * Called after Pippin intro animation completes
	 */
	transitionTitleToLobby(): LobbyState | null {
		if (!this.singletonRoomId) {
			return null
		}

		const room = this.rooms.get(this.singletonRoomId)
		if (!room || room.phase !== 'title') {
			return null
		}

		// Transition to lobby phase (preserve config from title phase)
		const lobbyRoom: LobbyState = {
			phase: 'lobby',
			roomId: room.roomId,
			players: room.players,
			gameVotes: {},
			readyStates: {},
			selectedGame: null,
			config: room.config,
			pauseState: getDefaultPauseState()
		}

		// Sync AI players based on config
		this.syncAIPlayers(lobbyRoom)

		this.rooms.set(room.roomId, lobbyRoom)
		this.persistRoom(lobbyRoom)

		console.log(`✅ Transitioned room ${room.roomId} from title → lobby`)
		return lobbyRoom
	}

	/**
	 * Sync AI players in lobby based on config
	 * AI players are first-class players, created once in lobby and persisting through the game
	 *
	 * Incremental updates:
	 * - When adding: Add random AI with unused constraint
	 * - When removing: Remove random existing AI player
	 * - Always preserve existing AI players that should remain
	 */
	private syncAIPlayers(room: LobbyState): void {
		const targetCount = room.config.cinemaPippinAIPlayers || 0
		const currentAIPlayers = room.players.filter((p) => p.isAI)
		const currentCount = currentAIPlayers.length

		// No change needed
		if (currentCount === targetCount) {
			return
		}

		// Need to remove AI players
		if (currentCount > targetCount) {
			const removeCount = currentCount - targetCount
			// Shuffle current AI players and remove from the end
			const shuffledAI = [...currentAIPlayers].sort(() => Math.random() - 0.5)
			const toRemove = new Set(shuffledAI.slice(0, removeCount).map((p) => p.id))

			room.players = room.players.filter((p) => !toRemove.has(p.id))
			console.log(`[RoomManager] Removed ${removeCount} AI players (${currentCount} → ${targetCount})`)
			return
		}

		// Need to add AI players
		const addCount = targetCount - currentCount

		try {
			const allConstraints = loadConstraints()

			// Get constraints already in use by existing AI players
			const usedConstraints = new Set(
				currentAIPlayers
					.map((p) => p.aiConstraint)
					.filter((c): c is string => c !== undefined)
			)

			// Get available constraints (not already in use)
			const availableConstraints = allConstraints.filter((c) => !usedConstraints.has(c))

			if (availableConstraints.length === 0) {
				console.warn('[RoomManager] No unused constraints available for new AI players')
				return
			}

			// Shuffle available constraints and pick the ones we need
			const shuffled = shuffleConstraints(availableConstraints)

			// Find next available AI ID
			const existingIds = new Set(currentAIPlayers.map((p) => p.id))
			let nextId = 1
			while (existingIds.has(`ai-${nextId}`)) {
				nextId++
			}

			for (let i = 0; i < addCount && i < shuffled.length; i++) {
				const constraint = shuffled[i]
				const firstWord = constraint?.split(/\s+/)[0] || 'AI'
				const nickname = `${firstWord}Bot`

				// Find next available ID
				while (existingIds.has(`ai-${nextId}`)) {
					nextId++
				}

				const aiPlayer: Player = {
					id: `ai-${nextId}`,
					roomId: room.roomId,
					nickname,
					sessionToken: `ai-token-${nextId}`,
					deviceId: `ai-device-${nextId}`,
					isAdmin: false,
					isHost: false,
					isAI: true,
					aiConstraint: constraint,
					score: 0,
					connectedAt: new Date(),
					lastSeenAt: new Date(),
					isConnected: true
				}

				existingIds.add(`ai-${nextId}`)
				room.players.push(aiPlayer)
				console.log(`[RoomManager] Added AI player: ${nickname} (${constraint})`)
				nextId++
			}

			console.log(`[RoomManager] Added ${addCount} AI players (${currentCount} → ${targetCount})`)
		} catch (error) {
			console.error('[RoomManager] Failed to load AI players:', error)
			// Fallback: create generic AI players without constraints
			let nextId = 1
			const existingIds = new Set(currentAIPlayers.map((p) => p.id))

			for (let i = 0; i < addCount; i++) {
				while (existingIds.has(`ai-${nextId}`)) {
					nextId++
				}

				const aiPlayer: Player = {
					id: `ai-${nextId}`,
					roomId: room.roomId,
					nickname: `AIBot${nextId}`,
					sessionToken: `ai-token-${nextId}`,
					deviceId: `ai-device-${nextId}`,
					isAdmin: false,
					isHost: false,
					isAI: true,
					score: 0,
					connectedAt: new Date(),
					lastSeenAt: new Date(),
					isConnected: true
				}

				existingIds.add(`ai-${nextId}`)
				room.players.push(aiPlayer)
				nextId++
			}
			console.log(`[RoomManager] Added ${addCount} generic AI players (fallback)`)
		}
	}

	/**
	 * Update game state within playing phase
	 * Called by: ConnectionHandler when game actions are processed
	 */
	updateGameState(roomId: string, newGameState: GameState): PlayingState | null {
		const room = this.rooms.get(roomId)

		if (!room) {
			console.error(`[RoomManager] Cannot update game state: room ${roomId} not found`)
			return null
		}

		if (room.phase !== 'playing') {
			console.error(
				`[RoomManager] Cannot update game state: room ${roomId} is in ${room.phase} phase, expected playing`
			)
			return null
		}

		// Update the game state
		const updatedRoom: PlayingState = {
			...room,
			gameState: newGameState
		}

		this.rooms.set(roomId, updatedRoom)
		this.persistRoom(updatedRoom)

		return updatedRoom
	}

	/**
	 * Transition room from playing → results
	 * Called by: GameModuleHost when game calls context.complete(results)
	 */
	transitionToResults(
		roomId: string,
		config: { gameId: string; results: GameResults }
	): ResultsState | null {
		const room = this.rooms.get(roomId)

		if (!room) {
			console.error(`[RoomManager] Cannot transition to results: room ${roomId} not found`)
			return null
		}

		if (room.phase !== 'playing') {
			console.error(
				`[RoomManager] Cannot transition to results: room ${roomId} is in ${room.phase} phase, expected playing`
			)
			return null
		}

		console.log(`[RoomManager] Transitioning room ${roomId} from playing → results`)

		// Create results state (preserve config from playing phase, unpause by default)
		const resultsState: ResultsState = {
			phase: 'results',
			roomId: room.roomId,
			players: room.players,
			gameId: config.gameId,
			winners: config.results.winners,
			scores: config.results.scores,
			achievements: config.results.achievements,
			config: room.config,
			pauseState: getDefaultPauseState()
		}

		this.rooms.set(roomId, resultsState)
		this.persistRoom(resultsState)

		console.log(`✅ Transitioned room ${roomId} to results phase`)
		return resultsState
	}

	/**
	 * Transition room from results → lobby
	 * Called by: Timer expiry or admin action after showing results
	 */
	transitionResultsToLobby(roomId: string): LobbyState | null {
		const room = this.rooms.get(roomId)

		if (!room) {
			console.error(`[RoomManager] Cannot transition to lobby: room ${roomId} not found`)
			return null
		}

		if (room.phase !== 'results') {
			console.error(
				`[RoomManager] Cannot transition to lobby: room ${roomId} is in ${room.phase} phase, expected results`
			)
			return null
		}

		console.log(`[RoomManager] Transitioning room ${roomId} from results → lobby`)

		// Create fresh lobby state (preserve players and config)
		const lobbyState: LobbyState = {
			phase: 'lobby',
			roomId: room.roomId,
			players: room.players,
			gameVotes: {},
			readyStates: {},
			selectedGame: null,
			config: room.config,
			pauseState: getDefaultPauseState()
		}

		this.rooms.set(roomId, lobbyState)
		this.persistRoom(lobbyState)

		console.log(`✅ Transitioned room ${roomId} back to lobby phase`)
		return lobbyState
	}

	/**
	 * Hard reset singleton room (for dev/testing)
	 * Clears all players and returns to title phase
	 */
	hardResetSingletonRoom(): TitleState | null {
		if (!this.singletonRoomId) {
			return null
		}

		const roomId = this.singletonRoomId
		const currentRoom = this.rooms.get(roomId)
		if (!currentRoom) {
			return null
		}

		// Create fresh title state (same roomId, preserve config if it exists)
		const titleRoom: TitleState = {
			phase: 'title',
			roomId,
			players: [],
			config: currentRoom.config || getDefaultConfig()
		}

		this.rooms.set(roomId, titleRoom)
		this.persistRoom(titleRoom)

		console.log(`🔄 Hard reset room ${roomId} - back to title phase`)
		return titleRoom
	}

	/**
	 * Update room configuration (for admin settings)
	 */
	updateRoomConfig(roomId: string, configUpdate: Partial<RoomConfig>): RoomState | null {
		const room = this.rooms.get(roomId)
		if (!room) {
			return null
		}

		// Merge config update with existing config
		const updatedRoom = {
			...room,
			config: {
				...room.config,
				...configUpdate
			}
		}

		// If in lobby phase and AI player count changed, sync AI players
		if (updatedRoom.phase === 'lobby' && configUpdate.cinemaPippinAIPlayers !== undefined) {
			this.syncAIPlayers(updatedRoom as LobbyState)
		}

		this.rooms.set(roomId, updatedRoom)
		this.persistRoom(updatedRoom)

		console.log(`⚙️  Updated config for room ${roomId}:`, configUpdate)
		return updatedRoom
	}
}
