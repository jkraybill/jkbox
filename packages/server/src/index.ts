import { config } from 'dotenv'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

// Get current file's directory in ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load .env from multiple locations (packaged vs dev)
const envPaths = [
	join(process.cwd(), '.env'), // Packaged: next to executable
	join(__dirname, '../../../.env'), // Dev: relative to server/src
	join(__dirname, '../../../../.env') // Dev: from dist folder
]

let envLoaded = false
for (const envPath of envPaths) {
	const result = config({ path: envPath })
	if (!result.error) {
		console.log(`[ENV] ✓ Loaded environment variables from ${envPath}`)
		envLoaded = true
		break
	}
}

if (!envLoaded) {
	console.warn('[ENV] ⚠️  No .env file found')
}

// Validate ANTHROPIC_API_KEY
const PLACEHOLDER_KEYS = [
	'YOUR_API_KEY_HERE',
	'your_api_key_here',
	'YOUR_KEY_HERE',
	'sk-ant-xxx',
	''
]
const apiKey = process.env.ANTHROPIC_API_KEY || ''
const isPlaceholderKey = PLACEHOLDER_KEYS.some((p) => apiKey === p || apiKey.startsWith('YOUR_'))

if (!apiKey || isPlaceholderKey) {
	console.error('')
	console.error('╔══════════════════════════════════════════════════════════════════╗')
	console.error('║  ⚠️   ANTHROPIC API KEY NOT CONFIGURED                            ║')
	console.error('╠══════════════════════════════════════════════════════════════════╣')
	console.error('║  The game requires a valid Anthropic API key to generate         ║')
	console.error('║  AI answers and judge submissions.                               ║')
	console.error('║                                                                  ║')
	console.error('║  To fix this:                                                    ║')
	console.error('║  1. Get an API key from https://console.anthropic.com/           ║')
	console.error('║  2. Open the .env file in this folder                            ║')
	console.error('║  3. Replace YOUR_API_KEY_HERE with your actual key               ║')
	console.error('║  4. Restart the server                                           ║')
	console.error('╚══════════════════════════════════════════════════════════════════╝')
	console.error('')
	// Don't exit - let the server start but AI features will fail with clear errors
} else {
	console.log(`[ENV] ✓ ANTHROPIC_API_KEY is configured`)
}

import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import { networkInterfaces } from 'os'
import { execSync } from 'child_process'
import { existsSync, readdirSync } from 'fs'
import { resolve } from 'path'
import type {
	JoinMessage,
	WatchMessage,
	LobbyVoteGameMessage,
	LobbyReadyToggleMessage,
	AdminBootPlayerMessage,
	AdminBackToLobbyMessage,
	AdminHardResetMessage,
	AdminUpdateConfigMessage,
	AdminPauseMessage,
	AdminUnpauseMessage,
	AdminReplayClipMessage,
	RestoreSessionMessage,
	GameAction
} from '@jkbox/shared'
import { RoomManager } from './room-manager'
import { RoomStorage } from './storage/room-storage'
import { ConnectionHandler } from './connection-handler'
import { initInspector } from './fsm/inspector'
import { gameRegistry } from './games/game-registry'

// Initialize XState inspector (dev only, controlled by XSTATE_INSPECT env var)
initInspector()

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, {
	cors: {
		origin: true, // Allow all origins (local network party game - no internet exposure)
		methods: ['GET', 'POST'],
		credentials: true
	},
	// Connection State Recovery: automatically restore sessions after brief disconnects
	connectionStateRecovery: {
		maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes - balance between party tolerance and memory
		skipMiddlewares: true // Don't re-run middlewares on recovery (session already validated)
	},
	// Heartbeat tuning for local network party games
	pingInterval: 10000, // Send PING every 10 seconds (default: 25s) - faster disconnect detection
	pingTimeout: 5000 // Wait 5 seconds for PONG (default: 60s) - quick dead connection cleanup
})

// Initialize persistence layer
const storage = new RoomStorage()

// Initialize managers with persistence
const roomManager = new RoomManager(storage)
const connectionHandler = new ConnectionHandler(roomManager, io)

// Restore rooms from previous session (if any)
roomManager.restoreFromStorage()

// Middleware
app.use(cors())
app.use(express.json())

// Serve video clips and subtitles with explicit CORS headers
// Look for clips in multiple locations (dev vs packaged)
const clipsPaths = [
	resolve(process.cwd(), 'clips'), // Packaged: next to executable
	resolve(process.cwd(), 'generated/clips'), // Packaged: generated folder
	resolve(__dirname, '../../../generated/clips'), // Dev: relative to server/src
	resolve(__dirname, '../../../../generated/clips'), // Dev: from dist folder
	'/home/jk/jkbox/generated/clips' // Fallback: absolute dev path
]

const clipsPath = clipsPaths.find((p) => existsSync(p))

if (clipsPath) {
	console.log(`🎬 Serving clips from: ${clipsPath}`)
	app.use(
		'/clips',
		(req, res, next) => {
			// Set CORS headers explicitly for video and subtitle files
			res.setHeader('Access-Control-Allow-Origin', '*')
			res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
			res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type')
			res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range')
			next()
		},
		express.static(clipsPath)
	)
} else {
	console.warn('⚠️  No clips folder found! Videos will not be available.')
	console.warn('   Expected location: ./clips or ./generated/clips')
}

// Production mode: Serve built React client
// Look for client dist in multiple locations (dev vs packaged)
const clientDistPaths = [
	resolve(__dirname, '../../../client/dist'), // Dev: relative to server/src
	resolve(__dirname, '../../client/dist'), // Built: relative to server/dist
	resolve(process.cwd(), 'client-dist'), // Packaged: next to executable
	resolve(process.cwd(), 'dist') // Packaged: dist folder
]

const clientDistPath = clientDistPaths.find((p) => existsSync(p))

if (clientDistPath) {
	console.log(`📦 Serving client from: ${clientDistPath}`)

	// Serve static files from client dist
	app.use(express.static(clientDistPath))

	// Handle client-side routing: serve index.html for unknown routes
	// Must be after API routes but before 404
	app.get('*', (req, res, next) => {
		// Don't intercept API routes or socket.io
		if (
			req.path.startsWith('/api') ||
			req.path.startsWith('/socket.io') ||
			req.path.startsWith('/clips')
		) {
			return next()
		}
		res.sendFile(resolve(clientDistPath, 'index.html'))
	})
} else {
	console.log('⚠️  No built client found - run in dev mode with separate client server')
}

// Helper function to get the Windows host's LAN IP (for WSL2)
function getLocalNetworkIP(): string | null {
	// In WSL2, query Windows directly via PowerShell to get the LAN IP
	try {
		// Query Windows network configuration via PowerShell
		const command = `powershell.exe "Get-NetIPAddress -AddressFamily IPv4 -PrefixOrigin Dhcp | Where IPAddress -like '192.168.*' | Select -ExpandProperty IPAddress -First 1"`

		const result = execSync(command, { encoding: 'utf-8', timeout: 5000 })
		const ip = result.trim().replace(/\r/g, '')

		if (ip && /^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
			console.log(`🌐 Detected Windows host LAN IP: ${ip}`)
			return ip
		}
	} catch (error) {
		console.warn(
			'Failed to get Windows IP via PowerShell, falling back to network interface detection'
		)
	}

	// Fallback: scan network interfaces for non-internal IPv4 (for non-WSL2 environments)
	const nets = networkInterfaces()
	for (const name of Object.keys(nets)) {
		const netInterfaces = nets[name]
		if (!netInterfaces) continue

		for (const net of netInterfaces) {
			const isIPv4 = net.family === 'IPv4'
			// Skip loopback and WSL2 internal IPs (172.x.x.x range is typically WSL2)
			if (isIPv4 && !net.internal && !net.address.startsWith('172.')) {
				return net.address
			}
		}
	}

	return null
}

// Network IP endpoint (for QR code generation)
app.get('/api/network-ip', (_req, res) => {
	const ip = getLocalNetworkIP()
	res.json({ ip })
})

// Health check endpoint
app.get('/api/health', (_req, res) => {
	res.json({ status: 'ok', service: 'jkbox-server' })
})

// API configuration status (for client to check if AI is available)
app.get('/api/status', (_req, res) => {
	const apiKeyVal = process.env.ANTHROPIC_API_KEY || ''
	const placeholders = ['YOUR_API_KEY_HERE', 'your_api_key_here', 'YOUR_KEY_HERE', 'sk-ant-xxx', '']
	const isPlaceholder = placeholders.some((p) => apiKeyVal === p || apiKeyVal.startsWith('YOUR_'))

	res.json({
		aiConfigured: !!(apiKeyVal && !isPlaceholder),
		aiError:
			!apiKeyVal || isPlaceholder
				? 'API key not configured. Edit .env file and add your Anthropic API key.'
				: null
	})
})

// Serve lobby audio files
const lobbyAudioPaths = [
	resolve(process.cwd(), 'assets/audio/lobby'), // Packaged: next to executable
	resolve(__dirname, '../../../assets/audio/lobby'), // Dev: relative to server/src
	resolve(__dirname, '../../../../assets/audio/lobby'), // Dev: from dist folder
	'/home/jk/jkbox/assets/audio/lobby' // Fallback: absolute dev path
]

const lobbyAudioPath = lobbyAudioPaths.find((p) => existsSync(p))

if (lobbyAudioPath) {
	console.log(`🎵 Serving lobby audio from: ${lobbyAudioPath}`)
	app.use('/audio/lobby', express.static(lobbyAudioPath))
} else {
	console.warn('⚠️  No lobby audio folder found!')
}

// List available lobby audio tracks (for random selection)
app.get('/api/audio/lobby-tracks', (_req, res) => {
	if (!lobbyAudioPath) {
		res.json({ tracks: [] })
		return
	}

	try {
		const files = readdirSync(lobbyAudioPath)
		const audioFiles = files.filter(
			(f) => f.endsWith('.mp3') || f.endsWith('.wav') || f.endsWith('.ogg')
		)
		res.json({ tracks: audioFiles })
	} catch (error) {
		console.error('Failed to list lobby audio tracks:', error)
		res.json({ tracks: [] })
	}
})

// Serve music files (intro, victory, etc.)
const musicPaths = [
	resolve(process.cwd(), 'assets/audio/music'),
	resolve(__dirname, '../../../assets/audio/music'),
	resolve(__dirname, '../../../../assets/audio/music'),
	'/home/jk/jkbox/assets/audio/music'
]

const musicPath = musicPaths.find((p) => existsSync(p))

if (musicPath) {
	console.log(`🎶 Serving music from: ${musicPath}`)
	app.use('/audio/music', express.static(musicPath))
} else {
	console.warn('⚠️  No music folder found!')
}

// Serve sound effects
const sfxPaths = [
	resolve(process.cwd(), 'assets/audio/sfx'),
	resolve(__dirname, '../../../assets/audio/sfx'),
	resolve(__dirname, '../../../../assets/audio/sfx'),
	'/home/jk/jkbox/assets/audio/sfx'
]

const sfxPath = sfxPaths.find((p) => existsSync(p))

if (sfxPath) {
	console.log(`🔊 Serving SFX from: ${sfxPath}`)
	app.use('/audio/sfx', express.static(sfxPath))
} else {
	console.warn('⚠️  No SFX folder found!')
}

// Get available games (for lobby voting)
app.get('/api/games', (_req, res) => {
	const allGames = gameRegistry.list()
	const visibleGames = allGames
		.filter((game) => game.visible)
		.sort((a, b) => a.sortOrder - b.sortOrder)
		.map((game) => ({
			id: game.id,
			name: game.name,
			description: game.description,
			minPlayers: game.minPlayers,
			maxPlayers: game.maxPlayers
		}))
	res.json({ games: visibleGames })
})

// Get/create singleton room (for Jumbotron)
app.get('/api/room', (_req, res) => {
	const room = roomManager.getOrCreateSingletonRoom()
	res.json({ room })
})

// Transition singleton room from title → lobby
app.post('/api/room/transition-to-lobby', (_req, res) => {
	const room = roomManager.transitionTitleToLobby()
	if (!room) {
		res.status(400).json({ error: 'Room not in title phase or does not exist' })
		return
	}

	// Sync AI players with voting handler
	connectionHandler.syncAIPlayersForRoom(room.roomId)

	res.json({ room })
})

// Hard reset singleton room (dev/testing convenience)
app.post('/api/room/hard-reset', (_req, res) => {
	const room = roomManager.hardResetSingletonRoom()
	if (!room) {
		res.status(400).json({ error: 'No room to reset' })
		return
	}

	// Broadcast reset to all connected clients
	io.emit('room:state', {
		type: 'room:state',
		state: room
	})

	console.log('🔄 Hard reset via HTTP endpoint - room back to title phase')
	res.json({ room })
})

// Legacy: Room creation endpoint (kept for backwards compatibility)
app.post('/api/rooms', (_req, res) => {
	const room = roomManager.createRoom()
	res.json({ room })
})

// Legacy: Get room by ID endpoint (kept for backwards compatibility)
app.get('/api/rooms/:roomId', (req, res) => {
	const { roomId } = req.params
	const room = roomManager.getRoom(roomId)

	if (!room) {
		res.status(404).json({ error: 'Room not found' })
		return
	}

	res.json({ room })
})

// Socket.io connection handler
io.on('connection', (socket) => {
	if (socket.recovered) {
		// Session recovered after brief disconnect - Socket.io automatically restored:
		// - socket.id
		// - socket.rooms (player still in their game room)
		// - socket.data (custom data attached to socket)
		// - Buffered packets (sent while disconnected)
		console.log(`Session recovered: ${socket.id}`)
		connectionHandler.handleReconnect(socket)
	} else {
		// New connection or recovery failed (disconnected > 2 minutes)
		console.log(`New connection: ${socket.id}`)
	}

	// Handle join messages (players joining)
	socket.on('join', (message: JoinMessage) => {
		connectionHandler.handleJoin(socket, message)
	})

	// Handle session restoration (player reload/reconnect)
	socket.on('restore-session', (message: RestoreSessionMessage) => {
		connectionHandler.handleRestoreSession(socket, message)
	})

	// Handle watch messages (jumbotron/spectators)
	socket.on('watch', (message: WatchMessage) => {
		connectionHandler.handleWatch(socket, message)
	})

	// Handle lobby voting
	socket.on('lobby:vote-game', (message: LobbyVoteGameMessage) => {
		connectionHandler.handleLobbyVote(socket, message)
	})

	// Handle lobby ready toggle
	socket.on('lobby:ready-toggle', (message: LobbyReadyToggleMessage) => {
		connectionHandler.handleLobbyReadyToggle(socket, message)
	})

	// Handle admin boot player
	socket.on('admin:boot-player', (message: AdminBootPlayerMessage) => {
		connectionHandler.handleBootPlayer(socket, message)
	})

	// Handle admin back to lobby
	socket.on('admin:back-to-lobby', (message: AdminBackToLobbyMessage) => {
		connectionHandler.handleBackToLobby(socket, message)
	})

	// Handle admin hard reset
	socket.on('admin:hard-reset', (message: AdminHardResetMessage) => {
		connectionHandler.handleHardReset(socket, message)
	})

	// Handle admin config update
	socket.on('admin:update-config', (message: AdminUpdateConfigMessage) => {
		void connectionHandler.handleUpdateConfig(socket, message)
	})

	// Handle admin pause
	socket.on('admin:pause', (message: AdminPauseMessage) => {
		connectionHandler.handlePause(socket, message)
	})

	// Handle admin unpause
	socket.on('admin:unpause', (message: AdminUnpauseMessage) => {
		connectionHandler.handleUnpause(socket, message)
	})

	// Handle admin replay clip
	socket.on('admin:replay-clip', (message: AdminReplayClipMessage) => {
		connectionHandler.handleReplayClip(socket, message)
	})

	// Handle game actions (player/jumbotron interactions during gameplay)
	socket.on('game:action', (action: GameAction) => {
		void connectionHandler.handleGameAction(socket, action)
	})

	// Handle player quitting from game
	socket.on('game:quit', () => {
		connectionHandler.handleGameQuit(socket)
	})

	// Handle disconnect
	socket.on('disconnect', () => {
		console.log(`Client disconnected: ${socket.id}`)
		connectionHandler.handleDisconnect(socket)
	})
})

// Start server
const PORT = process.env['PORT'] ? parseInt(process.env['PORT'], 10) : 3001
httpServer.listen(PORT, '0.0.0.0', () => {
	console.log(`🎮 jkbox server running on http://localhost:${PORT}`)
	console.log(`📡 WebSocket server ready (listening on all network interfaces)`)
})

// Graceful shutdown handler
function gracefulShutdown(signal: string) {
	console.log(`\n⚠️  Received ${signal}, shutting down gracefully...`)

	// Stop accepting new connections
	httpServer.close(() => {
		console.log('✓ HTTP server closed')

		// Close all Socket.IO connections
		void io.close(() => {
			console.log('✓ Socket.IO connections closed')

			// Stop heartbeat monitor
			connectionHandler.stopHeartbeatMonitor()
			console.log('✓ Heartbeat monitor stopped')

			// Storage is auto-closed by better-sqlite3 on process exit
			console.log('✓ Shutdown complete')
			process.exit(0)
		})
	})

	// Force exit after 5 seconds if graceful shutdown fails
	setTimeout(() => {
		console.error('⚠️  Graceful shutdown timed out, forcing exit')
		process.exit(1)
	}, 5000)
}

// Register shutdown handlers
process.on('SIGINT', () => gracefulShutdown('SIGINT'))
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))

export { app, httpServer, io }
