/**
 * auth.setup.ts
 *
 * Logs in once as leader or member (depending on the project that triggers this)
 * and saves the browser storage state so all other tests can reuse the session.
 *
 * Run automatically by `playwright.config.ts` via `dependencies`.
 */
import { test as setup, expect } from '@playwright/test';
import path from 'path';

const LEADER_AUTH_FILE = path.join(__dirname, '.auth/leader.json');
const MEMBER_AUTH_FILE = path.join(__dirname, '.auth/member.json');

/** Log in and persist session to storageState file. */
async function loginAndSave(
  page: import('@playwright/test').Page,
  email: string,
  password: string,
  authFile: string
) {
  await page.goto('/login');
  await expect(page).toHaveURL(/\/login/);

  await page.getByLabel('メールアドレス').fill(email);
  await page.getByLabel('パスワード').fill(password);
  await page.getByRole('button', { name: 'ログイン' }).click();

  // Wait until redirected away from /login
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });

  await page.context().storageState({ path: authFile });
}

// ── Leader setup ─────────────────────────────────────────────────────────────
setup('leader login', async ({ page }) => {
  const email = process.env.TEST_LEADER_EMAIL;
  const password = process.env.TEST_LEADER_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'TEST_LEADER_EMAIL and TEST_LEADER_PASSWORD must be set. Copy e2e/.env.example to .env.test.local'
    );
  }

  await loginAndSave(page, email, password, LEADER_AUTH_FILE);
});

// ── Member setup ─────────────────────────────────────────────────────────────
setup('member login', async ({ page }) => {
  const email = process.env.TEST_MEMBER_EMAIL;
  const password = process.env.TEST_MEMBER_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'TEST_MEMBER_EMAIL and TEST_MEMBER_PASSWORD must be set. Copy e2e/.env.example to .env.test.local'
    );
  }

  await loginAndSave(page, email, password, MEMBER_AUTH_FILE);
});
