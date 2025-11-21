import { describe, it, expect } from 'vitest'
import { createAIPlayer, assignConstraints, loadConstraints, shuffleConstraints } from './ai-player'

describe('AI Player', () => {
	describe('createAIPlayer', () => {
		it('should create AI player with ID and nickname', () => {
			const ai = createAIPlayer(1)

			expect(ai.playerId).toBe('ai-1')
			expect(ai.nickname).toBe('AI 1')
			expect(ai.isAI).toBe(true)
			expect(ai.generationConstraint).toBe('')
			expect(ai.judgingConstraint).toBe('')
		})

		it('should create multiple AI players with unique IDs', () => {
			const ai1 = createAIPlayer(1)
			const ai2 = createAIPlayer(2)
			const ai3 = createAIPlayer(3)

			expect(ai1.playerId).toBe('ai-1')
			expect(ai2.playerId).toBe('ai-2')
			expect(ai3.playerId).toBe('ai-3')

			expect(ai1.nickname).toBe('AI 1')
			expect(ai2.nickname).toBe('AI 2')
			expect(ai3.nickname).toBe('AI 3')
		})
	})

	describe('loadConstraints', () => {
		it('should load constraints from constraints.txt', () => {
			const constraints = loadConstraints()

			expect(constraints.length).toBeGreaterThan(0)
			expect(constraints).toContain("Pippin's word")
			expect(constraints).toContain('Foodie')
			expect(constraints).toContain('Cars')
		})

		it('should return array of non-empty strings', () => {
			const constraints = loadConstraints()

			constraints.forEach((constraint) => {
				expect(typeof constraint).toBe('string')
				expect(constraint.trim().length).toBeGreaterThan(0)
			})
		})
	})

	describe('shuffleConstraints', () => {
		it('should shuffle constraints array', () => {
			const original = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
			const shuffled = shuffleConstraints([...original])

			// Should have same length
			expect(shuffled.length).toBe(original.length)

			// Should contain same elements
			original.forEach((item) => {
				expect(shuffled).toContain(item)
			})

			// Note: Can't guarantee order changed due to randomness
			// But with 8 elements, probability of same order is 1/40320
		})

		it('should not mutate original array', () => {
			const original = ['A', 'B', 'C']
			const copy = [...original]

			shuffleConstraints(original)

			expect(original).toEqual(copy)
		})
	})

	describe('assignConstraints', () => {
		it('should assign 2 constraints per AI player', () => {
			const ai1 = createAIPlayer(1)
			const ai2 = createAIPlayer(2)
			const ai3 = createAIPlayer(3)

			const aiPlayers = [ai1, ai2, ai3]
			const constraints = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

			assignConstraints(aiPlayers, constraints)

			// Each AI should have 2 constraints
			expect(ai1.generationConstraint).toBeTruthy()
			expect(ai1.judgingConstraint).toBeTruthy()
			expect(ai2.generationConstraint).toBeTruthy()
			expect(ai2.judgingConstraint).toBeTruthy()
			expect(ai3.generationConstraint).toBeTruthy()
			expect(ai3.judgingConstraint).toBeTruthy()
		})

		it('should assign different constraints to each AI', () => {
			const ai1 = createAIPlayer(1)
			const ai2 = createAIPlayer(2)

			const aiPlayers = [ai1, ai2]
			const constraints = ['A', 'B', 'C', 'D']

			assignConstraints(aiPlayers, constraints)

			// AI 1 gets constraints 0 and 1
			expect(ai1.generationConstraint).toBe('A')
			expect(ai1.judgingConstraint).toBe('B')

			// AI 2 gets constraints 2 and 3
			expect(ai2.generationConstraint).toBe('C')
			expect(ai2.judgingConstraint).toBe('D')
		})

		it('should handle 6 AI players', () => {
			const aiPlayers = Array.from({ length: 6 }, (_, i) => createAIPlayer(i + 1))
			const constraints = Array.from({ length: 20 }, (_, i) => `Constraint ${i + 1}`)

			assignConstraints(aiPlayers, constraints)

			// All 6 AI players should have constraints assigned
			aiPlayers.forEach((ai) => {
				expect(ai.generationConstraint).toBeTruthy()
				expect(ai.judgingConstraint).toBeTruthy()
			})

			// All constraints should be unique
			const allAssigned = aiPlayers.flatMap((ai) => [ai.generationConstraint, ai.judgingConstraint])
			const unique = new Set(allAssigned)
			expect(unique.size).toBe(12) // 6 AI × 2 constraints
		})
	})
})
