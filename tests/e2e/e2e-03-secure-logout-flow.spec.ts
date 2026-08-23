import { expect, test } from '@playwright/test';

/**
 * E2E-03 - Secure Logout Flow (test specification section 16).
 *
 * Requires a dispatcher account to sign in with. Credentials are read from
 * the environment rather than hard-coded so the same test can target any
 * seeded environment without editing the file, and so no real credentials
 * are committed to the repo.
 *
 * Success criteria (per the spec): operational information is inaccessible
 * after logout.
 */

const DISPATCHER_EMAIL = process.env.E2E_DISPATCHER_EMAIL;
const DISPATCHER_PASSWORD = process.env.E2E_DISPATCHER_PASSWORD;

test.describe('E2E-03 - Secure Logout Flow', () => {
  test.skip(
    !DISPATCHER_EMAIL || !DISPATCHER_PASSWORD,
    'Set E2E_DISPATCHER_EMAIL and E2E_DISPATCHER_PASSWORD to a seeded test-environment dispatcher account to run this test.',
  );

  test('dispatcher signs out and can no longer reach the dashboard', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => consoleErrors.push(error.message));

    // 17. Dispatcher is authenticated.
    await page.goto('http://localhost:3000/');
    await expect(page).toHaveURL(/\/login/);
    await page.getByLabel('Email').fill(DISPATCHER_EMAIL!);
    await page.getByLabel('Password').fill(DISPATCHER_PASSWORD!);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL('http://localhost:3000/');
    await expect(page.getByRole('heading', { name: 'Daily Service Routes' })).toBeVisible();

    // 18. Dispatcher selects Sign out.
    await page.getByRole('button', { name: 'Sign out' }).click();

    // 19. Session is terminated. 20. Dispatcher is returned to the Login page.
    await expect(page).toHaveURL(/\/login/);

    // 21. Attempting to access the dashboard again redirects to Login, and no
    // operational service-task information is displayed.
    await page.goto('http://localhost:3000/');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: 'Daily Service Routes' })).toHaveCount(0);

    expect(consoleErrors, `Unexpected console errors: ${consoleErrors.join('\n')}`).toEqual([]);
  });
});
