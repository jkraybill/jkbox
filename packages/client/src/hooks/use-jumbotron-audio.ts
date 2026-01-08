/**
 * Jumbotron Audio Hook
 *
 * Manages audio for the TV display based on game phases and player actions.
 */

import { useEffect, useRef, useCallback } from 'react'
import { useAudioOptional } from '../audio'
import type { RoomState } from '@jkbox/shared'

interface CinemaPippinGameState {
	phase?: string
	playerStatus?: Record<string, { hasSubmittedAnswer?: boolean; hasVoted?: boolean }>
	scores?: Record<string, number>
}

interface UseJumbotronAudioOptions {
	room: RoomState | null
	enabled?: boolean
}

/**
 * Hook that manages audio based on room phase and game state
 */
export function useJumbotronAudio({ room, enabled = true }: UseJumbotronAudioOptions) {
	const audio = useAudioOptional()
	const prevPhaseRef = useRef<string | null>(null)
	const prevGameStateRef = useRef<CinemaPippinGameState | null>(null)
	const hasPlayedIntroRef = useRef(false)

	// Resume audio context on first user interaction
	const handleUserInteraction = useCallback(() => {
		if (audio?.isReady) {
			void audio.resume()
		}
	}, [audio])

	// Add click listener to resume audio (for autoplay policy)
	useEffect(() => {
		document.addEventListener('click', handleUserInteraction, { once: true })
		return () => {
			document.removeEventListener('click', handleUserInteraction)
		}
	}, [handleUserInteraction])

	// Phase-based music triggers
	useEffect(() => {
		if (!audio?.isReady || !enabled || !room) return

		const currentPhase = room.phase
		const prevPhase = prevPhaseRef.current

		// Skip if phase hasn't changed
		if (currentPhase === prevPhase) return

		console.log(`[JumbotronAudio] Phase changed: ${prevPhase} -> ${currentPhase}`)

		// Title phase: play intro music
		if (currentPhase === 'title' && !hasPlayedIntroRef.current) {
			console.log('[JumbotronAudio] Playing intro music')
			audio.playMusic('intro', { loop: false })
			hasPlayedIntroRef.current = true
		}

		// Transition to lobby: crossfade to lobby music
		if (currentPhase === 'lobby' && prevPhase === 'title') {
			console.log('[JumbotronAudio] Crossfading to lobby music')
			audio.playMusic('lobby', { crossfadeDuration: 1 })
		}

		// Countdown phase: keep lobby music or prepare for game
		if (currentPhase === 'countdown') {
			// Optionally play countdown ticks here
		}

		// Transition to playing: stop music, play game-start fanfare
		if (currentPhase === 'playing' && prevPhase !== 'playing') {
			console.log('[JumbotronAudio] Game starting - playing fanfare')
			audio.stopMusic(0.5)
			audio.playSFX('game-start')
		}

		// Transition to results: play victory fanfare
		if (currentPhase === 'results' && prevPhase === 'playing') {
			console.log('[JumbotronAudio] Game ended - playing victory music')
			audio.playMusic('victory', { loop: false })
		}

		// Transition back to lobby: crossfade to lobby music
		if (currentPhase === 'lobby' && prevPhase === 'results') {
			console.log('[JumbotronAudio] Back to lobby - playing lobby music')
			audio.playMusic('lobby', { crossfadeDuration: 1 })
		}

		prevPhaseRef.current = currentPhase
	}, [audio, enabled, room])

	// Player action triggers (submit/score detection)
	useEffect(() => {
		if (!audio?.isReady || !enabled || !room) return
		if (room.phase !== 'playing') return

		const gameState = room.gameState as CinemaPippinGameState | undefined
		if (!gameState) return

		const prevGameState = prevGameStateRef.current

		// Detect new submissions
		if (gameState.playerStatus && prevGameState?.playerStatus) {
			const players = room.players

			for (const player of players) {
				const currentStatus = gameState.playerStatus[player.id]
				const prevStatus = prevGameState.playerStatus[player.id]

				// Check for new answer submission
				if (currentStatus?.hasSubmittedAnswer && !prevStatus?.hasSubmittedAnswer) {
					console.log(`[JumbotronAudio] Player ${player.nickname} submitted answer`)
					audio.playPlayerSound(player.id, 'submit', player.soundId)
				}

				// Check for new vote submission
				if (currentStatus?.hasVoted && !prevStatus?.hasVoted) {
					console.log(`[JumbotronAudio] Player ${player.nickname} voted`)
					audio.playPlayerSound(player.id, 'submit', player.soundId)
				}
			}
		}

		// Detect score changes
		if (gameState.scores && prevGameState?.scores) {
			const players = room.players

			for (const player of players) {
				const currentScore = gameState.scores[player.id] ?? 0
				const prevScore = prevGameState.scores[player.id] ?? 0

				if (currentScore > prevScore) {
					console.log(
						`[JumbotronAudio] Player ${player.nickname} scored! ${prevScore} -> ${currentScore}`
					)
					audio.playPlayerSound(player.id, 'score', player.soundId)
				}
			}
		}

		// Deep clone game state for next comparison
		prevGameStateRef.current = gameState
			? {
					phase: gameState.phase,
					playerStatus: gameState.playerStatus ? { ...gameState.playerStatus } : undefined,
					scores: gameState.scores ? { ...gameState.scores } : undefined
				}
			: null
	}, [audio, enabled, room])

	// Winner chime when showing results_display in game
	useEffect(() => {
		if (!audio?.isReady || !enabled || !room) return
		if (room.phase !== 'playing') return

		const gameState = room.gameState as CinemaPippinGameState | undefined
		const prevGameState = prevGameStateRef.current

		if (gameState?.phase === 'results_display' && prevGameState?.phase !== 'results_display') {
			console.log('[JumbotronAudio] Results display - playing winner chime')
			audio.playSFX('winner-chime')
		}
	}, [audio, enabled, room])

	return {
		isAudioReady: audio?.isReady ?? false
	}
}
