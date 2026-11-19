import { expect, test } from '@playwright/test';

const noHorizontalScroll = () => document.documentElement.scrollWidth <= document.documentElement.clientWidth;

// Each project deletes its own test user (d: desktop, e: mobile), so parallel runs do not interfere.
// User b is the bystander whose property must survive. The e2e database is shared, so names are unique.
test('a user deletes the account with a typed confirmation, B keeps data, a new sign-in starts empty', async ({
  page,
  browser,
}, info) => {
  const me = info.project.name === 'mobile' ? 'e' : 'd';
  const owner = `E2E delete ${info.project.name} ${Date.now()}`;
  const body = { street: 'Verwijderstraat', houseNumber: '3', postalCode: '1011 AB', city: 'Teststad', ownerName: owner };
  const ctxB = await browser.newContext(info.project.use);
  let idB: string | undefined;
  try {
    expect((await ctxB.request.post('/api/auth/test-login', { data: { user: 'b' } })).ok()).toBe(true);
    const createdB = await ctxB.request.post('/api/properties', { data: body });
    expect(createdB.status()).toBe(201);
    idB = ((await createdB.json()) as { id: string }).id;

    expect((await page.request.post('/api/auth/test-login', { data: { user: me } })).ok()).toBe(true);
    expect((await page.request.post('/api/properties', { data: body })).status()).toBe(201);
    await page.goto('/');
    await page.getByTestId('signed-in-user').click();
    await expect(page.getByRole('heading', { name: 'Danger zone' })).toBeVisible();
    expect(await page.evaluate(noHorizontalScroll)).toBe(true);

    await page.getByRole('button', { name: 'Delete account' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('1 property');
    await expect(dialog).toContainText('permanently deleted');
    await expect(dialog).toContainText('This cannot be undone');
    const confirm = dialog.getByRole('button', { name: 'Delete account' });
    const cancel = dialog.getByRole('button', { name: 'Cancel' });
    await expect(confirm).toBeDisabled();
    expect(await page.evaluate(noHorizontalScroll)).toBe(true);
    await expect(confirm).toBeInViewport();
    await expect(cancel).toBeInViewport();

    // Cancel deletes nothing.
    await cancel.click();
    await expect(dialog).toHaveCount(0);
    expect((await page.request.get('/api/auth/me')).status()).toBe(200);

    await page.getByRole('button', { name: 'Delete account' }).click();
    await dialog.getByLabel(/Type DELETE/).fill('DELETE');
    await expect(confirm).toBeEnabled();
    await confirm.click();
    await expect(page.getByText('Your account has been deleted.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Test sign-in' })).toBeVisible();
    expect((await page.request.get('/api/auth/me')).status()).toBe(401);

    // B is untouched.
    const listB = (await (await ctxB.request.get('/api/properties')).json()) as { ownerName: string }[];
    expect(listB.some((p) => p.ownerName === owner)).toBe(true);

    // Signing in again creates a new, empty account.
    expect((await page.request.post('/api/auth/test-login', { data: { user: me } })).ok()).toBe(true);
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Add your first property' })).toBeVisible();
  } finally {
    if (idB) await ctxB.request.delete(`/api/properties/${idB}`);
    await ctxB.close();
  }
});

test('the API refuses account deletion without a session or without the confirmation', async ({ request, page }) => {
  expect((await request.delete('/api/auth/account', { data: { confirm: 'DELETE' } })).status()).toBe(401);
  expect((await page.request.post('/api/auth/test-login', { data: { user: 'c' } })).ok()).toBe(true);
  expect((await page.request.delete('/api/auth/account', { data: {} })).status()).toBe(400);
  expect((await page.request.get('/api/auth/me')).status()).toBe(200);
});
