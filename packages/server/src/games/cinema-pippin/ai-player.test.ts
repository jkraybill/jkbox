import { describe, it, expect } from 'vitest'
import { createAIPlayer, createAIPlayers, loadConstraints, shuffleConstraints } from './ai-player'

describe('AI Player', () => {
	describe('createAIPlayer', () => {
		it('should create AI player with constraint-based nickname', () => {
			const ai = createAIPlayer(1, 'Foodie')

			expect(ai.playerId).toBe('ai-1')
			expect(ai.nickname).toBe('FoodieBot')
			expect(ai.isAI).toBe(true)
			expect(ai.constraint).toBe('Foodie')
		})

		it('should handle multi-word constraints by using first word', () => {
			const ai1 = createAIPlayer(1, "Pippin's word")
			const ai2 = createAIPlayer(2, 'Pop culture')
			const ai3 = createAIPlayer(3, 'The letter A')

			expect(ai1.nickname).toBe("Pippin'sBot")
			expect(ai2.nickname).toBe('PopBot')
			expect(ai3.nickname).toBe('TheBot')
		})
	})

	describe('createAIPlayers', () => {
		it('should create multiple AI players with unique constraints', () => {
			const constraints = ['Foodie', 'Cars', 'Animals']
			const aiPlayers = createAIPlayers(3, constraints)

			expect(aiPlayers.length).toBe(3)
			expect(aiPlayers[0].nickname).toBe('FoodieBot')
			expect(aiPlayers[0].constraint).toBe('Foodie')
			expect(aiPlayers[1].nickname).toBe('CarsBot')
			expect(aiPlayers[1].constraint).toBe('Cars')
			expect(aiPlayers[2].nickname).toBe('AnimalsBot')
			expect(aiPlayers[2].constraint).toBe('Animals')
		})

		it('should throw error if not enough constraints', () => {
			const constraints = ['Foodie', 'Cars']
			expect(() => createAIPlayers(3, constraints)).toThrow()
		})
	})

	describe('loadConstraints', () => {
		it('should load constraints from assets/constraints.txt', () => {
			const constraints = loadConstraints()

			expect(constraints.length).toBeGreaterThan(0)
			// Check for actual constraint content from assets/constraints.txt
			expect(constraints.some((c) => c.includes('Pippin word'))).toBe(true)
			expect(constraints.some((c) => c.includes('Pun'))).toBe(true)
			expect(constraints.some((c) => c.includes('Saynomore'))).toBe(true)
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

})
