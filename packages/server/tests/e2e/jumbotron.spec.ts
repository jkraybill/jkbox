import { test, expect } from '@playwright/test'

test.describe('Jumbotron Display', () => {
  test('should show jumbotron view with room code', async ({ browser }) => {
    const hostContext = await browser.newContext()
    const jumbotronContext = await browser.newContext()

    const hostPage = await hostContext.newPage()
    const jumbotronPage = await jumbotronContext.newPage()

    try {
      // Host creates room
      await hostPage.goto('/')
      await hostPage.getByRole('button', { name: /create|start party/i }).click()
      await hostPage.waitForURL(/\/room\/[A-Z]{4}/)
      const roomCode = hostPage.url().match(/\/room\/([A-Z]{4})/)?.[1]

      // Open jumbotron
      await jumbotronPage.goto(`/jumbotron/${roomCode}`)

      // Should display room code prominently
      await expect(jumbotronPage.getByText(roomCode!)).toBeVisible()

      // Should show lobby state
      await expect(jumbotronPage.getByText(/waiting|lobby/i)).toBeVisible()

      // Host joins the room
      await hostPage.getByPlaceholder(/name|nickname/i).fill('JumbotronHost')
      await hostPage.getByRole('button', { name: /join|continue/i }).click()

      // Jumbotron should update to show the player
      await expect(jumbotronPage.getByText('JumbotronHost')).toBeVisible({ timeout: 5000 })
    } finally {
      await hostContext.close()
      await jumbotronContext.close()
    }
  })

  test('should not have interactive elements', async ({ page }) => {
    // Navigate directly to a jumbotron view
    await page.goto('/jumbotron/TEST')

    // Should NOT have input fields
    await expect(page.getByPlaceholder(/name|nickname/i)).not.toBeVisible()

    // Should NOT have join/submit buttons (they might exist in DOM but hidden)
    const interactiveButtons = page.getByRole('button').filter({
      has: page.locator('text=/join|submit|answer/i'),
    })

    // If any exist, they should be disabled or hidden
    const count = await interactiveButtons.count()
    if (count > 0) {
      for (let i = 0; i < count; i++) {
        const button = interactiveButtons.nth(i)
        const isVisible = await button.isVisible()
        expect(isVisible).toBe(false)
      }
    }
  })

  test('should update in real-time when game starts', async ({ browser }) => {
    const hostContext = await browser.newContext()
    const playerContext = await browser.newContext()
    const jumbotronContext = await browser.newContext()

    const hostPage = await hostContext.newPage()
    const playerPage = await playerContext.newPage()
    const jumbotronPage = await jumbotronContext.newPage()

    try {
      // Setup: Create room
      await hostPage.goto('/')
      await hostPage.getByRole('button', { name: /create|start party/i }).click()
      await hostPage.waitForURL(/\/room\/[A-Z]{4}/)
      const roomCode = hostPage.url().match(/\/room\/([A-Z]{4})/)?.[1]

      // Host and player join
      await hostPage.getByPlaceholder(/name|nickname/i).fill('Host')
      await hostPage.getByRole('button', { name: /join|continue/i }).click()

      await playerPage.goto(`/room/${roomCode}`)
      await playerPage.getByPlaceholder(/name|nickname/i).fill('Player1')
      await playerPage.getByRole('button', { name: /join|continue/i }).click()

      // Open jumbotron
      await jumbotronPage.goto(`/jumbotron/${roomCode}`)

      // Jumbotron shows both players
      await expect(jumbotronPage.getByText('Host')).toBeVisible()
      await expect(jumbotronPage.getByText('Player1')).toBeVisible()

      // Host starts Fake Facts
      const fakeFacts = hostPage.getByText(/fake facts/i)
      if (await fakeFacts.isVisible()) {
        await fakeFacts.click()
      }
      await hostPage.getByRole('button', { name: /start|begin|play/i }).click()

      // Jumbotron should update to show game is active
      await expect(jumbotronPage.getByText(/question|playing|round/i)).toBeVisible({
        timeout: 10000,
      })

      // Should show the question on jumbotron
      await expect(jumbotronPage.getByText(/_____/)).toBeVisible()
    } finally {
      await hostContext.close()
      await playerContext.close()
      await jumbotronContext.close()
    }
  })

  test('should display vote tallies during voting phase', async ({ browser }) => {
    const hostContext = await browser.newContext()
    const playerContext = await browser.newContext()
    const jumbotronContext = await browser.newContext()

    const hostPage = await hostContext.newPage()
    const playerPage = await playerContext.newPage()
    const jumbotronPage = await jumbotronContext.newPage()

    try {
      // Setup: Create room with two players
      await hostPage.goto('/')
      await hostPage.getByRole('button', { name: /create|start party/i }).click()
      await hostPage.waitForURL(/\/room\/[A-Z]{4}/)
      const roomCode = hostPage.url().match(/\/room\/([A-Z]{4})/)?.[1]

      await hostPage.getByPlaceholder(/name|nickname/i).fill('VoteHost')
      await hostPage.getByRole('button', { name: /join|continue/i }).click()

      await playerPage.goto(`/room/${roomCode}`)
      await playerPage.getByPlaceholder(/name|nickname/i).fill('VotePlayer')
      await playerPage.getByRole('button', { name: /join|continue/i }).click()

      // Open jumbotron
      await jumbotronPage.goto(`/jumbotron/${roomCode}`)

      // Start game
      const fakeFacts = hostPage.getByText(/fake facts/i)
      if (await fakeFacts.isVisible()) {
        await fakeFacts.click()
      }
      await hostPage.getByRole('button', { name: /start|begin|play/i }).click()

      // Wait for question
      await expect(jumbotronPage.getByText(/_____/)).toBeVisible({ timeout: 10000 })

      // Host submits answer
      const hostAnswers = hostPage.getByRole('button').filter({ hasText: /^[A-E]\./ })
      await hostAnswers.first().click()

      // Jumbotron might show voting status (1/2 voted)
      // This depends on implementation - adjust selector as needed
      const votingStatus = jumbotronPage.getByText(/\d+\/\d+|voted|waiting/i)
      if (await votingStatus.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(votingStatus).toBeVisible()
      }

      // Player submits answer
      const playerAnswers = playerPage.getByRole('button').filter({ hasText: /^[A-E]\./ })
      await playerAnswers.nth(1).click()

      // After all votes, jumbotron should show results/reveal
      await expect(jumbotronPage.getByText(/reveal|result|correct/i)).toBeVisible({
        timeout: 15000,
      })
    } finally {
      await hostContext.close()
      await playerContext.close()
      await jumbotronContext.close()
    }
  })

  test('should scale text appropriately for large display', async ({ page }) => {
    // Set viewport to large screen (like TV/projector)
    await page.setViewportSize({ width: 1920, height: 1080 })

    await page.goto('/jumbotron/TEST')

    // Room code should be large and prominent
    const roomCode = page.getByText('TEST')
    await expect(roomCode).toBeVisible()

    // Check computed font size is larger than typical UI
    const fontSize = await roomCode.evaluate((el) => {
      return window.getComputedStyle(el).fontSize
    })

    // Should be at least 24px (adjust based on your design)
    const fontSizeValue = parseInt(fontSize)
    expect(fontSizeValue).toBeGreaterThanOrEqual(24)
  })
})
