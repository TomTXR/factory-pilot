import { expect, test } from '@playwright/test';

// These specs run against the local, CI and preview stacks, where the labelled test sign-in replaces Google.

const noHorizontalScroll = () => document.documentElement.scrollWidth <= document.documentElement.clientWidth;

test('without a session only the login screen shows, with no property data', async ({ page }) => {
  let propertiesRequested = false;
  page.on('request', (r) => {
    if (new URL(r.url()).pathname.startsWith('/api/properties')) propertiesRequested = true;
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Home Maintenance Log' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Test sign-in' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sign in with Google' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Sign out' })).toHaveCount(0);
  expect(propertiesRequested).toBe(false);
});

test('the API refuses property calls without a session but keeps health public', async ({ request }) => {
  expect((await request.get('/api/properties')).status()).toBe(401);
  expect((await request.get('/api/health')).ok()).toBe(true);
  expect((await request.get('/api/version')).ok()).toBe(true);
});

test('login screen fits the screen and its button is at least 44 px high', async ({ page }) => {
  await page.goto('/');
  const button = page.getByRole('button', { name: 'Test sign-in' });
  await expect(button).toBeVisible();
  await expect(button).toBeInViewport();
  const box = await button.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(noHorizontalScroll)).toBe(true);
});

test('test sign-in shows the app, a reload keeps the session, sign-out returns to the login screen', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Test sign-in' }).click();
  const signOut = page.getByRole('button', { name: 'Sign out' });
  await expect(signOut).toBeVisible();
  await expect(page.getByTestId('api-status')).toBeInViewport();
  await expect(signOut).toBeInViewport();
  expect(await page.evaluate(noHorizontalScroll)).toBe(true);

  await page.reload();
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();

  await page.evaluate(() => localStorage.setItem('selectedPropertyId', 'some-id'));
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('button', { name: 'Test sign-in' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('selectedPropertyId'))).toBeNull();

  await page.goBack().catch(() => undefined);
  await expect(page.getByRole('button', { name: 'Sign out' })).toHaveCount(0);
  await expect(page.getByText('Loading properties...')).toHaveCount(0);
});

test('an ended session shows the login screen instead of an error', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Test sign-in' }).click();
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
  await page.context().clearCookies();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Test sign-in' })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('the test sign-in is the only way in on this stack: Google login answers 404', async ({ request }) => {
  expect((await request.get('/api/auth/login', { maxRedirects: 0 })).status()).toBe(404);
});

test('a failed Google sign-in message shows on the login screen', async ({ page }) => {
  await page.goto('/?auth_error=1');
  await expect(page.getByRole('alert')).toContainText('Sign-in did not complete');
});
