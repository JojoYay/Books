/**
 * home.spec.ts
 *
 * Tests the home page (本一覧) for both leader and member roles.
 * Covers: desktop + mobile, leader + member
 */
import { test, expect } from '@playwright/test';
import { isLeaderProject } from './helpers/role';

test.describe('本一覧ページ', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('ページタイトルが表示される', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '本一覧' })).toBeVisible();
  });

  test('隊長には「本を追加」ボタンが表示され、隊員には表示されない', async ({ page }, testInfo) => {
    const addButton = page.getByRole('link', { name: '本を追加' });
    if (isLeaderProject(testInfo)) {
      await expect(addButton).toBeVisible();
    } else {
      await expect(addButton).not.toBeVisible();
    }
  });

  test('本がある場合、本のカードが表示される（またはスケルトン→カード）', async ({ page }) => {
    // Wait for loading to complete (skeleton disappears)
    await expect(page.locator('.animate-pulse').first()).not.toBeVisible({ timeout: 15_000 });
    // Either book cards or empty state should be present
    const bookCards = page.locator('a[href^="/books/"]');
    const emptyState = page.getByText('本がまだ割り当てられていません');
    await expect(bookCards.first().or(emptyState)).toBeVisible({ timeout: 10_000 });
  });

  test('本のカードをクリックするとビューワーに遷移する', async ({ page }) => {
    // Wait for loading to finish
    await expect(page.locator('.animate-pulse').first()).not.toBeVisible({ timeout: 15_000 });
    const bookCard = page.locator('a[href^="/books/"]').first();
    const count = await bookCard.count();
    if (count === 0) {
      test.skip(); // No books assigned, skip
    }
    const href = await bookCard.getAttribute('href');
    await bookCard.click();
    await expect(page).toHaveURL(href ?? /\/books\//, { timeout: 10_000 });
  });

  test('隊長のとき：本一覧に集計中バッジが表示されない', async ({ page }, testInfo) => {
    test.skip(!isLeaderProject(testInfo), '隊長のみのテスト');
    await expect(page.locator('.animate-pulse').first()).not.toBeVisible({ timeout: 15_000 });
    const badge = page.getByText('集計中');
    await expect(badge).not.toBeVisible();
  });

  test('隊長: 「本を追加」ボタンで管理ページに遷移する', async ({ page }, testInfo) => {
    test.skip(!isLeaderProject(testInfo), '隊長のみのテスト');
    await page.getByRole('link', { name: '本を追加' }).click();
    await expect(page).toHaveURL('/admin/books');
  });
});
