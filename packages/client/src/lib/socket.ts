import { io, Socket } from 'socket.io-client'
import type { ServerMessage, ClientMessage } from '@jkbox/shared'

/**
 * Get the WebSocket server URL dynamically
 * - In dev (localhost): use localhost:3001
 * - On network (192.168.x.x): use same hostname with port 3001
 * - Handles WSL2 network access from phones
 */
function getServerUrl(): string {
	// Allow override via env var (useful for custom deployments)
	if (import.meta.env['VITE_SERVER_URL']) {
		return import.meta.env['VITE_SERVER_URL'] as string
	}

	const hostname = window.location.hostname
	const serverPort = (import.meta.env['VITE_SERVER_PORT'] as string | undefined) || '3001'
	const protocol = window.location.protocol

	return `${protocol}//${hostname}:${serverPort}`
}

class SocketClient {
	private socket: Socket | null = null

	connect(): Socket {
		if (this.socket?.connected) {
			return this.socket
		}

		const serverUrl = getServerUrl()
		console.log(`🔌 Connecting to WebSocket server: ${serverUrl}`)

		this.socket = io(serverUrl, {
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

	on<T extends ServerMessage>(eventType: T['type'], handler: (message: T) => void): void {
		if (!this.socket) {
			console.error('Cannot attach handler: socket not initialized')
			return
		}

		// eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
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
