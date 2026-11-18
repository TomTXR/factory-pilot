import { expect, test } from '@playwright/test';

test('home page shows title and a healthy API', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Home Maintenance Log' })).toBeVisible();
  await expect(page.getByTestId('api-status')).toHaveText('API: ok');
});
