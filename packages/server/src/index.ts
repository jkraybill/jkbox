import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import type {
  JoinMessage,
  WatchMessage,
  LobbyVoteGameMessage,
  LobbyReadyToggleMessage
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
  }
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

// Room creation endpoint
app.post('/api/rooms', (_req, res) => {
  const room = roomManager.createRoom()
  res.json({ room })
})

// Get room endpoint
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
  console.log(`Client connected: ${socket.id}`)

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
