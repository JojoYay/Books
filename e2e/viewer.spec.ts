/**
 * viewer.spec.ts
 *
 * Tests the book viewer page (ビューワー).
 * Requires at least one book to be visible to the logged-in user.
 *
 * Covers: desktop + mobile, leader + member
 */
import { test, expect } from '@playwright/test';

/** Navigate to the first available book's viewer page.
 *  Returns false if no books are available (test should skip). */
async function goToFirstBook(page: import('@playwright/test').Page): Promise<string | null> {
  await page.goto('/');
  await expect(page.locator('.animate-pulse').first()).not.toBeVisible({ timeout: 15_000 });

  const bookCard = page.locator('a[href^="/books/"]').first();
  if (await bookCard.count() === 0) return null;

  const href = (await bookCard.getAttribute('href')) ?? '';
  await page.goto(href);
  return href;
}

test.describe('ビューワー', () => {
  test('ビューワーが表示される（本がある場合）', async ({ page }) => {
    const href = await goToFirstBook(page);
    if (!href) test.skip();

    // The viewer should show the book content area
    await expect(page).toHaveURL(/\/books\//, { timeout: 10_000 });
  });

  test('戻るボタン（←）が表示される', async ({ page }) => {
    const href = await goToFirstBook(page);
    if (!href) test.skip();

    const backLink = page.getByRole('link', { name: /戻る|本一覧/ }).or(
      page.locator('a[href="/"]')
    );
    await expect(backLink.first()).toBeVisible({ timeout: 10_000 });
  });

  test('共有ボタンが表示される', async ({ page }) => {
    const href = await goToFirstBook(page);
    if (!href) test.skip();

    const shareButton = page.getByRole('button', { name: /共有|URLをコピー|シェア/ });
    await expect(shareButton).toBeVisible({ timeout: 10_000 });
  });

  test('ページスライダーが表示される', async ({ page }) => {
    const href = await goToFirstBook(page);
    if (!href) test.skip();

    const slider = page.locator('input[type="range"]');
    await expect(slider).toBeVisible({ timeout: 10_000 });
  });

  test('「前へ」「次へ」ボタンが表示される（スクロール不要）', async ({ page }) => {
    const href = await goToFirstBook(page);
    if (!href) test.skip();

    // These should be in the sticky bottom toolbar, always visible
    const prevBtn = page.getByRole('button', { name: '前のページ' }).or(
      page.getByLabel('前のページ')
    );
    const nextBtn = page.getByRole('button', { name: '次のページ' }).or(
      page.getByLabel('次のページ')
    );

    await expect(prevBtn).toBeVisible({ timeout: 10_000 });
    await expect(nextBtn).toBeVisible({ timeout: 10_000 });
  });

  test('しおりボタンが表示される', async ({ page }) => {
    const href = await goToFirstBook(page);
    if (!href) test.skip();

    const bookmarkBtn = page.getByRole('button', { name: /しおり/ });
    await expect(bookmarkBtn).toBeVisible({ timeout: 10_000 });
  });

  test('メモボタンが表示される', async ({ page }) => {
    const href = await goToFirstBook(page);
    if (!href) test.skip();

    const memoBtn = page.getByRole('button', { name: /メモ/ });
    await expect(memoBtn).toBeVisible({ timeout: 10_000 });
  });

  test('メモボタンをクリックするとメモパネルが開く', async ({ page }) => {
    const href = await goToFirstBook(page);
    if (!href) test.skip();

    const memoBtn = page.getByRole('button', { name: /メモ/ });
    await memoBtn.click();

    // Memo panel textarea should appear
    const memoTextarea = page.locator('textarea[placeholder*="メモ"]');
    await expect(memoTextarea).toBeVisible({ timeout: 5_000 });
  });

  test('メモパネルを閉じることができる', async ({ page }) => {
    const href = await goToFirstBook(page);
    if (!href) test.skip();

    // Open memo panel
    const memoBtn = page.getByRole('button', { name: /メモ/ });
    await memoBtn.click();

    // Close it
    const closeBtn = page.getByRole('button', { name: /閉じる/ });
    await closeBtn.click();

    const memoTextarea = page.locator('textarea[placeholder*="メモ"]');
    await expect(memoTextarea).not.toBeVisible({ timeout: 5_000 });
  });

  test('「次へ」ボタンで次のページに進む', async ({ page }) => {
    const href = await goToFirstBook(page);
    if (!href) test.skip();

    const slider = page.locator('input[type="range"]');
    const initialValue = await slider.inputValue();

    const nextBtn = page.getByLabel('次のページ').or(
      page.getByRole('button', { name: '次のページ' })
    );

    // If already at last page, next button is disabled
    const isDisabled = await nextBtn.isDisabled();
    if (isDisabled) {
      test.skip(); // single-page book
    }

    await nextBtn.click();
    await page.waitForTimeout(500);
    const newValue = await slider.inputValue();
    expect(Number(newValue)).toBeGreaterThan(Number(initialValue));
  });

  test('URLに?pageパラメータがある場合、そのページが表示される', async ({ page }) => {
    const href = await goToFirstBook(page);
    if (!href) test.skip();

    // Navigate to page 1 explicitly
    await page.goto(`${href}?page=1`);
    const slider = page.locator('input[type="range"]');
    await expect(slider).toBeVisible({ timeout: 10_000 });
    expect(await slider.inputValue()).toBe('1');
  });

  // Mobile-specific: toolbar must be visible without scrolling
  test('モバイル: ツールバーボタンがスクロールなしで表示される', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'モバイルのみのテスト');
    const href = await goToFirstBook(page);
    if (!href) test.skip();

    // Check that toolbar buttons are in the viewport
    const nextBtn = page.getByLabel('次のページ').or(
      page.getByRole('button', { name: '次のページ' })
    );
    await expect(nextBtn).toBeInViewport({ timeout: 10_000 });
  });
});
