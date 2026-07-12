import { test, expect } from '@playwright/test';

test('flagged fixture loads the editor before interactions', async ({ request, page }) => {
  expect((await request.get('/editor-fixture')).status()).toBe(200);
  await page.goto('/editor-fixture');
  const editor = page.locator('.ProseMirror');
  await expect(editor).toBeVisible();
  await editor.selectText();
  await expect(page.getByRole('button', { name: '清除文字外觀' })).toBeVisible();
});
