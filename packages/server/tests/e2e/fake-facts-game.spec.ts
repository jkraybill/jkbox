import { test, expect } from '@playwright/test'

test.describe('Fake Facts Game Flow', () => {
  test('should start Fake Facts game and show question', async ({ page }) => {
    // Create room and join as host
    await page.goto('/')
    await page.getByRole('button', { name: /create|start party/i }).click()
    await page.waitForURL(/\/room\/[A-Z]{4}/)

    await page.getByPlaceholder(/name|nickname/i).fill('GameHost')
    await page.getByRole('button', { name: /join|continue/i }).click()

    // Select Fake Facts game
    const fakeFacts = page.getByText(/fake facts/i)
    if (await fakeFacts.isVisible()) {
      await fakeFacts.click()
    }

    // Start the game
    const startButton = page.getByRole('button', { name: /start|begin|play/i })
    await startButton.click()

    // Should transition to playing state
    await expect(page.getByText(/playing|question|round/i)).toBeVisible({ timeout: 10000 })

    // Should see a question with blank (_____)
    await expect(page.getByText(/_____/)).toBeVisible()

    // Should see answer choices
    const answerButtons = page.getByRole('button').filter({ hasText: /^[A-E]\./ })
    await expect(answerButtons.first()).toBeVisible()

    // Should have 6 answer choices (1 real + 5 house)
    const answerCount = await answerButtons.count()
    expect(answerCount).toBe(6)
  })

  test('should allow players to submit answers', async ({ browser }) => {
    const hostContext = await browser.newContext()
    const playerContext = await browser.newContext()

    const hostPage = await hostContext.newPage()
    const playerPage = await playerContext.newPage()

    try {
      // Host creates room
      await hostPage.goto('/')
      await hostPage.getByRole('button', { name: /create|start party/i }).click()
      await hostPage.waitForURL(/\/room\/[A-Z]{4}/)
      const roomCode = hostPage.url().match(/\/room\/([A-Z]{4})/)?.[1]

      // Host joins
      await hostPage.getByPlaceholder(/name|nickname/i).fill('Host')
      await hostPage.getByRole('button', { name: /join|continue/i }).click()

      // Player joins
      await playerPage.goto(`/room/${roomCode}`)
      await playerPage.getByPlaceholder(/name|nickname/i).fill('Player1')
      await playerPage.getByRole('button', { name: /join|continue/i }).click()

      // Host starts Fake Facts
      const fakeFacts = hostPage.getByText(/fake facts/i)
      if (await fakeFacts.isVisible()) {
        await fakeFacts.click()
      }
      await hostPage.getByRole('button', { name: /start|begin|play/i }).click()

      // Both should see the question
      await expect(hostPage.getByText(/_____/)).toBeVisible({ timeout: 10000 })
      await expect(playerPage.getByText(/_____/)).toBeVisible({ timeout: 10000 })

      // Player selects an answer
      const playerAnswers = playerPage.getByRole('button').filter({ hasText: /^[A-E]\./ })
      await playerAnswers.first().click()

      // Should show selected state
      await expect(playerPage.getByText(/selected|submitted/i)).toBeVisible()

      // Host selects an answer
      const hostAnswers = hostPage.getByRole('button').filter({ hasText: /^[A-E]\./ })
      await hostAnswers.nth(1).click()

      // When all players have answered, should advance to results
      await expect(hostPage.getByText(/reveal|result|correct/i)).toBeVisible({ timeout: 15000 })
    } finally {
      await hostContext.close()
      await playerContext.close()
    }
  })

  test('should show jumbotron view', async ({ page }) => {
    // Create room
    await page.goto('/')
    await page.getByRole('button', { name: /create|start party/i }).click()
    await page.waitForURL(/\/room\/[A-Z]{4}/)

    const roomCode = page.url().match(/\/room\/([A-Z]{4})/)?.[1]

    // Navigate to jumbotron view
    await page.goto(`/jumbotron/${roomCode}`)

    // Should see the room code
    await expect(page.getByText(roomCode!)).toBeVisible()

    // Should see jumbotron-specific UI (larger text, no interaction buttons)
    // Jumbotron should not have join/answer buttons
    await expect(page.getByPlaceholder(/name|nickname/i)).not.toBeVisible()

    // Should show "Waiting for players" or similar
    await expect(page.getByText(/waiting|lobby|join/i)).toBeVisible()
  })

  test('should track player scores', async ({ browser }) => {
    const hostContext = await browser.newContext()
    const playerContext = await browser.newContext()

    const hostPage = await hostContext.newPage()
    const playerPage = await playerContext.newPage()

    try {
      // Setup: Create room with two players
      await hostPage.goto('/')
      await hostPage.getByRole('button', { name: /create|start party/i }).click()
      await hostPage.waitForURL(/\/room\/[A-Z]{4}/)
      const roomCode = hostPage.url().match(/\/room\/([A-Z]{4})/)?.[1]

      await hostPage.getByPlaceholder(/name|nickname/i).fill('ScoreHost')
      await hostPage.getByRole('button', { name: /join|continue/i }).click()

      await playerPage.goto(`/room/${roomCode}`)
      await playerPage.getByPlaceholder(/name|nickname/i).fill('ScorePlayer')
      await playerPage.getByRole('button', { name: /join|continue/i }).click()

      // Start game
      const fakeFacts = hostPage.getByText(/fake facts/i)
      if (await fakeFacts.isVisible()) {
        await fakeFacts.click()
      }
      await hostPage.getByRole('button', { name: /start|begin|play/i }).click()

      // Wait for question
      await expect(hostPage.getByText(/_____/)).toBeVisible({ timeout: 10000 })

      // Both players answer
      const playerAnswers = playerPage.getByRole('button').filter({ hasText: /^[A-E]\./ })
      await playerAnswers.first().click()

      const hostAnswers = hostPage.getByRole('button').filter({ hasText: /^[A-E]\./ })
      await hostAnswers.first().click()

      // After results, should see scores
      await expect(hostPage.getByText(/score|points/i)).toBeVisible({ timeout: 15000 })
    } finally {
      await hostContext.close()
      await playerContext.close()
    }
  })
})
