/**
 * navigation.spec.ts
 *
 * Tests navigation bar and menu behavior across roles and screen sizes.
 * Covers: desktop (leader/member) + mobile (leader/member)
 */
import { test, expect } from '@playwright/test';
import { isLeaderProject, isMemberProject, isMobileProject } from './helpers/role';

test.describe('ナビゲーション', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  // ── Desktop nav ────────────────────────────────────────────────────
  test('デスクトップ: 基本ナビリンクが表示される', async ({ page, isMobile }) => {
    test.skip(!!isMobile, 'モバイルテストは別途');
    const nav = page.locator('header nav').first();
    await expect(nav.getByRole('link', { name: '本一覧' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'しおり' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'メモ' })).toBeVisible();
    await expect(nav.getByRole('link', { name: '達成率' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'プロフィール' })).toBeVisible();
  });

  test('デスクトップ: 隊長のみダッシュボードと管理リンクが表示される', async ({
    page,
    isMobile,
  }, testInfo) => {
    test.skip(!!isMobile, 'モバイルテストは別途');
    const nav = page.locator('header nav').first();
    if (isLeaderProject(testInfo)) {
      await expect(nav.getByRole('link', { name: 'ダッシュボード' })).toBeVisible();
      await expect(nav.getByRole('link', { name: '管理' })).toBeVisible();
    } else {
      await expect(nav.getByRole('link', { name: 'ダッシュボード' })).not.toBeVisible();
      await expect(nav.getByRole('link', { name: '管理' })).not.toBeVisible();
    }
  });

  // ── Mobile hamburger menu ──────────────────────────────────────────
  test('モバイル: ハンバーガーメニューボタンが表示される', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'デスクトップテストは別途');
    const hamburger = page.getByRole('button', { name: 'メニューを開く' });
    await expect(hamburger).toBeVisible();
  });

  test('モバイル: ハンバーガーボタンをタップするとメニューが開く', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'デスクトップテストは別途');
    const hamburger = page.getByRole('button', { name: 'メニューを開く' });
    await hamburger.click();
    // Mobile menu should now show nav links
    const mobileMenu = page.locator('header .md\\:hidden').last();
    await expect(mobileMenu.getByRole('link', { name: '本一覧' })).toBeVisible();
    await expect(mobileMenu.getByRole('link', { name: 'しおり' })).toBeVisible();
  });

  test('モバイル: メニューを開いて閉じられる（×ボタン）', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'デスクトップテストは別途');
    const hamburger = page.getByRole('button', { name: 'メニューを開く' });
    await hamburger.click();
    // The button now shows close icon; click again to close
    await hamburger.click();
    // Mobile nav links should no longer be visible
    const mobileMenu = page.locator('header .md\\:hidden').last();
    await expect(mobileMenu).not.toBeVisible();
  });

  test('モバイル: メニューのリンクをタップするとメニューが閉じる', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'デスクトップテストは別途');
    const hamburger = page.getByRole('button', { name: 'メニューを開く' });
    await hamburger.click();
    const mobileMenu = page.locator('header .md\\:hidden').last();
    await mobileMenu.getByRole('link', { name: 'しおり' }).click();
    await expect(page).toHaveURL('/bookmarks');
    // Menu should close after navigation
    await expect(mobileMenu).not.toBeVisible();
  });

  // ── Nav link routing ───────────────────────────────────────────────
  test('「しおり」リンクでしおりページに遷移する', async ({ page, isMobile }) => {
    if (isMobile) {
      await page.getByRole('button', { name: 'メニューを開く' }).click();
      await page.locator('header .md\\:hidden').last().getByRole('link', { name: 'しおり' }).click();
    } else {
      await page.locator('header nav').first().getByRole('link', { name: 'しおり' }).click();
    }
    await expect(page).toHaveURL('/bookmarks');
    await expect(page.getByRole('heading', { name: 'しおり' })).toBeVisible();
  });

  test('「メモ」リンクでメモページに遷移する', async ({ page, isMobile }) => {
    if (isMobile) {
      await page.getByRole('button', { name: 'メニューを開く' }).click();
      await page.locator('header .md\\:hidden').last().getByRole('link', { name: 'メモ' }).click();
    } else {
      await page.locator('header nav').first().getByRole('link', { name: 'メモ' }).click();
    }
    await expect(page).toHaveURL('/memos');
    await expect(page.getByRole('heading', { name: 'メモ' })).toBeVisible();
  });

  test('「達成率」リンクで達成率ページに遷移する', async ({ page, isMobile }) => {
    if (isMobile) {
      await page.getByRole('button', { name: 'メニューを開く' }).click();
      await page.locator('header .md\\:hidden').last().getByRole('link', { name: '達成率' }).click();
    } else {
      await page.locator('header nav').first().getByRole('link', { name: '達成率' }).click();
    }
    await expect(page).toHaveURL('/progress');
  });

  test('「プロフィール」リンクでプロフィールページに遷移する', async ({ page, isMobile }) => {
    if (isMobile) {
      await page.getByRole('button', { name: 'メニューを開く' }).click();
      await page.locator('header .md\\:hidden').last().getByRole('link', { name: 'プロフィール' }).click();
    } else {
      await page.locator('header nav').first().getByRole('link', { name: 'プロフィール' }).click();
    }
    await expect(page).toHaveURL('/profile');
    await expect(page.getByRole('heading', { name: 'プロフィール' })).toBeVisible();
  });
});
