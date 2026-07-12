import { test, expect } from '@playwright/test';

test('flagged fixture loads the editor before interactions', async ({ request, page }) => {
  expect((await request.get('/__fixtures__/editor')).status()).toBe(200);
  await page.goto('/__fixtures__/editor');
  await expect(page.locator('.ProseMirror')).toBeVisible();
  await expect(page.getByRole('button', { name: '清除文字外觀' })).toBeVisible();
});
