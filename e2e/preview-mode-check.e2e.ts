import { test, expect } from '@playwright/test';

// Regression test for the bug where SvelteKit treats a navigation to the same
// path with a different hash as an in-page navigation (no remount), so our
// onMount-only boot logic missed URL changes after the page was first loaded.
test('shared URL pasted into already-loaded page triggers preview', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByRole('button', { name: 'Add Argentina' }).click();
  await page.getByRole('button', { name: 'Add Brazil' }).click();
  await expect(page).toHaveURL(/#r=ARG,BRA/);

  // Same-page hash navigation — SvelteKit handles this without remounting.
  await page.goto('/#r=FRA,GER');

  await expect(page.getByText(/viewing a shared list/i)).toBeVisible();
  const ranked = page.locator('ol > li');
  await expect(ranked.nth(0)).toContainText('France');
  await expect(ranked.nth(1)).toContainText('Germany');

  // Saved list is untouched until user explicitly edits or saves.
  const stored = await page.evaluate(() => localStorage.getItem('wc26.ranking'));
  expect(stored).toBe(JSON.stringify(['ARG', 'BRA']));
});
