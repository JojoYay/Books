import { defineConfig, devices } from '@playwright/test';
import { config as loadDotenv } from 'dotenv';

// Load test credentials from .env.test.local if it exists
loadDotenv({ path: '.env.test.local', override: true });

/**
 * ScoutBooks Playwright E2E Test Configuration
 *
 * Tests run against the local dev server.
 * Set TEST_LEADER_EMAIL, TEST_LEADER_PASSWORD, TEST_MEMBER_EMAIL, TEST_MEMBER_PASSWORD
 * in your .env.test.local file (or environment) before running.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // Firebase rate-limit safety
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1, // Sequential to avoid auth conflicts
  reporter: [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
  },

  projects: [
    // ── Desktop: Leader ──────────────────────────────────────────────
    {
      name: 'desktop-leader',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/leader.json',
      },
      dependencies: ['setup-leader'],
      testMatch: /.*\.spec\.ts/,
    },

    // ── Desktop: Member ──────────────────────────────────────────────
    {
      name: 'desktop-member',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/member.json',
      },
      dependencies: ['setup-member'],
      testMatch: /.*\.spec\.ts/,
    },

    // ── Mobile: Leader ───────────────────────────────────────────────
    {
      name: 'mobile-leader',
      use: {
        ...devices['iPhone 14'],
        storageState: 'e2e/.auth/leader.json',
      },
      dependencies: ['setup-leader'],
      testMatch: /.*\.spec\.ts/,
    },

    // ── Mobile: Member ───────────────────────────────────────────────
    {
      name: 'mobile-member',
      use: {
        ...devices['iPhone 14'],
        storageState: 'e2e/.auth/member.json',
      },
      dependencies: ['setup-member'],
      testMatch: /.*\.spec\.ts/,
    },

    // ── Auth Setup (not real tests, just login once and save state) ───
    {
      name: 'setup-leader',
      testMatch: /auth\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'setup-member',
      testMatch: /auth\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
