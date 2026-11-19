import { expect, test } from '@playwright/test';

// Two accounts in separate browser contexts. The e2e database is shared, so names are unique and cleaned up.
test('accounts do not see each other, can use the same address, and B gets 404 on A ids', async ({
  browser,
}, info) => {
  const owner = `E2E accounts ${info.project.name} ${Date.now()}`;
  const body = { street: 'Gedeeldstraat', houseNumber: '1', postalCode: '1011 AB', city: 'Teststad', ownerName: owner };
  const ctxA = await browser.newContext(info.project.use);
  const ctxB = await browser.newContext(info.project.use);
  const a = ctxA.request;
  const b = ctxB.request;
  try {
    expect((await a.post('/api/auth/test-login', { data: { user: 'a' } })).ok()).toBe(true);
    expect((await b.post('/api/auth/test-login', { data: { user: 'b' } })).ok()).toBe(true);

    const created = await a.post('/api/properties', { data: body });
    expect(created.status()).toBe(201);
    const { id } = (await created.json()) as { id: string };

    const listB = (await (await b.get('/api/properties')).json()) as { ownerName: string }[];
    expect(listB.some((p) => p.ownerName === owner)).toBe(false);
    expect((await b.get(`/api/properties/${id}`)).status()).toBe(404);
    expect((await b.put(`/api/properties/${id}`, { data: body })).status()).toBe(404);
    expect((await b.delete(`/api/properties/${id}`)).status()).toBe(404);

    const createdB = await b.post('/api/properties', { data: body });
    expect(createdB.status()).toBe(201);
    expect((await a.post('/api/properties', { data: body })).status()).toBe(409);
    const idB = ((await createdB.json()) as { id: string }).id;
    await b.delete(`/api/properties/${idB}`);
    expect((await a.get(`/api/properties/${id}`)).status()).toBe(200);
    await a.delete(`/api/properties/${id}`);
  } finally {
    await ctxA.close();
    await ctxB.close();
  }
});

test('sign-out of A then sign-in of B on the same page shows no trace of A', async ({ page }, info) => {
  const owner = `E2E trace ${info.project.name} ${Date.now()}`;
  expect((await page.request.post('/api/auth/test-login', { data: { user: 'a' } })).ok()).toBe(true);
  const created = await page.request.post('/api/properties', {
    data: { street: 'Sporenstraat', houseNumber: '9', postalCode: '1011 AB', city: 'Teststad', ownerName: owner },
  });
  const { id } = (await created.json()) as { id: string };
  try {
    await page.goto('/');
    await expect(page.getByText('Sporenstraat 9').first()).toBeVisible();
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page.getByRole('button', { name: 'Test sign-in' })).toBeVisible();

    expect((await page.request.post('/api/auth/test-login', { data: { user: 'b' } })).ok()).toBe(true);
    await page.goto('/');
    await expect(page.getByTestId('signed-in-user')).toHaveText('Test User Two');
    await expect(page.getByText('Sporenstraat')).toHaveCount(0);
    await expect(page.getByText(owner)).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('selectedPropertyId'))).not.toBe(id);
  } finally {
    await page.request.post('/api/auth/test-login', { data: { user: 'a' } });
    await page.request.delete(`/api/properties/${id}`);
  }
});

test('a new account sees the empty state without horizontal scrolling', async ({ page }) => {
  expect((await page.request.post('/api/auth/test-login', { data: { user: 'c' } })).ok()).toBe(true);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Add your first property' })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});
