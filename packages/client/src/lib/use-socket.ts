import { useEffect } from 'react'
import { useMachine } from '@xstate/react'
import { connectionMachine } from '../fsm/connection-machine'
import { socketClient } from './socket'
import { useGameStore } from '../store/game-store'
import type { RoomUpdateMessage, ErrorMessage } from '@jkbox/shared'

export function useSocket() {
  const [state, send] = useMachine(connectionMachine)
  const { setConnected, setRoom } = useGameStore()

  useEffect(() => {
    // Initialize connection
    send({ type: 'CONNECT' })
    const socket = socketClient.connect()

    // Connection event handlers
    socket.on('connect', () => {
      send({ type: 'CONNECTED' })
      setConnected(true)
    })

    socket.on('disconnect', () => {
      send({ type: 'CONNECTION_LOST' })
      setConnected(false)
    })

    socket.on('connect_error', () => {
      send({ type: 'CONNECT_ERROR' })
    })

    // Game event handlers
    socket.on('room:update', (message: RoomUpdateMessage) => {
      setRoom(message.room)
    })

    socket.on('error', (message: ErrorMessage) => {
      console.error('Server error:', message.message)
      // Could show toast notification here
    })

    // Handle reconnection logic
    if (state.value === 'reconnecting') {
      const retryTimer = setTimeout(() => {
        send({ type: 'RETRY' })
      }, state.context.retryDelay)

      return () => clearTimeout(retryTimer)
    }

    // Cleanup on unmount
    return () => {
      socket.off('connect')
      socket.off('disconnect')
      socket.off('connect_error')
      socket.off('room:update')
      socket.off('error')
    }
  }, [state.value, state.context.retryDelay, send, setConnected, setRoom])

  return {
    connectionState: state.value,
    isConnected: state.value === 'connected',
    retryCount: state.context.retryCount,
    socket: socketClient.getSocket()
  }
}
