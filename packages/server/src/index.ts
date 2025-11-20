import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import type {
  JoinMessage,
  WatchMessage,
  LobbyVoteGameMessage,
  LobbyReadyToggleMessage,
  AdminBootPlayerMessage,
  AdminBackToLobbyMessage,
  AdminHardResetMessage
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
    origin: process.env['CLIENT_URL'] || ['http://localhost:3000', 'http://localhost:3002'],
    methods: ['GET', 'POST']
  },
  // Connection State Recovery: automatically restore sessions after brief disconnects
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes - balance between party tolerance and memory
    skipMiddlewares: true, // Don't re-run middlewares on recovery (session already validated)
  },
  // Heartbeat tuning for local network party games
  pingInterval: 10000, // Send PING every 10 seconds (default: 25s) - faster disconnect detection
  pingTimeout: 5000,   // Wait 5 seconds for PONG (default: 60s) - quick dead connection cleanup
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

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`)
    connectionHandler.handleDisconnect(socket)
  })
})

// Start server
const PORT = process.env['PORT'] || 3001
httpServer.listen(PORT, () => {
  console.log(`🎮 jkbox server running on http://localhost:${PORT}`)
  console.log(`📡 WebSocket server ready`)
})

export { app, httpServer, io }
