import { test, expect } from '@playwright/test';

test('flagged fixture applies and captures text appearance', async ({ request, page }) => {
  expect((await request.get('/editor-fixture')).status()).toBe(200);
  await page.goto('/editor-fixture');
  const editor = page.locator('.ProseMirror');
  await expect(editor).toBeVisible();
  await editor.click();
  await page.keyboard.press('ControlOrMeta+A');

  const largeButton = page.getByRole('button', { name: '大字' });
  const accentButton = page.getByRole('button', { name: '文字顏色：強調' });
  await expect(largeButton).toBeVisible();
  await largeButton.click();
  const largeText = editor.locator('span[data-editor-size="large"]');
  await expect(largeText).toHaveText('選取這段文字');
  await expect(largeText).toHaveCSS('font-size', '18.88px');
  await expect(largeButton).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('editor-json')).toHaveAttribute(
    'data-value',
    /"type":"textAppearance","attrs":\{"size":"large"\}/,
  );

  await accentButton.click();
  const appearance = editor.locator('span[data-editor-size="large"][data-editor-color="accent"]');
  await expect(appearance).toHaveText('選取這段文字');
  await expect(appearance).toHaveCSS('color', 'rgb(182, 106, 60)');
  await expect(accentButton).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('editor-json')).toHaveAttribute(
    'data-value',
    /"type":"textAppearance","attrs":\{"size":"large","color":"accent"\}/,
  );
});
