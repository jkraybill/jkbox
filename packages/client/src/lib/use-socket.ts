import { useEffect, useRef, useCallback } from 'react'
import { useMachine } from '@xstate/react'
import { connectionMachine } from '../fsm/connection-machine'
import { socketClient } from './socket'
import { useGameStore } from '../store/game-store'
import type { RoomStateMessage, ErrorMessage } from '@jkbox/shared'

export function useSocket() {
	const [state, send] = useMachine(connectionMachine)
	const { setConnected, setRoom } = useGameStore()
	const listenersRegistered = useRef(false)

	// Stable callbacks that won't change on re-render
	const handleConnect = useCallback(() => {
		send({ type: 'CONNECTED' })
		setConnected(true)
	}, [send, setConnected])

	const handleDisconnect = useCallback(() => {
		send({ type: 'CONNECTION_LOST' })
		setConnected(false)
	}, [send, setConnected])

	const handleConnectError = useCallback(() => {
		send({ type: 'CONNECT_ERROR' })
	}, [send])

	const handleRoomState = useCallback(
		(message: RoomStateMessage) => {
			setRoom(message.state)
		},
		[setRoom]
	)

	const handleError = useCallback((message: ErrorMessage) => {
		console.error('[useSocket] Server error:', message.message)
	}, [])

	// Initialize connection and register listeners once
	useEffect(() => {
		if (listenersRegistered.current) {
			return
		}

		send({ type: 'CONNECT' })
		const socket = socketClient.connect()

		socket.on('connect', handleConnect)
		socket.on('disconnect', handleDisconnect)
		socket.on('connect_error', handleConnectError)
		socket.on('room:state', handleRoomState)
		socket.on('error', handleError)

		listenersRegistered.current = true

		// Cleanup on unmount
		return () => {
			socket.off('connect', handleConnect)
			socket.off('disconnect', handleDisconnect)
			socket.off('connect_error', handleConnectError)
			socket.off('room:state', handleRoomState)
			socket.off('error', handleError)
			listenersRegistered.current = false
		}
	}, [send, handleConnect, handleDisconnect, handleConnectError, handleRoomState, handleError])

	// Handle reconnection timer separately
	useEffect(() => {
		if (state.value === 'reconnecting') {
			const retryTimer = setTimeout(() => {
				send({ type: 'RETRY' })
			}, state.context.retryDelay)

			return () => clearTimeout(retryTimer)
		}
		return undefined
	}, [state.value, state.context.retryDelay, send])

	return {
		connectionState: state.value,
		isConnected: state.value === 'connected',
		retryCount: state.context.retryCount,
		socket: socketClient.getSocket()
	}
}
