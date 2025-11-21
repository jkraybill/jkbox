/**
 * Cinema Pippin - Type Definitions
 */

export type ClipNumber = 1 | 2 | 3

export interface ClipData {
	clipNumber: ClipNumber
	videoPath: string
	srtPath: string
	precomputedAnswers: string[]
}

export interface FilmData {
	filmName: string
	sequenceNumber: number
	clips: ClipData[]
}

export interface Answer {
	id: string
	text: string
	authorId: string // 'house' or player ID
	votedBy: string[]
}

export type GamePhase =
	| 'film_select'
	| 'clip_intro'
	| 'clip_playback'
	| 'answer_collection'
	| 'voting_playback'
	| 'voting_collection'
	| 'results_display'
	| 'film_title_collection'
	| 'film_title_voting'
	| 'film_title_results'
	| 'final_montage'
	| 'next_film_or_end'
	| 'final_scores'
	| 'end_game_vote'

export interface CinemaPippinState {
	phase: GamePhase
	films: FilmData[]
	currentFilmIndex: number
	currentClipIndex: number
	keywords: string[] // One per film (C1 winner)
	playerAnswers: Map<string, string>
	houseAnswers: string[]
	allAnswers: Answer[]
	votes: Map<string, string> // playerId -> answerId
	scores: Map<string, number>
	clipWinners: string[] // Winning answer per clip
	filmTitle: string // Winning film title
	endGameVotes: Map<string, 'lobby' | 'again'>
	answerTimeout: number
	houseAnswerCount: number
	answerCollectionStartTime?: number // Timestamp when answer_collection started
	totalPlayers?: number // Total number of players (for auto-advance check)
}
