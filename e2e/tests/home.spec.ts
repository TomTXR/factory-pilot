import { expect, test } from '@playwright/test';

test('home page shows title, empty state and a healthy API', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Home Maintenance Log' })).toBeVisible();
  await expect(page.getByText('No properties yet.')).toBeVisible();
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
    await expect(footer).toHaveText(/^Version \S+$/);
    await expect(footer).toBeInViewport();
    const noOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    );
    expect(noOverflow).toBe(true);
  });
}
