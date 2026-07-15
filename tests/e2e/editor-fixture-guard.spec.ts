import { test, expect } from '@playwright/test';

test('fixture is unavailable without the explicit runtime flag', async ({ request }) => {
  const response = await request.get('/editor-fixture');
  expect(response.status()).toBe(404);

  const adminResponse = await request.get('/admin-fixture');
  expect(adminResponse.status()).toBe(404);
});
