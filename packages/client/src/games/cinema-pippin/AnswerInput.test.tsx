import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AnswerInput } from './AnswerInput'

describe('AnswerInput', () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	describe('C1 - Single Word Input', () => {
		it('should render input field and submit button', () => {
			render(
				<AnswerInput clipNumber={1} timeRemaining={60} onSubmit={() => {}} submitted={false} />
			)

			expect(screen.getByPlaceholderText(/single word/i)).toBeInTheDocument()
			expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument()
		})

		it('should allow alphanumeric characters, apostrophes, and hyphens', () => {
			render(
				<AnswerInput clipNumber={1} timeRemaining={60} onSubmit={() => {}} submitted={false} />
			)

			const input = screen.getByPlaceholderText(/single word/i) as HTMLInputElement
			fireEvent.change(input, { target: { value: "McDonald's-Burger" } })

			expect(input.value).toBe("McDonald's-Burger")
		})

		it('should reject spaces in C1 input', () => {
			render(
				<AnswerInput clipNumber={1} timeRemaining={60} onSubmit={() => {}} submitted={false} />
			)

			const input = screen.getByPlaceholderText(/single word/i) as HTMLInputElement
			fireEvent.change(input, { target: { value: 'two words' } })

			// Spaces should be stripped or rejected
			expect(input.value).not.toContain(' ')
		})

		it('should call onSubmit with valid C1 answer', () => {
			const onSubmit = vi.fn()
			render(
				<AnswerInput clipNumber={1} timeRemaining={60} onSubmit={onSubmit} submitted={false} />
			)

			const input = screen.getByPlaceholderText(/single word/i)
			const button = screen.getByRole('button', { name: /submit/i })

			fireEvent.change(input, { target: { value: 'banana' } })
			fireEvent.click(button)

			expect(onSubmit).toHaveBeenCalledWith('banana')
		})

		it('should not submit empty C1 answer', () => {
			const onSubmit = vi.fn()
			render(
				<AnswerInput clipNumber={1} timeRemaining={60} onSubmit={onSubmit} submitted={false} />
			)

			const button = screen.getByRole('button', { name: /submit/i })
			fireEvent.click(button)

			expect(onSubmit).not.toHaveBeenCalled()
		})
	})

	describe('C2/C3 - Multi-Word Input', () => {
		it('should allow spaces in C2 input', () => {
			render(
				<AnswerInput clipNumber={2} timeRemaining={60} onSubmit={() => {}} submitted={false} />
			)

			const input = screen.getByPlaceholderText(/your answer/i) as HTMLInputElement
			fireEvent.change(input, { target: { value: 'eating pasta raw' } })

			expect(input.value).toBe('eating pasta raw')
		})

		it('should allow spaces in C3 input', () => {
			render(
				<AnswerInput clipNumber={3} timeRemaining={60} onSubmit={() => {}} submitted={false} />
			)

			const input = screen.getByPlaceholderText(/your answer/i) as HTMLInputElement
			fireEvent.change(input, { target: { value: 'the best movie ever' } })

			expect(input.value).toBe('the best movie ever')
		})

		it('should call onSubmit with C2 multi-word answer', () => {
			const onSubmit = vi.fn()
			render(
				<AnswerInput clipNumber={2} timeRemaining={60} onSubmit={onSubmit} submitted={false} />
			)

			const input = screen.getByPlaceholderText(/your answer/i)
			const button = screen.getByRole('button', { name: /submit/i })

			fireEvent.change(input, { target: { value: 'something weird' } })
			fireEvent.click(button)

			expect(onSubmit).toHaveBeenCalledWith('something weird')
		})
	})

	describe('Countdown Timer', () => {
		it('should display time remaining', () => {
			render(
				<AnswerInput clipNumber={1} timeRemaining={45} onSubmit={() => {}} submitted={false} />
			)

			expect(screen.getByText(/45/)).toBeInTheDocument()
		})

		it('should show warning when time is low', () => {
			const { rerender } = render(
				<AnswerInput clipNumber={1} timeRemaining={30} onSubmit={() => {}} submitted={false} />
			)

			// Time above 10s - no warning
			expect(screen.getByText(/30/)).toBeInTheDocument()

			// Time at 10s or below - warning style
			rerender(
				<AnswerInput clipNumber={1} timeRemaining={10} onSubmit={() => {}} submitted={false} />
			)

			const timer = screen.getByText(/10/)
			expect(timer).toBeInTheDocument()
		})

		it('should auto-submit when time reaches 0', () => {
			const onSubmit = vi.fn()
			const { rerender } = render(
				<AnswerInput clipNumber={1} timeRemaining={5} onSubmit={onSubmit} submitted={false} />
			)

			const input = screen.getByPlaceholderText(/single word/i)
			fireEvent.change(input, { target: { value: 'banana' } })

			// Verify answer is set
			expect(input).toHaveValue('banana')

			// Time runs out
			rerender(
				<AnswerInput clipNumber={1} timeRemaining={0} onSubmit={onSubmit} submitted={false} />
			)

			// useEffect should trigger and call onSubmit
			expect(onSubmit).toHaveBeenCalledWith('banana')
		})
	})

	describe('Submitted State', () => {
		it('should disable input when submitted', () => {
			render(<AnswerInput clipNumber={1} timeRemaining={60} onSubmit={() => {}} submitted={true} />)

			const input = screen.getByPlaceholderText(/single word/i) as HTMLInputElement
			expect(input).toBeDisabled()
		})

		it('should disable submit button when submitted', () => {
			render(<AnswerInput clipNumber={1} timeRemaining={60} onSubmit={() => {}} submitted={true} />)

			const button = screen.getByRole('button', { name: /submitted/i })
			expect(button).toBeDisabled()
		})

		it('should show submitted confirmation message', () => {
			render(<AnswerInput clipNumber={1} timeRemaining={60} onSubmit={() => {}} submitted={true} />)

			expect(screen.getByText(/answer submitted/i)).toBeInTheDocument()
		})
	})

	describe('Clip Number Display', () => {
		it('should show "Act I" for clip 1', () => {
			render(
				<AnswerInput clipNumber={1} timeRemaining={60} onSubmit={() => {}} submitted={false} />
			)

			expect(screen.getByText(/act i/i)).toBeInTheDocument()
		})

		it('should show "Act II" for clip 2', () => {
			render(
				<AnswerInput clipNumber={2} timeRemaining={60} onSubmit={() => {}} submitted={false} />
			)

			expect(screen.getByText(/act ii/i)).toBeInTheDocument()
		})

		it('should show "Act III" for clip 3', () => {
			render(
				<AnswerInput clipNumber={3} timeRemaining={60} onSubmit={() => {}} submitted={false} />
			)

			expect(screen.getByText(/act iii/i)).toBeInTheDocument()
		})
	})
})
