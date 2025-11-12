import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: process.env['CLIENT_URL'] || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
})

// Middleware
app.use(cors())
app.use(express.json())

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'jkbox-server' })
})

// Socket.io connection handler (placeholder)
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`)

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`)
  })
})

// Start server
const PORT = process.env['PORT'] || 3001
httpServer.listen(PORT, () => {
  console.log(`🎮 jkbox server running on http://localhost:${PORT}`)
  console.log(`📡 WebSocket server ready`)
})

export { app, httpServer, io }
