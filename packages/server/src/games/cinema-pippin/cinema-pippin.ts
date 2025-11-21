/**
 * Cinema Pippin - Main Game Module
 */

import type { GameModuleMetadata, GameModule } from '@jkbox/shared'
import { loadFilms } from './film-loader'
import type { CinemaPippinState, GamePhase, FilmData, ClipData } from './types'

export class CinemaPippinGame implements GameModule<CinemaPippinState> {
	private state: CinemaPippinState

	constructor() {
		this.state = this.createInitialState()
	}

	getMetadata(): GameModuleMetadata {
		return {
			id: 'cinema-pippin',
			name: 'Cinema Pippin',
			description: 'Fill in the blanks of foreign film subtitles to create comedy gold',
			minPlayers: 2,
			maxPlayers: 20
		}
	}

	initialize(playerIds: string[]): void {
		// Load 3 random films
		const films = loadFilms()

		// Initialize state
		this.state = {
			phase: 'film_select',
			films,
			currentFilmIndex: 0,
			currentClipIndex: 0,
			keywords: [],
			playerAnswers: new Map(),
			houseAnswers: [],
			allAnswers: [],
			votes: new Map(),
			scores: new Map(playerIds.map((id) => [id, 0])),
			clipWinners: [],
			filmTitle: '',
			endGameVotes: new Map(),
			answerTimeout: 60,
			houseAnswerCount: 1
		}
	}

	getState(): CinemaPippinState {
		return this.state
	}

	getPhase(): GamePhase {
		return this.state.phase
	}

	getCurrentFilm(): FilmData {
		return this.state.films[this.state.currentFilmIndex]
	}

	getCurrentClip(): ClipData {
		const film = this.getCurrentFilm()
		return film.clips[this.state.currentClipIndex]
	}

	advancePhase(): void {
		const phaseTransitions: Record<GamePhase, GamePhase> = {
			film_select: 'clip_intro',
			clip_intro: 'clip_playback',
			clip_playback: 'answer_collection',
			answer_collection: 'voting_playback',
			voting_playback: 'voting_collection',
			voting_collection: 'results_display',
			results_display: 'clip_intro', // Will be overridden by advanceToNextClip
			film_title_collection: 'film_title_voting',
			film_title_voting: 'film_title_results',
			film_title_results: 'final_montage',
			final_montage: 'next_film_or_end',
			next_film_or_end: 'final_scores', // Will be overridden by advanceToNextFilm
			final_scores: 'end_game_vote',
			end_game_vote: 'film_select' // Loop back if "play again"
		}

		this.state.phase = phaseTransitions[this.state.phase]
	}

	advanceToNextClip(): void {
		this.state.currentClipIndex++

		if (this.state.currentClipIndex >= 3) {
			// All 3 clips done, go to film title round
			this.state.phase = 'film_title_collection'
		} else {
			// Next clip
			this.state.phase = 'clip_intro'
		}
	}

	advanceToNextFilm(): void {
		this.state.currentFilmIndex++
		this.state.currentClipIndex = 0

		if (this.state.currentFilmIndex >= 3) {
			// All 3 films done
			this.state.phase = 'final_scores'
		} else {
			// Next film
			this.state.phase = 'clip_intro'
		}
	}

	handlePlayerAction(_playerId: string, _action: unknown): void {
		// To be implemented in subsequent issues
		throw new Error('Not implemented')
	}

	private createInitialState(): CinemaPippinState {
		return {
			phase: 'film_select',
			films: [],
			currentFilmIndex: 0,
			currentClipIndex: 0,
			keywords: [],
			playerAnswers: new Map(),
			houseAnswers: [],
			allAnswers: [],
			votes: new Map(),
			scores: new Map(),
			clipWinners: [],
			filmTitle: '',
			endGameVotes: new Map(),
			answerTimeout: 60,
			houseAnswerCount: 1
		}
	}
}
