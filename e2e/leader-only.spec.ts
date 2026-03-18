/**
 * leader-only.spec.ts
 *
 * Tests pages and features exclusive to the leader role:
 *   - Dashboard (/dashboard)
 *   - Admin books page (/admin/books)
 *   - Admin members page (/admin/members)
 *   - Admin settings page (/admin/settings)
 *
 * Member projects skip these tests automatically.
 */
import { test, expect } from '@playwright/test';
import { isLeaderProject } from './helpers/role';

test.describe('隊長専用ページ', () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(!isLeaderProject(testInfo), '隊長のみのテスト');
  });

  // ── Dashboard ──────────────────────────────────────────────────────
  test.describe('ダッシュボード', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/dashboard');
    });

    test('ダッシュボードページが表示される', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'ダッシュボード' })).toBeVisible();
    });

    test('サマリーカードが4つ表示される', async ({ page }) => {
      await expect(page.locator('.animate-spin').first()).not.toBeVisible({ timeout: 15_000 });
      const cards = page.locator('[class*="rounded-xl"][class*="text-center"]').filter({ hasText: /隊員数|本の数|総課題数|全体達成率/ });
      await expect(cards).toHaveCount(4);
    });

    test('隊員別進捗テーブルまたは「隊員がいません」が表示される', async ({ page }) => {
      await expect(page.locator('.animate-spin').first()).not.toBeVisible({ timeout: 15_000 });
      const heading = page.getByText('隊員別進捗');
      const empty = page.getByText('隊員がいません');
      await expect(heading.or(empty)).toBeVisible({ timeout: 10_000 });
    });

    test('隊員行をクリックすると詳細が展開される', async ({ page }) => {
      await expect(page.locator('.animate-spin').first()).not.toBeVisible({ timeout: 15_000 });
      // Check if there are member rows (desktop)
      const memberRow = page.locator('table tbody tr').first();
      if (await memberRow.count() === 0) {
        test.skip();
      }
      await memberRow.click();
      // Expanded row should appear
      const expandedRow = page.locator('table tbody tr').nth(1);
      await expect(expandedRow).toBeVisible({ timeout: 5_000 });
    });
  });

  // ── Admin books ────────────────────────────────────────────────────
  test.describe('管理：本の管理', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/admin/books');
    });

    test('本の管理ページが表示される', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /本の管理|本を管理/ })).toBeVisible({ timeout: 10_000 });
    });

    test('「新しい本を追加」ボタンが存在する', async ({ page }) => {
      const addBtn = page.getByRole('link', { name: /本を追加|新しい本/ });
      await expect(addBtn).toBeVisible();
    });

    test('本のリストまたは空のステートが表示される', async ({ page }) => {
      await expect(page.locator('.animate-pulse, .animate-spin').first()).not.toBeVisible({ timeout: 15_000 });
      const bookList = page.locator('a[href*="/admin/books/"]');
      const emptyText = page.getByText(/本がありません|まだ本がない/);
      await expect(bookList.first().or(emptyText)).toBeVisible({ timeout: 10_000 });
    });
  });

  // ── Admin members ──────────────────────────────────────────────────
  test.describe('管理：隊員管理', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/admin/members');
    });

    test('隊員管理ページが表示される', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /隊員/ })).toBeVisible({ timeout: 10_000 });
    });

    test('隊員一覧または空のステートが表示される', async ({ page }) => {
      await expect(page.locator('.animate-pulse, .animate-spin').first()).not.toBeVisible({ timeout: 15_000 });
      const memberItems = page.locator('[class*="rounded"]').filter({ hasText: /@/ }); // email addresses
      const emptyText = page.getByText(/隊員がいません|まだ隊員がいない/);
      await expect(memberItems.first().or(emptyText)).toBeVisible({ timeout: 10_000 });
    });
  });

  // ── Admin settings ─────────────────────────────────────────────────
  test.describe('管理：設定', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/admin/settings');
    });

    test('設定ページが表示される', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /設定/ })).toBeVisible({ timeout: 10_000 });
    });

    test('保護者PINフィールドが表示される', async ({ page }) => {
      await expect(page.locator('.animate-spin').first()).not.toBeVisible({ timeout: 10_000 });
      // Settings page has parent PIN
      const pinField = page.getByLabel(/PIN|ピン/).or(page.getByPlaceholder(/PIN|数字/));
      await expect(pinField).toBeVisible();
    });
  });
});

// ── Member access guard ────────────────────────────────────────────────
test.describe('隊員は隊長専用ページにアクセスできない', () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(isLeaderProject(testInfo), '隊員のみのテスト');
  });

  test('隊員が/dashboardにアクセスするとリダイレクトされる', async ({ page }) => {
    await page.goto('/dashboard');
    // Should redirect to / (home)
    await expect(page).toHaveURL('/', { timeout: 10_000 });
  });
});
