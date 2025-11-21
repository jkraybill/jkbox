import { setup, assign } from 'xstate'
import type { FilmData } from './types'

type CinemaPippinContext = {
	films: FilmData[]
	currentFilmIndex: number
	currentClipIndex: number
	keywords: string[]
	playerAnswers: Map<string, string>
	houseAnswers: string[]
	allAnswers: Array<{
		id: string
		text: string
		authorId: string
		votedBy: string[]
	}>
	votes: Map<string, string>
	scores: Map<string, number>
	clipWinners: string[]
	filmTitle: string
	endGameVotes: Map<string, 'lobby' | 'again'>
}

type CinemaPippinEvents =
	| { type: 'FILM_SELECTED' }
	| { type: 'INTRO_COMPLETE' }
	| { type: 'PLAYBACK_COMPLETE' }
	| { type: 'ANSWERS_COLLECTED' }
	| { type: 'VOTING_PLAYBACK_COMPLETE' }
	| { type: 'VOTES_COLLECTED' }
	| { type: 'RESULTS_SHOWN' }
	| { type: 'FILM_TITLES_COLLECTED' }
	| { type: 'FILM_TITLE_VOTES_COLLECTED' }
	| { type: 'FILM_TITLE_RESULTS_SHOWN' }
	| { type: 'MONTAGE_COMPLETE' }
	| { type: 'NEXT_FILM' }
	| { type: 'END_GAME' }
	| { type: 'FINAL_SCORES_SHOWN' }
	| { type: 'END_GAME_VOTE_COMPLETE' }

export const cinemaPippinMachine = setup({
	types: {
		context: {} as CinemaPippinContext,
		events: {} as CinemaPippinEvents,
		input: {} as { films: FilmData[] }
	},
	guards: {
		hasMoreClips: ({ context }) => context.currentClipIndex < 2,
		hasMoreFilms: ({ context }) => context.currentFilmIndex < context.films.length - 1
	},
	actions: {
		advanceClip: assign({
			currentClipIndex: ({ context }) => context.currentClipIndex + 1
		}),
		advanceFilm: assign({
			currentFilmIndex: ({ context }) => context.currentFilmIndex + 1,
			currentClipIndex: 0
		})
	}
}).createMachine({
	id: 'cinemaPippin',
	initial: 'film_select',
	context: ({ input }) => ({
		films: input.films,
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
		endGameVotes: new Map()
	}),
	states: {
		film_select: {
			on: {
				FILM_SELECTED: 'clip_intro'
			}
		},
		clip_intro: {
			on: {
				INTRO_COMPLETE: 'clip_playback'
			}
		},
		clip_playback: {
			on: {
				PLAYBACK_COMPLETE: 'answer_collection'
			}
		},
		answer_collection: {
			on: {
				ANSWERS_COLLECTED: 'voting_playback'
			}
		},
		voting_playback: {
			on: {
				VOTING_PLAYBACK_COMPLETE: 'voting_collection'
			}
		},
		voting_collection: {
			on: {
				VOTES_COLLECTED: 'results_display'
			}
		},
		results_display: {
			on: {
				RESULTS_SHOWN: [
					{
						guard: 'hasMoreClips',
						target: 'clip_intro',
						actions: 'advanceClip'
					},
					{
						target: 'film_title_collection'
					}
				]
			}
		},
		film_title_collection: {
			on: {
				FILM_TITLES_COLLECTED: 'film_title_voting'
			}
		},
		film_title_voting: {
			on: {
				FILM_TITLE_VOTES_COLLECTED: 'film_title_results'
			}
		},
		film_title_results: {
			on: {
				FILM_TITLE_RESULTS_SHOWN: 'final_montage'
			}
		},
		final_montage: {
			on: {
				MONTAGE_COMPLETE: 'next_film_or_end'
			}
		},
		next_film_or_end: {
			on: {
				NEXT_FILM: {
					guard: 'hasMoreFilms',
					target: 'film_select',
					actions: 'advanceFilm'
				},
				END_GAME: 'final_scores'
			}
		},
		final_scores: {
			on: {
				FINAL_SCORES_SHOWN: 'end_game_vote'
			}
		},
		end_game_vote: {
			on: {
				END_GAME_VOTE_COMPLETE: 'complete'
			}
		},
		complete: {
			type: 'final'
		}
	}
})
