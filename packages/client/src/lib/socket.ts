import { io, Socket } from 'socket.io-client'
import type { ServerMessage, ClientMessage } from '@jkbox/shared'

const SERVER_URL = import.meta.env['VITE_SERVER_URL'] || 'http://localhost:3001'

class SocketClient {
  private socket: Socket | null = null

  connect(): Socket {
    if (this.socket?.connected) {
      return this.socket
    }

    this.socket = io(SERVER_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 16000,
      reconnectionAttempts: 5
    })

    return this.socket
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
  }

  send(message: ClientMessage): void {
    if (!this.socket?.connected) {
      console.error('Cannot send message: socket not connected')
      return
    }

    this.socket.emit(message.type, message)
  }

  on<T extends ServerMessage>(
    eventType: T['type'],
    handler: (message: T) => void
  ): void {
    if (!this.socket) {
      console.error('Cannot attach handler: socket not initialized')
      return
    }

    this.socket.on(eventType, handler as any)
  }

  off(eventType: string, handler?: (...args: unknown[]) => void): void {
    if (!this.socket) {
      return
    }

    if (handler) {
      this.socket.off(eventType, handler)
    } else {
      this.socket.off(eventType)
    }
  }

  getSocket(): Socket | null {
    return this.socket
  }
}

export const socketClient = new SocketClient()
