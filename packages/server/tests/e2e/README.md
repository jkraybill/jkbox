# E2E Tests for jkbox Server

Browser-based end-to-end tests using Playwright.

## Setup

Playwright and Chromium are already installed. If you need to reinstall browsers:

```bash
npx playwright install chromium
```

## Running Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run with UI mode (interactive)
npm run test:e2e:ui

# Run with debugger
npm run test:e2e:debug

# Run specific test file
npx playwright test lobby.spec.ts

# Run in headed mode (if display available)
npx playwright test --headed
```

## Test Coverage

### Lobby Tests (`lobby.spec.ts`)
- ✅ Create room and join as host
- ✅ Multiple players joining same room
- ✅ Player count display
- ✅ Room state persistence on page refresh

### Fake Facts Game Tests (`fake-facts-game.spec.ts`)
- ✅ Start game and show question
- ✅ Players submit answers
- ✅ Jumbotron view display
- ✅ Score tracking

## Architecture

Tests use Playwright's browser automation to:
1. Spin up the dev server automatically (`npm run dev`)
2. Open Chromium in headless mode
3. Simulate real user interactions (click, type, navigate)
4. Assert on visible elements and page state
5. Test WebSocket connectivity and real-time updates

## Adding New Tests

Create a new `.spec.ts` file in `tests/e2e/`:

```typescript
import { test, expect } from '@playwright/test'

test.describe('Feature Name', () => {
  test('should do something', async ({ page }) => {
    await page.goto('/')
    // Your test logic
  })
})
```

## Debugging

- **Screenshots**: Automatically captured on failure in `test-results/`
- **Traces**: View with `npx playwright show-trace trace.zip`
- **Debug mode**: Run with `npm run test:e2e:debug` to step through tests
- **Browser console**: Access via `page.on('console', msg => console.log(msg.text()))`

## CI/CD

Tests run in headless mode by default. Configure retries and parallelization in `playwright.config.ts`.

## Known Issues

- WSL2: Headed mode may not work without X server. Use `--headed` only if display configured.
- System dependencies: If tests fail with browser errors, run `sudo npx playwright install-deps`
