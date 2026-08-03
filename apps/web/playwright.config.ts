import { defineConfig, devices } from '@playwright/test';

/**
 * Part 21: "Test mobile responsiveness and accessibility." Runs against a
 * real dev server (started automatically) with a real backend/Supabase
 * project behind it - this is a live-stack check, not a component-isolated
 * one, so it's a separate `npm run test:e2e` rather than part of the fast
 * `npm test` (which never touches a browser or a real database).
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // Chromium-based mobile emulation (not WebKit's 'iPhone 13' preset) so this suite only
      // ever needs the one browser engine already installed - the CSS responsive behavior
      // under test doesn't depend on the rendering engine, just the viewport.
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 30000,
  },
});
