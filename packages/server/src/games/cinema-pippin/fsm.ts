/**
 * Cinema Pippin - Finite State Machine
 *
 * Centralized phase transition logic. All valid (phase, event) → nextPhase
 * mappings are defined here, making transitions predictable and testable.
 */

import type { GamePhase } from './types'

/**
 * All events that can trigger phase transitions
 */
export type GameEvent =
	// Jumbotron events (video/UI completion)
	| 'FILM_SELECT_COMPLETE'
	| 'INTRO_COMPLETE'
	| 'VIDEO_COMPLETE'
	| 'RESULTS_COMPLETE'
	| 'SCOREBOARD_COMPLETE'
	| 'FILM_TITLE_RESULTS_COMPLETE'
	| 'MONTAGE_COMPLETE'
	| 'NEXT_FILM_CHECK'
	| 'FINAL_SCORES_COMPLETE'
	| 'END_GAME_COMPLETE'
	// Collection phase events
	| 'ALL_ANSWERS_RECEIVED'
	| 'ANSWER_TIMEOUT'
	| 'ALL_VOTES_RECEIVED'
	| 'VOTING_TIMEOUT'
	// Internal events (for conditional transitions)
	| 'LAST_CLIP_COMPLETE' // After scoreboard when clip 3 done
	| 'LAST_FILM_COMPLETE' // When film 3 done

/**
 * Context for conditional transitions
 */
export interface TransitionContext {
	currentClipIndex: number
	currentFilmIndex: number
	allAnswersShown?: boolean // For voting_playback → voting_collection
}

/**
 * Transition result with optional side effects
 */
export interface TransitionResult {
	nextPhase: GamePhase
	valid: boolean
	reason?: string // Why transition was invalid
}

/**
 * Static transition table for simple (phase, event) → nextPhase mappings
 */
const staticTransitions: Partial<Record<GamePhase, Partial<Record<GameEvent, GamePhase>>>> = {
	film_select: {
		FILM_SELECT_COMPLETE: 'clip_intro'
	},
	clip_intro: {
		INTRO_COMPLETE: 'clip_playback'
	},
	clip_playback: {
		VIDEO_COMPLETE: 'answer_collection'
	},
	answer_collection: {
		ALL_ANSWERS_RECEIVED: 'voting_playback',
		ANSWER_TIMEOUT: 'voting_playback'
	},
	// voting_playback needs context (are all answers shown?)
	voting_collection: {
		ALL_VOTES_RECEIVED: 'results_display',
		VOTING_TIMEOUT: 'results_display'
	},
	results_display: {
		RESULTS_COMPLETE: 'scoreboard_transition'
	},
	// scoreboard_transition needs context (clip index)
	film_title_collection: {
		ALL_ANSWERS_RECEIVED: 'film_title_voting',
		ANSWER_TIMEOUT: 'film_title_voting'
	},
	film_title_voting: {
		ALL_VOTES_RECEIVED: 'film_title_results',
		VOTING_TIMEOUT: 'film_title_results'
	},
	film_title_results: {
		FILM_TITLE_RESULTS_COMPLETE: 'final_montage'
	},
	final_montage: {
		MONTAGE_COMPLETE: 'next_film_or_end'
	},
	// next_film_or_end needs context (film index)
	final_scores: {
		FINAL_SCORES_COMPLETE: 'end_game_vote'
	}
	// end_game_vote doesn't transition to another phase (exits to lobby)
}

/**
 * Try a static transition (no context needed)
 */
function tryStaticTransition(phase: GamePhase, event: GameEvent): GamePhase | null {
	return staticTransitions[phase]?.[event] ?? null
}

/**
 * Handle conditional transitions that depend on game context
 */
function handleConditionalTransition(
	phase: GamePhase,
	event: GameEvent,
	context: TransitionContext
): TransitionResult {
	// voting_playback → voting_collection (when all answers shown)
	if (phase === 'voting_playback' && event === 'VIDEO_COMPLETE') {
		if (context.allAnswersShown) {
			return { nextPhase: 'voting_collection', valid: true }
		}
		// Stay in voting_playback (show next answer)
		return { nextPhase: 'voting_playback', valid: true }
	}

	// scoreboard_transition → clip_intro or film_title_collection
	// Note: clipIndex is already incremented before this transition (0→1→2→3)
	if (phase === 'scoreboard_transition' && event === 'SCOREBOARD_COMPLETE') {
		if (context.currentClipIndex >= 3) {
			// All 3 clips done (index now 3), go to film title round
			return { nextPhase: 'film_title_collection', valid: true }
		}
		// More clips to go
		return { nextPhase: 'clip_intro', valid: true }
	}

	// next_film_or_end → clip_intro or final_scores
	// Note: filmIndex is already incremented before this transition (0→1→2→3)
	if (phase === 'next_film_or_end' && event === 'NEXT_FILM_CHECK') {
		if (context.currentFilmIndex >= 3) {
			// All 3 films done (index now 3), go to final scores
			return { nextPhase: 'final_scores', valid: true }
		}
		// More films to go
		return { nextPhase: 'clip_intro', valid: true }
	}

	return {
		nextPhase: phase,
		valid: false,
		reason: `No conditional transition for ${phase} + ${event}`
	}
}

/**
 * Main transition function - the ONLY way to change phases
 *
 * @param currentPhase - Current game phase
 * @param event - Event triggering the transition
 * @param context - Optional context for conditional transitions
 * @returns TransitionResult with next phase and validity
 */
export function transition(
	currentPhase: GamePhase,
	event: GameEvent,
	context?: TransitionContext
): TransitionResult {
	// Try static transition first
	const staticNext = tryStaticTransition(currentPhase, event)
	if (staticNext) {
		console.log(`[FSM] ${currentPhase} + ${event} → ${staticNext}`)
		return { nextPhase: staticNext, valid: true }
	}

	// Try conditional transition
	if (context) {
		const conditionalResult = handleConditionalTransition(currentPhase, event, context)
		if (conditionalResult.valid) {
			console.log(`[FSM] ${currentPhase} + ${event} → ${conditionalResult.nextPhase} (conditional)`)
			return conditionalResult
		}
	}

	// Invalid transition
	console.warn(`[FSM] Invalid transition: ${currentPhase} + ${event}`)
	return {
		nextPhase: currentPhase,
		valid: false,
		reason: `No valid transition from ${currentPhase} on event ${event}`
	}
}

/**
 * Check if a transition is valid without executing it
 */
export function isValidTransition(
	currentPhase: GamePhase,
	event: GameEvent,
	context?: TransitionContext
): boolean {
	const result = transition(currentPhase, event, context)
	return result.valid
}

/**
 * Get all valid events for a given phase
 */
export function getValidEvents(phase: GamePhase): GameEvent[] {
	const events: GameEvent[] = []

	// Static transitions
	const staticEvents = staticTransitions[phase]
	if (staticEvents) {
		events.push(...(Object.keys(staticEvents) as GameEvent[]))
	}

	// Conditional transitions
	if (phase === 'voting_playback') {
		events.push('VIDEO_COMPLETE')
	}
	if (phase === 'scoreboard_transition') {
		events.push('SCOREBOARD_COMPLETE')
	}
	if (phase === 'next_film_or_end') {
		events.push('NEXT_FILM_CHECK')
	}

	return events
}

/**
 * Get all phases that can follow a given phase
 */
export function getPossibleNextPhases(phase: GamePhase): GamePhase[] {
	const phases = new Set<GamePhase>()

	// Static transitions
	const staticEvents = staticTransitions[phase]
	if (staticEvents) {
		Object.values(staticEvents).forEach((p) => phases.add(p))
	}

	// Conditional transitions
	if (phase === 'voting_playback') {
		phases.add('voting_playback') // Stay (show next answer)
		phases.add('voting_collection') // All shown
	}
	if (phase === 'scoreboard_transition') {
		phases.add('clip_intro') // More clips
		phases.add('film_title_collection') // Clip 3 done
	}
	if (phase === 'next_film_or_end') {
		phases.add('clip_intro') // More films
		phases.add('final_scores') // Film 3 done
	}

	return Array.from(phases)
}

/**
 * All phases in order (for visualization)
 */
export const PHASE_ORDER: GamePhase[] = [
	'film_select',
	'clip_intro',
	'clip_playback',
	'answer_collection',
	'voting_playback',
	'voting_collection',
	'results_display',
	'scoreboard_transition',
	'film_title_collection',
	'film_title_voting',
	'film_title_results',
	'final_montage',
	'next_film_or_end',
	'final_scores',
	'end_game_vote'
]
