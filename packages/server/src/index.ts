import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import { networkInterfaces } from 'os'
import { execSync } from 'child_process'
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
	RestoreSessionMessage
} from '@jkbox/shared'
import { RoomManager } from './room-manager'
import { RoomStorage } from './storage/room-storage'
import { ConnectionHandler } from './connection-handler'
import { initInspector } from './fsm/inspector'

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
app.use('/clips', (req, res, next) => {
	// Set CORS headers explicitly for video and subtitle files
	res.setHeader('Access-Control-Allow-Origin', '*')
	res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
	res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type')
	res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range')
	next()
}, express.static('/home/jk/jkbox/generated/clips'))

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
		connectionHandler.handleUpdateConfig(socket, message)
	})

	// Handle admin pause
	socket.on('admin:pause', (message: AdminPauseMessage) => {
		connectionHandler.handlePause(socket, message)
	})

	// Handle admin unpause
	socket.on('admin:unpause', (message: AdminUnpauseMessage) => {
		connectionHandler.handleUnpause(socket, message)
	})

	// Handle game actions (player/jumbotron interactions during gameplay)
	socket.on('game:action', (action: any) => {
		connectionHandler.handleGameAction(socket, action)
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
		io.close(() => {
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
