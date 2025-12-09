import { useState, useEffect, useMemo, useCallback } from 'react'

/**
 * Animation types that can be applied to Pippin.
 * Each maps a frequency band value (0-1) to a CSS transform component.
 */
type AnimationType =
	| 'translateX'
	| 'translateY'
	| 'rotate'
	| 'scale'
	| 'skewX'
	| 'skewY'
	| 'vibrateX'
	| 'vibrateY'
	| 'bounce'
	| 'wiggle'
	| 'pulse'
	| 'tilt'

/**
 * Configuration for each animation type.
 * multiplier: How much the frequency value affects the animation
 * unit: CSS unit for the transform value
 * offset: Base offset (some animations need centering)
 */
interface AnimationConfig {
	multiplier: number
	unit: string
	offset: number
	/** If true, value oscillates rapidly (vibration effect) */
	vibrate?: boolean
	/** Custom transform function */
	transform?: (value: number, time: number) => number
}

/**
 * Maximum hilarity animation configs.
 * These are tuned for chaotic, fun movement.
 */
const ANIMATION_CONFIGS: Record<AnimationType, AnimationConfig> = {
	translateX: {
		multiplier: 80, // pixels - big side-to-side movement
		unit: 'px',
		offset: 0,
		transform: (v, t) => v * Math.sin(t * 0.01) // Oscillating movement
	},
	translateY: {
		multiplier: 60, // pixels - vertical bounce
		unit: 'px',
		offset: 0,
		transform: (v, t) => v * Math.cos(t * 0.015)
	},
	rotate: {
		multiplier: 45, // degrees - significant rotation
		unit: 'deg',
		offset: 0,
		transform: (v, t) => v * Math.sin(t * 0.008) // Swaying rotation
	},
	scale: {
		multiplier: 0.4, // 40% size change
		unit: '',
		offset: 1, // Base scale of 1
		transform: (v, _t) => v * 0.5 + 0.75 // Scale between 0.75 and 1.15
	},
	skewX: {
		multiplier: 20, // degrees of skew
		unit: 'deg',
		offset: 0,
		transform: (v, t) => v * Math.sin(t * 0.012)
	},
	skewY: {
		multiplier: 15, // degrees of skew
		unit: 'deg',
		offset: 0,
		transform: (v, t) => v * Math.cos(t * 0.01)
	},
	vibrateX: {
		multiplier: 15, // rapid small movements
		unit: 'px',
		offset: 0,
		vibrate: true,
		transform: (v, t) => v * Math.sin(t * 0.3) // Fast oscillation
	},
	vibrateY: {
		multiplier: 12,
		unit: 'px',
		offset: 0,
		vibrate: true,
		transform: (v, t) => v * Math.cos(t * 0.35)
	},
	bounce: {
		multiplier: 50, // big vertical bounce
		unit: 'px',
		offset: 0,
		transform: (v, t) => -Math.abs(v * Math.sin(t * 0.02)) // Always bounces up
	},
	wiggle: {
		multiplier: 30, // rotation wiggle
		unit: 'deg',
		offset: 0,
		transform: (v, t) => v * Math.sin(t * 0.05) * Math.cos(t * 0.03)
	},
	pulse: {
		multiplier: 0.3,
		unit: '',
		offset: 1,
		transform: (v, t) => 1 + v * 0.3 * Math.abs(Math.sin(t * 0.025))
	},
	tilt: {
		multiplier: 25,
		unit: 'deg',
		offset: 0,
		transform: (v, t) => v * Math.sin(t * 0.007) * 1.5
	}
}

/**
 * All available animation types for random selection
 */
const ALL_ANIMATION_TYPES: AnimationType[] = Object.keys(ANIMATION_CONFIGS) as AnimationType[]

/**
 * Shuffle array using Fisher-Yates algorithm
 */
function shuffleArray<T>(array: T[]): T[] {
	const shuffled = [...array]
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1))
		const temp = shuffled[i]
		const swapVal = shuffled[j]
		if (temp !== undefined && swapVal !== undefined) {
			shuffled[i] = swapVal
			shuffled[j] = temp
		}
	}
	return shuffled
}

interface UsePippinAnimationsResult {
	/** CSS transform string to apply to Pippin */
	transform: string
	/** Current animation assignments (for debugging) */
	assignments: AnimationType[]
	/** Randomize the animation assignments */
	randomize: () => void
}

/**
 * Hook that maps frequency bands to chaotic Pippin animations.
 *
 * @param frequencyBands - Array of 8 normalized frequency values (0-1)
 * @param isActive - Whether animations should be active
 * @returns Object with CSS transform string and current assignments
 */
export function usePippinAnimations(
	frequencyBands: number[],
	isActive: boolean
): UsePippinAnimationsResult {
	// Randomly assigned animation types (one per frequency band)
	const [assignments, setAssignments] = useState<AnimationType[]>([])

	// Time counter for oscillation effects
	const [time, setTime] = useState(0)

	/**
	 * Randomize animation assignments.
	 * Called on mount and can be called manually to re-roll.
	 */
	const randomize = useCallback(() => {
		// Pick 8 random animations (can repeat since we have 12 types)
		const shuffled = shuffleArray(ALL_ANIMATION_TYPES)
		// Take first 8 (we have 12 types, so some won't be used)
		const selected = shuffled.slice(0, 8)
		console.log('[PippinAnimations] Randomized assignments:', selected)
		setAssignments(selected)
	}, [])

	// Randomize on mount or when activated
	useEffect(() => {
		if (isActive && assignments.length === 0) {
			randomize()
		}
	}, [isActive, assignments.length, randomize])

	// Increment time counter for oscillation effects
	useEffect(() => {
		if (!isActive) {
			setTime(0)
			return
		}

		let frameId: number
		const tick = () => {
			setTime((t) => t + 1)
			frameId = requestAnimationFrame(tick)
		}
		frameId = requestAnimationFrame(tick)

		return () => cancelAnimationFrame(frameId)
	}, [isActive])

	/**
	 * Calculate CSS transform string from frequency bands and assignments
	 */
	const transform = useMemo(() => {
		if (!isActive || assignments.length === 0 || frequencyBands.length === 0) {
			return ''
		}

		const transforms: string[] = []
		let totalTranslateX = 0
		let totalTranslateY = 0
		let totalRotate = 0
		let totalScale = 1
		let totalSkewX = 0
		let totalSkewY = 0

		// Process each band's animation
		assignments.forEach((animType, index) => {
			const bandValue = frequencyBands[index] || 0
			const config = ANIMATION_CONFIGS[animType]

			// Apply custom transform function if available
			const transformedValue = config.transform ? config.transform(bandValue, time) : bandValue

			const value = transformedValue * config.multiplier + config.offset

			// Accumulate transform values by type
			switch (animType) {
				case 'translateX':
				case 'vibrateX':
					totalTranslateX += value
					break
				case 'translateY':
				case 'vibrateY':
				case 'bounce':
					totalTranslateY += value
					break
				case 'rotate':
				case 'wiggle':
				case 'tilt':
					totalRotate += value
					break
				case 'scale':
				case 'pulse':
					totalScale *= value
					break
				case 'skewX':
					totalSkewX += value
					break
				case 'skewY':
					totalSkewY += value
					break
			}
		})

		// Clamp values to prevent Pippin from flying off screen
		totalTranslateX = Math.max(-150, Math.min(150, totalTranslateX))
		totalTranslateY = Math.max(-100, Math.min(100, totalTranslateY))
		totalRotate = Math.max(-60, Math.min(60, totalRotate))
		totalScale = Math.max(0.5, Math.min(1.8, totalScale))
		totalSkewX = Math.max(-30, Math.min(30, totalSkewX))
		totalSkewY = Math.max(-25, Math.min(25, totalSkewY))

		// Build transform string
		transforms.push(`translate(${totalTranslateX.toFixed(1)}px, ${totalTranslateY.toFixed(1)}px)`)
		transforms.push(`rotate(${totalRotate.toFixed(1)}deg)`)
		transforms.push(`scale(${totalScale.toFixed(2)})`)

		if (Math.abs(totalSkewX) > 0.5 || Math.abs(totalSkewY) > 0.5) {
			transforms.push(`skew(${totalSkewX.toFixed(1)}deg, ${totalSkewY.toFixed(1)}deg)`)
		}

		return transforms.join(' ')
	}, [isActive, assignments, frequencyBands, time])

	return {
		transform,
		assignments,
		randomize
	}
}
