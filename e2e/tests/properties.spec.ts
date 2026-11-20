import { expect, type Page, test } from '@playwright/test';

// The e2e database is shared, so every test uses uniquely named properties and deletes them afterwards.
let created: string[] = [];

// The API needs a session. page.request shares the cookies of the page, so one test sign-in serves both.
test.beforeEach(async ({ page }) => {
  expect((await page.request.post('/api/auth/test-login')).ok()).toBe(true);
});

test.afterEach(async ({ page }) => {
  const request = page.request;
  const list = (await (await request.get('/api/properties')).json()) as { id: string; ownerName: string }[];
  for (const p of list) {
    if (created.some((owner) => p.ownerName.startsWith(owner))) await request.delete(`/api/properties/${p.id}`);
  }
  created = [];
});

function unique(label: string, projectName: string): string {
  const owner = `E2E ${label} ${projectName} ${Date.now()}${Math.floor(Math.random() * 1000)}`;
  created.push(owner);
  return owner;
}

async function addProperty(page: Page, owner: string, street: string, extra?: () => Promise<void>) {
  await page.getByLabel(/^Street/).fill(street);
  await page.getByLabel(/^House number/).fill('7');
  await page.getByLabel(/^Postal code/).fill('1011 AB');
  await page.getByLabel(/^City/).fill('Teststad');
  await page.getByLabel(/^Owner name/).fill(owner);
  await extra?.();
  await page.getByRole('button', { name: 'Add property', exact: true }).last().click();
}

test('empty state offers to add the first property', async ({ page }) => {
  await page.route('**/api/properties', (route) =>
    route.request().method() === 'GET' ? route.fulfill({ json: [] }) : route.continue(),
  );
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Add your first property' })).toBeVisible();
  await expect(page.getByText('No properties yet.', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Add your first property' }).click();
  await expect(page.getByRole('heading', { name: 'Add property' })).toBeVisible();
});

test('adds a property with characteristics and shows it', async ({ page }, info) => {
  const owner = unique('add', info.project.name);
  await page.goto('/');
  await page.getByRole('button', { name: /Add (your first )?property/ }).click();
  await addProperty(page, owner, 'Voorbeeldlaan', async () => {
    await page.getByLabel('Property type').selectOption('house');
    await page.getByLabel('Year built').fill('1985');
    await page.getByLabel('Number of rooms').fill('4');
  });
  await expect(page.getByRole('heading', { name: 'Voorbeeldlaan 7' })).toBeVisible();
  await expect(page.getByText(owner)).toBeVisible();
  await expect(page.getByText('1985')).toBeVisible();
  await expect(page.getByText('Living area')).toHaveCount(0);
});

test('shows field errors for missing fields and a duplicate message', async ({ page }, info) => {
  const owner = unique('dup', info.project.name);
  await page.goto('/');
  await page.getByRole('button', { name: /Add (your first )?property/ }).click();
  await page.getByRole('button', { name: 'Add property', exact: true }).last().click();
  await expect(page.getByText('Street is required')).toBeVisible();
  await expect(page.getByText('Owner name is required')).toBeVisible();

  await addProperty(page, owner, 'Dubbelstraat');
  await expect(page.getByRole('heading', { name: 'Dubbelstraat 7' })).toBeVisible();

  await page.getByRole('button', { name: 'Add property', exact: true }).click();
  await addProperty(page, owner.toUpperCase(), 'dubbelstraat');
  await expect(page.getByText('This property already exists')).toBeVisible();
});

test('adds a second property, switches, and the selection survives a reload', async ({ page }, info) => {
  const first = unique('first', info.project.name);
  const second = unique('second', info.project.name);
  await page.goto('/');
  await page.getByRole('button', { name: /Add (your first )?property/ }).click();
  await addProperty(page, first, 'Eerstelaan');
  await expect(page.getByRole('heading', { name: 'Eerstelaan 7' })).toBeVisible();

  await page.getByRole('button', { name: 'Add property', exact: true }).click();
  await addProperty(page, second, 'Tweedelaan');
  await expect(page.getByRole('heading', { name: 'Tweedelaan 7' })).toBeVisible();

  await page.getByLabel('Property', { exact: true }).selectOption({ label: 'Eerstelaan 7' });
  await expect(page.getByText(first)).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Eerstelaan 7' })).toBeVisible();
});

test('edits a property', async ({ page }, info) => {
  const owner = unique('edit', info.project.name);
  await page.goto('/');
  await page.getByRole('button', { name: /Add (your first )?property/ }).click();
  await addProperty(page, owner, 'Wijzigstraat');
  await page.getByRole('button', { name: 'Edit property' }).click();
  await expect(page.getByLabel(/^Street/)).toHaveValue('Wijzigstraat');
  await page.getByLabel('Display name').fill(`Renamed ${owner}`);
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('heading', { name: `Renamed ${owner}` })).toBeVisible();
});

test('deletes a property only after confirmation', async ({ page }, info) => {
  const owner = unique('del', info.project.name);
  await page.goto('/');
  await page.getByRole('button', { name: /Add (your first )?property/ }).click();
  await addProperty(page, owner, 'Verwijderstraat');
  await expect(page.getByRole('heading', { name: 'Verwijderstraat 7' })).toBeVisible();

  await page.getByRole('button', { name: 'Delete property' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Verwijderstraat 7');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Verwijderstraat 7' })).toBeVisible();

  await page.getByRole('button', { name: 'Delete property' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByText(owner)).toHaveCount(0);
});

test('has no horizontal scrolling', async ({ page }, info) => {
  const owner = unique('scroll', info.project.name);
  await page.goto('/');
  await page.getByRole('button', { name: /Add (your first )?property/ }).click();
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(await overflow()).toBe(false);
  await addProperty(page, owner, 'Breedtestraat');
  await expect(page.getByRole('heading', { name: 'Breedtestraat 7' })).toBeVisible();
  expect(await overflow()).toBe(false);
});

// The stack under test (CI and local) answers address searches with a stub of synthetic addresses.
test('#59 AC14: the stack answers the address search from the stub and the saved property has the shown values', async ({ page }, info) => {
  const owner = unique('search', info.project.name);
  await page.goto('/');
  await page.getByRole('button', { name: /Add (your first )?property/ }).click();
  await page.getByLabel('Find address').fill('voorbeeldstraat 12');
  await page.getByRole('option', { name: 'Voorbeeldstraat 12, 9999 SS Testdorp' }).click();
  await expect(page.getByLabel(/^Street/)).toHaveValue('Voorbeeldstraat');
  await expect(page.getByLabel(/^Postal code/)).toHaveValue('9999 SS');
  await expect(page.getByLabel(/^City/)).toHaveValue('Testdorp');
  await page.getByLabel(/^City/).fill('Anderdorp');
  await page.getByLabel(/^Owner name/).fill(owner);
  await page.getByRole('button', { name: 'Add property', exact: true }).last().click();
  await expect(page.getByRole('heading', { name: 'Voorbeeldstraat 12' })).toBeVisible();
  await expect(page.getByText('Anderdorp')).toBeVisible();
});

test('#59 AC16: suggestions are at least 44 px high and fit the screen width', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Add (your first )?property/ }).click();
  await page.getByLabel('Find address').fill('voorbeeldstraat');
  // Scoped to the list: the country select has options too.
  const option = page.getByRole('listbox', { name: 'Matching addresses' }).getByRole('option').first();
  await expect(option).toBeVisible();
  expect((await option.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
});
