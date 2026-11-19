import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  expect((await page.request.post('/api/auth/test-login')).ok()).toBe(true);
});

test('home page shows title and a healthy API', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Home Maintenance Log' })).toBeVisible();
  await expect(page.getByTestId('api-status')).toHaveText('API: ok');
});

for (const [name, size] of [
  ['desktop', { width: 1280, height: 800 }],
  ['390 px phone', { width: 390, height: 844 }],
] as const) {
  test(`footer shows the version on ${name}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto('/');
    const footer = page.getByTestId('app-version');
    await expect(footer).toHaveText(/^Version \d+\.\d+\.\d+$/);
    await footer.scrollIntoViewIfNeeded();
    await expect(footer).toBeInViewport();
    const noOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    );
    expect(noOverflow).toBe(true);
  });
}
