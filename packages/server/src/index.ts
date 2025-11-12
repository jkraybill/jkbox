import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import type { JoinMessage, WatchMessage } from '@jkbox/shared'
import { RoomManager } from './room-manager'
import { ConnectionHandler } from './connection-handler'

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: process.env['CLIENT_URL'] || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
})

// Initialize managers
const roomManager = new RoomManager()
const connectionHandler = new ConnectionHandler(roomManager, io)

// Middleware
app.use(cors())
app.use(express.json())

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'jkbox-server' })
})

// Room creation endpoint
app.post('/api/rooms', (req, res) => {
  const { hostId } = req.body as { hostId?: string }

  if (!hostId) {
    res.status(400).json({ error: 'hostId required' })
    return
  }

  const room = roomManager.createRoom(hostId)
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
