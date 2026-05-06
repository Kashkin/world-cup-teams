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
