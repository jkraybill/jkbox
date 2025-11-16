import { test, expect } from '@playwright/test'

test.describe('Lobby Flow', () => {
  test('should create a room and join as host', async ({ page }) => {
    // Navigate to the app
    await page.goto('/')

    // Should see the main page/join room interface
    await expect(page).toHaveTitle(/jkbox/i)

    // Create a new room (look for "Create Room" or "Start Party" button)
    const createButton = page.getByRole('button', { name: /create|start party/i })
    await expect(createButton).toBeVisible()
    await createButton.click()

    // Should navigate to lobby with a room code
    await expect(page).toHaveURL(/\/room\/[A-Z]{4}/)

    // Extract room code from URL
    const url = page.url()
    const roomCode = url.match(/\/room\/([A-Z]{4})/)?.[1]
    expect(roomCode).toBeTruthy()
    expect(roomCode).toHaveLength(4)

    // Should see room code displayed
    await expect(page.getByText(roomCode!)).toBeVisible()

    // Should see player name input or nickname prompt
    const nicknameInput = page.getByPlaceholder(/name|nickname/i)
    await expect(nicknameInput).toBeVisible()

    // Enter nickname and join
    await nicknameInput.fill('TestHost')
    const joinButton = page.getByRole('button', { name: /join|continue/i })
    await joinButton.click()

    // Should see the lobby with host player
    await expect(page.getByText('TestHost')).toBeVisible()

    // Should see host indicator (crown, badge, or "Host" label)
    await expect(page.getByText(/host/i)).toBeVisible()

    // Should see game selection or start button
    const startButton = page.getByRole('button', { name: /start|begin|play/i })
    await expect(startButton).toBeVisible()
  })

  test('should allow multiple players to join the same room', async ({ browser }) => {
    // Create two browser contexts (simulating two different players)
    const hostContext = await browser.newContext()
    const guestContext = await browser.newContext()

    const hostPage = await hostContext.newPage()
    const guestPage = await guestContext.newPage()

    try {
      // Host creates room
      await hostPage.goto('/')
      const createButton = hostPage.getByRole('button', { name: /create|start party/i })
      await createButton.click()

      // Get room code
      await hostPage.waitForURL(/\/room\/[A-Z]{4}/)
      const roomCode = hostPage.url().match(/\/room\/([A-Z]{4})/)?.[1]
      expect(roomCode).toBeTruthy()

      // Host joins
      await hostPage.getByPlaceholder(/name|nickname/i).fill('Alice')
      await hostPage.getByRole('button', { name: /join|continue/i }).click()
      await expect(hostPage.getByText('Alice')).toBeVisible()

      // Guest navigates to same room
      await guestPage.goto(`/room/${roomCode}`)

      // Guest enters nickname
      await guestPage.getByPlaceholder(/name|nickname/i).fill('Bob')
      await guestPage.getByRole('button', { name: /join|continue/i }).click()

      // Both pages should show both players
      await expect(hostPage.getByText('Bob')).toBeVisible()
      await expect(guestPage.getByText('Alice')).toBeVisible()
      await expect(guestPage.getByText('Bob')).toBeVisible()

      // Host should still be marked as host
      await expect(hostPage.getByText(/host/i)).toBeVisible()
    } finally {
      await hostContext.close()
      await guestContext.close()
    }
  })

  test('should show player count in lobby', async ({ page }) => {
    // Create room and join
    await page.goto('/')
    await page.getByRole('button', { name: /create|start party/i }).click()
    await page.waitForURL(/\/room\/[A-Z]{4}/)

    await page.getByPlaceholder(/name|nickname/i).fill('TestPlayer')
    await page.getByRole('button', { name: /join|continue/i }).click()

    // Should show 1 player
    await expect(page.getByText(/1.*player/i)).toBeVisible()
  })

  test('should persist room state on page refresh', async ({ page }) => {
    // Create room and join
    await page.goto('/')
    await page.getByRole('button', { name: /create|start party/i }).click()
    await page.waitForURL(/\/room\/[A-Z]{4}/)

    const roomCode = page.url().match(/\/room\/([A-Z]{4})/)?.[1]

    await page.getByPlaceholder(/name|nickname/i).fill('PersistentPlayer')
    await page.getByRole('button', { name: /join|continue/i }).click()
    await expect(page.getByText('PersistentPlayer')).toBeVisible()

    // Refresh the page
    await page.reload()

    // Should still see the room and player
    await expect(page.getByText(roomCode!)).toBeVisible()
    await expect(page.getByText('PersistentPlayer')).toBeVisible()
  })
})
