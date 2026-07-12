import { test, expect } from '@playwright/test';

test('fixture is unavailable without the explicit runtime flag', async ({ request }) => {
  const response = await request.get('/__fixtures__/editor');
  expect(response.status()).toBe(404);
});
