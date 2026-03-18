/**
 * profile.spec.ts
 *
 * Tests the profile page for leader and member roles.
 * Covers: desktop + mobile, leader + member
 */
import { test, expect } from '@playwright/test';

test.describe('プロフィールページ', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/profile');
  });

  test('ページタイトル「プロフィール」が表示される', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'プロフィール' })).toBeVisible();
  });

  test('アバター画像エリアが表示される', async ({ page }) => {
    // Loading state guard
    await expect(page.locator('.animate-spin').first()).not.toBeVisible({ timeout: 10_000 });
    const avatarButton = page.getByRole('button', { name: '写真を変更' });
    await expect(avatarButton).toBeVisible();
  });

  test('名前入力フィールドが表示される', async ({ page }) => {
    await expect(page.locator('.animate-spin').first()).not.toBeVisible({ timeout: 10_000 });
    await expect(page.getByLabel('名前')).toBeVisible();
  });

  test('役割（読み取り専用）が表示される', async ({ page }) => {
    await expect(page.locator('.animate-spin').first()).not.toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('役割')).toBeVisible();
  });

  test('ひとこと入力フィールドが表示される（50文字以内）', async ({ page }) => {
    await expect(page.locator('.animate-spin').first()).not.toBeVisible({ timeout: 10_000 });
    const taglineInput = page.getByLabel(/ひとこと/);
    await expect(taglineInput).toBeVisible();
    await expect(taglineInput).toHaveAttribute('maxlength', '50');
  });

  test('自己紹介テキストエリアが表示される', async ({ page }) => {
    await expect(page.locator('.animate-spin').first()).not.toBeVisible({ timeout: 10_000 });
    await expect(page.getByLabel('自己紹介')).toBeVisible();
  });

  test('「保存する」ボタンが表示される', async ({ page }) => {
    await expect(page.locator('.animate-spin').first()).not.toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: '保存する' })).toBeVisible();
  });

  test('パスワード変更セクションが表示される', async ({ page }) => {
    await expect(page.locator('.animate-spin').first()).not.toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('heading', { name: 'パスワードを変更' })).toBeVisible();
    await expect(page.getByLabel('現在のパスワード')).toBeVisible();
    await expect(page.getByLabel('新しいパスワード', { exact: true })).toBeVisible();
    await expect(page.getByLabel('新しいパスワード（確認）')).toBeVisible();
    await expect(page.getByRole('button', { name: 'パスワードを変更する' })).toBeVisible();
  });

  test('「ひとこと」の文字カウンターが動作する', async ({ page }) => {
    await expect(page.locator('.animate-spin').first()).not.toBeVisible({ timeout: 10_000 });
    const taglineInput = page.getByLabel(/ひとこと/);
    await taglineInput.fill('テスト');
    await expect(page.getByText(/3\/50/)).toBeVisible();
  });

  test('パスワードが一致しない場合、エラーが表示される', async ({ page }) => {
    await expect(page.locator('.animate-spin').first()).not.toBeVisible({ timeout: 10_000 });
    await page.getByLabel('現在のパスワード').fill('current123');
    await page.getByLabel('新しいパスワード', { exact: true }).fill('newpass123');
    await page.getByLabel('新しいパスワード（確認）').fill('differentpass');
    await page.getByRole('button', { name: 'パスワードを変更する' }).click();
    await expect(page.getByText('新しいパスワードが一致しません')).toBeVisible();
  });

  test('新しいパスワードが6文字未満の場合、エラーが表示される', async ({ page }) => {
    await expect(page.locator('.animate-spin').first()).not.toBeVisible({ timeout: 10_000 });
    await page.getByLabel('現在のパスワード').fill('current123');
    await page.getByLabel('新しいパスワード', { exact: true }).fill('abc');
    await page.getByLabel('新しいパスワード（確認）').fill('abc');
    await page.getByRole('button', { name: 'パスワードを変更する' }).click();
    await expect(page.getByText('6文字以上')).toBeVisible();
  });

  test('現在のパスワードが空の場合、エラーが表示される', async ({ page }) => {
    await expect(page.locator('.animate-spin').first()).not.toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'パスワードを変更する' }).click();
    await expect(page.getByText('現在のパスワードを入力してください')).toBeVisible();
  });
});
