/**
 * memos.spec.ts
 *
 * Tests the memos (メモ) page for leader and member roles.
 * Covers: desktop + mobile, leader + member
 */
import { test, expect } from '@playwright/test';

test.describe('メモページ', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/memos');
  });

  test('ページタイトル「メモ」が表示される', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'メモ' })).toBeVisible();
  });

  test('読み込み後、メモリストまたは空のステートが表示される', async ({ page }) => {
    await expect(page.locator('.animate-pulse').first()).not.toBeVisible({ timeout: 15_000 });

    const memoItems = page.locator('li').filter({ hasText: /ページ/ });
    const emptyState = page.getByText('メモがありません');

    await expect(memoItems.first().or(emptyState)).toBeVisible({ timeout: 10_000 });
  });

  test('メモがある場合、削除ボタンが存在する', async ({ page }) => {
    await expect(page.locator('.animate-pulse').first()).not.toBeVisible({ timeout: 15_000 });
    const emptyState = page.getByText('メモがありません');
    if (await emptyState.isVisible()) {
      test.skip();
    }
    await expect(page.getByRole('button', { name: '削除' }).first()).toBeVisible();
  });

  test('メモをクリックするとビューワーに遷移する', async ({ page }) => {
    await expect(page.locator('.animate-pulse').first()).not.toBeVisible({ timeout: 15_000 });
    const emptyState = page.getByText('メモがありません');
    if (await emptyState.isVisible()) {
      test.skip();
    }

    const memoLink = page.locator('a[href*="/books/"][href*="page="]').first();
    await memoLink.click();
    await expect(page).toHaveURL(/\/books\/.*page=/, { timeout: 10_000 });
  });

  test('空のステートに「本を見る」リンクが表示される', async ({ page }) => {
    await expect(page.locator('.animate-pulse').first()).not.toBeVisible({ timeout: 15_000 });
    const emptyState = page.getByText('メモがありません');
    if (!await emptyState.isVisible()) {
      test.skip();
    }
    await expect(page.getByRole('link', { name: '本を見る' })).toBeVisible();
  });
});
