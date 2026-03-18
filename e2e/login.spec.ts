/**
 * login.spec.ts
 *
 * Tests the login page UI and behavior:
 * - Both leader and member can reach the app after login (handled via storageState)
 * - Login page redirects authenticated users
 * - Error messages display correctly
 *
 * Covers: desktop + mobile, leader + member
 */
import { test, expect } from '@playwright/test';

test.describe('ログインページ', () => {
  // Already logged-in users should be redirected away from /login
  test('ログイン済みの場合、/login にアクセスすると本一覧にリダイレクトされる', async ({ page }) => {
    await page.goto('/login');
    // Should redirect to home page (logged in via storageState)
    await expect(page).toHaveURL('/', { timeout: 10_000 });
  });

  // Test that the home page (book list) is reachable
  test('ホームページ（本一覧）が表示される', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: '本一覧' })).toBeVisible();
  });
});

test.describe('ログインページ（未認証）', () => {
  // Test the login form itself without any saved auth state
  test.use({ storageState: { cookies: [], origins: [] } });

  test('ログインフォームが表示される', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'ScoutBooks' })).toBeVisible();
    await expect(page.getByLabel('メールアドレス')).toBeVisible();
    await expect(page.getByLabel('パスワード')).toBeVisible();
    await expect(page.getByRole('button', { name: 'ログイン' })).toBeVisible();
  });

  test('無効な認証情報でエラーメッセージが表示される', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('メールアドレス').fill('invalid@example.com');
    await page.getByLabel('パスワード').fill('wrongpassword');
    await page.getByRole('button', { name: 'ログイン' }).click();
    // Error message should appear
    await expect(page.locator('.text-red-700')).toBeVisible({ timeout: 10_000 });
  });

  test('未認証で保護ページにアクセスするとログインページにリダイレクトされる', async ({ page }) => {
    await page.goto('/bookmarks');
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});
