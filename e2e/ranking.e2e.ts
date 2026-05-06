import { test, expect } from '@playwright/test';

test('add three teams from pool, ranking + URL hash both update', async ({ page }) => {
  await page.goto('/');

  // Argentina, Brazil, France live in the pool. Click their + buttons.
  await page.getByRole('button', { name: 'Add Argentina' }).click();
  await page.getByRole('button', { name: 'Add Brazil' }).click();
  await page.getByRole('button', { name: 'Add France' }).click();

  const ranked = page.locator('ol > li');
  await expect(ranked).toHaveCount(3);
  await expect(ranked.nth(0)).toContainText('Argentina');
  await expect(ranked.nth(1)).toContainText('Brazil');
  await expect(ranked.nth(2)).toContainText('France');

  // URL hash mirrors ranking order.
  await expect(page).toHaveURL(/#r=ARG,BRA,FRA/);
});

test('ranking persists across reload', async ({ page, context }) => {
  await context.clearCookies();
  await page.goto('/');
  await page.getByRole('button', { name: 'Add Argentina' }).click();
  await page.getByRole('button', { name: 'Add Brazil' }).click();

  await page.reload();

  const ranked = page.locator('ol > li');
  await expect(ranked).toHaveCount(2);
  await expect(ranked.nth(0)).toContainText('Argentina');
  await expect(ranked.nth(1)).toContainText('Brazil');
});

test('shared URL identical to saved list does not show preview banner', async ({
  page,
  context,
}) => {
  await context.addInitScript(() => {
    localStorage.setItem('wc26.ranking', JSON.stringify(['ARG', 'BRA']));
  });

  await page.goto('/#r=ARG,BRA');

  await expect(page.getByText(/viewing a shared list/i)).not.toBeVisible();
  const ranked = page.locator('ol > li');
  await expect(ranked.nth(0)).toContainText('Argentina');
  await expect(ranked.nth(1)).toContainText('Brazil');
});

test('editing while previewing a shared list adopts it as your own', async ({ page, context }) => {
  // Seed only on the first page load — addInitScript runs on every navigation,
  // and we navigate again later to verify persistence.
  await context.addInitScript(() => {
    if (!localStorage.getItem('wc26.ranking')) {
      localStorage.setItem('wc26.ranking', JSON.stringify(['ARG', 'BRA']));
    }
  });

  await page.goto('/#r=FRA,GER');
  await expect(page.getByText(/viewing a shared list/i)).toBeVisible();

  // Adding a team while in preview should implicitly save the (now-modified) list.
  await page.getByRole('button', { name: 'Add Spain' }).click();
  await expect(page.getByText(/viewing a shared list/i)).not.toBeVisible();

  const ranked = page.locator('ol > li');
  await expect(ranked).toHaveCount(3);
  await expect(ranked.nth(0)).toContainText('France');
  await expect(ranked.nth(1)).toContainText('Germany');
  await expect(ranked.nth(2)).toContainText('Spain');

  // Navigate to the bare homepage — the modified list should still be there.
  await page.goto('/');
  const persisted = page.locator('ol > li');
  await expect(persisted).toHaveCount(3);
  await expect(persisted.nth(0)).toContainText('France');
  await expect(persisted.nth(1)).toContainText('Germany');
  await expect(persisted.nth(2)).toContainText('Spain');
});

test('shared URL with existing list shows preview banner', async ({ page, context }) => {
  // Seed localStorage with an existing ranking before any page load.
  await context.addInitScript(() => {
    // runed.PersistedState wraps the JSON; default serializer is JSON.stringify.
    localStorage.setItem('wc26.ranking', JSON.stringify(['ARG', 'BRA']));
  });

  await page.goto('/#r=FRA,GER');

  // Banner visible, displayed list shows the SHARED ranking, not the saved one.
  await expect(page.getByText(/viewing a shared list/i)).toBeVisible();
  const ranked = page.locator('ol > li');
  await expect(ranked.nth(0)).toContainText('France');
  await expect(ranked.nth(1)).toContainText('Germany');

  // Restore mine reverts to saved.
  await page.getByRole('button', { name: 'Restore mine' }).click();
  await expect(page.getByText(/viewing a shared list/i)).not.toBeVisible();
  await expect(ranked.nth(0)).toContainText('Argentina');
  await expect(ranked.nth(1)).toContainText('Brazil');

  // localStorage was never overwritten.
  const stored = await page.evaluate(() => localStorage.getItem('wc26.ranking'));
  expect(stored).toBe(JSON.stringify(['ARG', 'BRA']));
});
