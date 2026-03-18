/**
 * bookmarks.spec.ts
 *
 * Tests the bookmarks (しおり) page for leader and member roles.
 * Covers: desktop + mobile, leader + member
 */
import { test, expect } from '@playwright/test';

test.describe('しおりページ', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/bookmarks');
  });

  test('ページタイトル「しおり」が表示される', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'しおり' })).toBeVisible();
  });

  test('読み込み後、しおりリストまたは空のステートが表示される', async ({ page }) => {
    // Wait for skeleton to disappear
    await expect(page.locator('.animate-pulse').first()).not.toBeVisible({ timeout: 15_000 });

    const bookmarkItems = page.locator('li').filter({ hasText: /ページ/ });
    const emptyState = page.getByText('しおりがありません');

    await expect(bookmarkItems.first().or(emptyState)).toBeVisible({ timeout: 10_000 });
  });

  test('しおりがある場合、共有ボタンが存在する', async ({ page }) => {
    await expect(page.locator('.animate-pulse').first()).not.toBeVisible({ timeout: 15_000 });
    const shareButton = page.getByRole('button', { name: /共有|URLをコピー/ }).first();
    const emptyState = page.getByText('しおりがありません');

    // Only check share button if bookmarks exist
    if (await emptyState.isVisible()) {
      test.skip();
    }
    await expect(shareButton).toBeVisible();
  });

  test('しおりがある場合、削除ボタンが存在する', async ({ page }) => {
    await expect(page.locator('.animate-pulse').first()).not.toBeVisible({ timeout: 15_000 });
    const deleteButton = page.getByRole('button', { name: '削除' }).first();
    const emptyState = page.getByText('しおりがありません');

    if (await emptyState.isVisible()) {
      test.skip();
    }
    await expect(deleteButton).toBeVisible();
  });

  test('しおりをクリックするとビューワーに遷移する', async ({ page }) => {
    await expect(page.locator('.animate-pulse').first()).not.toBeVisible({ timeout: 15_000 });
    const emptyState = page.getByText('しおりがありません');
    if (await emptyState.isVisible()) {
      test.skip();
    }

    const bookmarkLink = page.locator('a[href*="/books/"][href*="page="]').first();
    await bookmarkLink.click();
    await expect(page).toHaveURL(/\/books\/.*page=/, { timeout: 10_000 });
  });

  test('空のステートに「本を見る」ボタンが表示される', async ({ page }) => {
    await expect(page.locator('.animate-pulse').first()).not.toBeVisible({ timeout: 15_000 });
    const emptyState = page.getByText('しおりがありません');
    if (!await emptyState.isVisible()) {
      test.skip(); // Has bookmarks, skip
    }
    await expect(page.getByRole('link', { name: '本を見る' })).toBeVisible();
  });
});
