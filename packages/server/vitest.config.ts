import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/e2e/**', // Exclude Playwright E2E tests (run separately with npm run test:e2e)
      '**/.{idea,git,cache,output,temp}/**',
    ],
  }
})
