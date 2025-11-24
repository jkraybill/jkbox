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
	authorId: string // player ID or 'house' for house answers
	isHouseAnswer?: boolean // True if assigned from house pool due to timeout
	houseAssignedTo?: string // Player ID who got this house answer (for attribution)
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
	| 'scoreboard_transition'
	| 'film_title_collection'
	| 'film_title_voting'
	| 'film_title_results'
	| 'final_montage'
	| 'next_film_or_end'
	| 'final_scores'
	| 'end_game_vote'

export interface AIPlayerData {
	playerId: string
	nickname: string
	constraint: string // Single constraint for both generation and judging
}

export interface PlayerStatus {
	hasSubmittedAnswer?: boolean
	hasVoted?: boolean
}

export interface PlayerError {
	playerId: string
	message: string
	code: string
}

export interface CinemaPippinState {
	phase: GamePhase
	films: FilmData[]
	currentFilmIndex: number
	currentClipIndex: number
	keywords: string[] // One per film (C1 winner)
	playerAnswers: Map<string, string>
	houseAnswerQueue: string[] // Pre-generated house answers for timeouts
	allAnswers: Answer[]
	currentAnswerIndex: number // Which answer is currently being shown in voting_playback
	votes: Map<string, string> // playerId -> answerId
	scores: Map<string, number>
	scoresBeforeRound: Map<string, number> // Scores before current round (for scoreboard transition)
	voteCountsThisRound: Map<string, number> // How many votes each player got this round
	clipWinners: string[] // Winning answer per clip
	filmTitle: string // Winning film title
	endGameVotes: Map<string, 'lobby' | 'again'>
	answerTimeout: number
	answerCollectionStartTime?: number // Timestamp when answer_collection started
	votingCollectionStartTime?: number // Timestamp when voting_collection started
	votingTimeout: number // Voting timeout in seconds (default 30)
	totalPlayers?: number // Total number of players (for auto-advance check)
	aiPlayers: AIPlayerData[] // AI players with their constraints
	playerStatus: Map<string, PlayerStatus> // Track submission/voting status per player
	playerErrors: Map<string, PlayerError> // Per-player error messages
}
