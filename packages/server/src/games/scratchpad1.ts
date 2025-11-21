/**
 * Scratchpad1 - Video playback validation game module
 *
 * Purpose: Validate video player requirements:
 * 1. Play MP4/MP3 files from server
 * 2. Display dynamically-served SRT subtitles
 * 3. Auto-replay with different SRT file
 * 4. Pre/post-clip transitions
 * 5. Pause integration with admin pause function
 *
 * Flow:
 * 1. Pre-clip transition (3 seconds)
 * 2. Play video with first SRT subtitle
 * 3. Mid-clip transition (2 seconds)
 * 4. Replay same video with second SRT subtitle
 * 5. Post-clip transition (3 seconds)
 * 6. Complete and return to lobby
 */

import type {
	PluggableGameModule,
	GameModuleContext,
	Player,
	GameState,
	GameAction
} from '@jkbox/shared'

export interface Scratchpad1State {
	phase:
		| 'fade-in-1-q'
		| 'play-1-q'
		| 'fade-out-1-q'
		| 'fade-in-1-cpu'
		| 'play-1-cpu'
		| 'fade-out-1-cpu'
		| 'fade-in-2-q'
		| 'play-2-q'
		| 'fade-out-2-q'
		| 'fade-in-2-cpu'
		| 'play-2-cpu'
		| 'fade-out-2-cpu'
	currentClip: 1 | 2 // Which clip we're on
	currentSubtitleType: 'question' | 'cpu' // Which subtitle variant
	videoUrl: string // Path to current video file
	subtitleUrl: string // Path to current SRT file
	phaseStartedAt: number // Timestamp when current phase started
}

export const Scratchpad1Game: PluggableGameModule = {
	id: 'scratchpad1',
	name: 'Scratchpad1',
	minPlayers: 1,
	maxPlayers: 12,

	async initialize(_players: Player[], _context: GameModuleContext): Promise<GameState> {
		console.log('[Scratchpad1] Initializing Machine Girl clip playback')

		const movieDir = 'the-machine-girl-2008-remastered-1080p-bluray-x264-watchable'
		const state: Scratchpad1State = {
			phase: 'fade-in-1-q',
			currentClip: 1,
			currentSubtitleType: 'question',
			videoUrl: `/clips/${movieDir}/1/${movieDir}-1-question.mp4`,
			subtitleUrl: `/clips/${movieDir}/1/${movieDir}-1-question.srt`,
			phaseStartedAt: Date.now()
		}

		return state
	},

	async handleAction(action: GameAction, state: GameState): Promise<GameState> {
		const currentState = state as Scratchpad1State

		console.log('[Scratchpad1] Handling action:', action.type)

		switch (action.type) {
			case 'advance-phase': {
				const nextPhase = getNextPhase(currentState.phase)

				if (nextPhase === 'complete') {
					console.log('[Scratchpad1] All clips complete, ending game')
					return currentState
				}

				// Determine which clip and subtitle type based on next phase
				const phaseInfo = getPhaseInfo(nextPhase)

				const nextState: Scratchpad1State = {
					...currentState,
					phase: nextPhase,
					currentClip: phaseInfo.clip,
					currentSubtitleType: phaseInfo.subtitleType,
					videoUrl: phaseInfo.videoUrl,
					subtitleUrl: phaseInfo.subtitleUrl,
					phaseStartedAt: Date.now()
				}

				console.log('[Scratchpad1] Advanced to phase:', nextPhase)
				return nextState
			}

			default:
				console.warn('[Scratchpad1] Unknown action type:', action.type)
				return currentState
		}
	},

	async loadJumbotronComponent() {
		throw new Error('loadJumbotronComponent should only be called on client')
	},

	async loadControllerComponent() {
		throw new Error('loadControllerComponent should only be called on client')
	},

	async cleanup() {
		console.log('[Scratchpad1] Cleaning up')
		// No timers or resources to clean up - everything is client-driven
	}
}

/**
 * Get next phase in the sequence
 */
function getNextPhase(
	currentPhase: Scratchpad1State['phase']
): Scratchpad1State['phase'] | 'complete' {
	const phaseSequence: Array<Scratchpad1State['phase'] | 'complete'> = [
		'fade-in-1-q',
		'play-1-q',
		'fade-out-1-q',
		'fade-in-1-cpu',
		'play-1-cpu',
		'fade-out-1-cpu',
		'fade-in-2-q',
		'play-2-q',
		'fade-out-2-q',
		'fade-in-2-cpu',
		'play-2-cpu',
		'fade-out-2-cpu',
		'complete'
	]

	const currentIndex = phaseSequence.indexOf(currentPhase)
	return phaseSequence[currentIndex + 1] || 'complete'
}

/**
 * Get phase info (clip number, subtitle type, file paths)
 */
function getPhaseInfo(phase: Scratchpad1State['phase']): {
	clip: 1 | 2
	subtitleType: 'question' | 'cpu'
	videoUrl: string
	subtitleUrl: string
} {
	// Parse phase to determine clip and subtitle type
	const clipNum = phase.includes('-1-') ? 1 : 2
	const isQuestion = phase.includes('-q')

	const movieDir = 'the-machine-girl-2008-remastered-1080p-bluray-x264-watchable'
	const setDir = '1' // All clips are in directory 1
	const baseFilename = `${movieDir}-${clipNum}`
	const subtitleSuffix = isQuestion ? 'question' : 'cpu'

	return {
		clip: clipNum as 1 | 2,
		subtitleType: isQuestion ? 'question' : 'cpu',
		// Always use the -question.mp4 video file (there's only one video per clip)
		videoUrl: `/clips/${movieDir}/${setDir}/${baseFilename}-question.mp4`,
		// But switch the subtitle file based on the phase
		subtitleUrl: `/clips/${movieDir}/${setDir}/${baseFilename}-${subtitleSuffix}.srt`
	}
}
