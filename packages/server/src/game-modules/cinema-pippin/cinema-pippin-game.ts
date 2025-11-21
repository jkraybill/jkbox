/**
 * Cinema Pippin Game Module
 * Integrates XState FSM with GameModule interface
 */

import { createActor, type Actor } from 'xstate'
import type { GameModule, GameModuleMetadata } from '@jkbox/shared'
import { cinemaPippinMachine } from './cinema-pippin-machine'
import { loadFilms, selectRandomFilms, loadFilmClips } from './film-loader'
import type { CinemaPippinPhase } from './types'
import { loadSRT, mergeSRT, replaceKeyword } from '../../games/cinema-pippin/srt-processor'
import type { Subtitle } from '../../games/cinema-pippin/srt-processor'

const CLIPS_DIR = '/home/jk/jkbox/generated/clips'

export interface CinemaPippinGameState {
	phase: CinemaPippinPhase
	currentFilmIndex: number
	currentClipIndex: number
	currentFilm?: {
		filmName: string
		sequenceNumber: number
	}
	currentClip?: {
		clipNumber: 1 | 2 | 3
		videoUrl: string
		subtitles: Subtitle[]
	}
	playerAnswers: Record<string, string>
	answerTimeout: number
}

export class CinemaPippinGame implements GameModule<CinemaPippinGameState> {
	private actor: Actor<typeof cinemaPippinMachine> | null = null

	getMetadata(): GameModuleMetadata {
		return {
			id: 'cinema-pippin',
			name: 'Cinema Pippin',
			description: 'Fill in the blanks of foreign film subtitles to create comedy gold',
			minPlayers: 2,
			maxPlayers: 20
		}
	}

	async initialize(_playerIds: string[]): Promise<void> {
		// Load all available films
		const availableFilms = await loadFilms(CLIPS_DIR)

		// Select 3 random films
		const selectedFilms = selectRandomFilms(availableFilms, 3)

		// Load clip data for selected films
		const films = await loadFilmClips(selectedFilms, CLIPS_DIR)

		// Create and start the state machine
		this.actor = createActor(cinemaPippinMachine, {
			input: { films }
		})
		this.actor.start()

		// Immediately transition to clip_intro for first clip
		this.actor.send({ type: 'FILM_SELECTED' })
	}

	getState(): CinemaPippinGameState {
		if (!this.actor) {
			throw new Error('Game not initialized')
		}

		const snapshot = this.actor.getSnapshot()
		const context = snapshot.context
		const phase = snapshot.value as CinemaPippinPhase

		const currentFilm = context.films[context.currentFilmIndex]
		const currentClip = currentFilm?.clips[context.currentClipIndex]

		// Load SRT file if we have a current clip
		let subtitles: Subtitle[] = []
		if (currentClip) {
			subtitles = loadSRT(currentClip.srtPath)
		}

		return {
			phase,
			currentFilmIndex: context.currentFilmIndex,
			currentClipIndex: context.currentClipIndex,
			currentFilm: currentFilm
				? {
						filmName: currentFilm.filmName,
						sequenceNumber: currentFilm.sequenceNumber
					}
				: undefined,
			currentClip: currentClip
				? {
						clipNumber: currentClip.clipNumber,
						videoUrl: `/clips/${currentFilm.filmName}/${currentFilm.sequenceNumber}/${currentFilm.filmName}-${currentClip.clipNumber}-question.mp4`,
						subtitles
					}
				: undefined,
			playerAnswers: Object.fromEntries(context.playerAnswers),
			answerTimeout: 60
		}
	}

	getPhase(): string {
		if (!this.actor) {
			return 'film_select'
		}
		return this.actor.getSnapshot().value as string
	}

	handlePlayerAction(playerId: string, action: { type: string; payload?: unknown }): void {
		if (!this.actor) {
			throw new Error('Game not initialized')
		}

		switch (action.type) {
			case 'SUBMIT_ANSWER': {
				const { answer } = action.payload as { answer: string }
				const context = this.actor.getSnapshot().context
				context.playerAnswers.set(playerId, answer)
				break
			}

			case 'VIDEO_COMPLETE': {
				// Automatically advance based on current phase
				const phase = this.getPhase()
				if (phase === 'clip_playback') {
					this.actor.send({ type: 'PLAYBACK_COMPLETE' })
				} else if (phase === 'voting_playback') {
					this.actor.send({ type: 'VOTING_PLAYBACK_COMPLETE' })
				}
				break
			}
		}
	}

	// Helper method to get merged SRT for a specific answer
	getMergedSubtitles(answer: string, keyword?: string): Subtitle[] {
		const state = this.getState()
		if (!state.currentClip) {
			return []
		}

		let subtitles = [...state.currentClip.subtitles]

		// Replace keyword if provided (for C2/C3)
		if (keyword) {
			subtitles = replaceKeyword(subtitles, keyword)
		}

		// Merge answer
		subtitles = mergeSRT(subtitles, answer)

		return subtitles
	}
}
