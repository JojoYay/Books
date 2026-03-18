/**
 * progress.spec.ts
 *
 * Tests the 達成率 (progress) page for both leader and member.
 * Covers: desktop + mobile, leader + member
 */
import { test, expect } from '@playwright/test';

test.describe('達成率ページ', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/progress');
  });

  test('ページが表示される', async ({ page }) => {
    // Wait for content to load
    await expect(page.locator('.animate-spin, .animate-pulse').first()).not.toBeVisible({ timeout: 15_000 });
    // The page should render without crashing
    await expect(page.locator('main')).toBeVisible();
  });

  test('進捗コンテンツまたは空のステートが表示される', async ({ page }) => {
    await expect(page.locator('.animate-spin, .animate-pulse').first()).not.toBeVisible({ timeout: 15_000 });
    // Either progress data or empty state
    const hasContent = await page.locator('main').textContent();
    expect(hasContent).toBeTruthy();
  });
});
