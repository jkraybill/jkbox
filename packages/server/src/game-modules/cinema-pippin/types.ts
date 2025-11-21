// Cinema Pippin game module types

export interface CinemaPippinState {
	films: FilmData[] // 3 films
	currentFilmIndex: number
	currentClipIndex: number // 0, 1, 2 (C1/C2/C3)
	keywords: string[] // One per film (C1 winner)
	playerAnswers: Map<string, string>
	houseAnswers: string[]
	allAnswers: Answer[] // Shuffled player + house
	votes: Map<string, string> // playerId → answerId
	scores: Map<string, number> // playerId → total score
	clipWinners: string[] // Winning answer per clip
	filmTitle: string // Winning film title
	endGameVotes: Map<string, 'lobby' | 'again'>
}

export interface FilmData {
	filmName: string // e.g., "malena-2000"
	sequenceNumber: number // e.g., 1, 2, 3, 4, 5, 6
	clips: ClipData[] // 3 clips
}

export interface ClipData {
	clipNumber: 1 | 2 | 3
	videoPath: string // malena-2000-1-question.mp4
	srtPath: string // malena-2000-1-question.srt
	precomputedAnswers: string[] // From answers.json (3 house answers per clip)
}

export interface Answer {
	id: string
	text: string
	authorId: string // 'house' for AI-generated answers, playerId for user answers
	votedBy: string[]
}

export type CinemaPippinPhase =
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
