import { expect, test } from '@playwright/test';

/**
 * E2E-03 - Secure Logout Flow.
 *
 * Requires a valid dispatcher account.
 * Credentials are provided through environment variables
 * and are never hard-coded in the repository.
 *
 * Success criteria:
 * After logout, operational dashboard information must no longer
 * be accessible and direct navigation to the protected dashboard
 * must redirect the user back to the Login page.
 */

const DISPATCHER_EMAIL = process.env.E2E_DISPATCHER_EMAIL;
const DISPATCHER_PASSWORD = process.env.E2E_DISPATCHER_PASSWORD;

test.describe('E2E-03 - Secure Logout Flow', () => {
  test.skip(
    !DISPATCHER_EMAIL || !DISPATCHER_PASSWORD,
    'Set E2E_DISPATCHER_EMAIL and E2E_DISPATCHER_PASSWORD to run this test.',
  );

  test(
    'dispatcher signs out and can no longer reach the dashboard',
    async ({ page }) => {
      const consoleErrors: string[] = [];

      page.on('console', (message) => {
        if (message.type() === 'error') {
          consoleErrors.push(message.text());
        }
      });

      page.on('pageerror', (error) => {
        consoleErrors.push(error.message);
      });

      // 1. Dispatcher opens the application.
      await page.goto('http://localhost:3000/');

      // Unauthenticated users should be redirected to Login.
      await expect(page).toHaveURL(/\/login/);

      // 2. Dispatcher signs in.
      await page.getByLabel('Email').fill(DISPATCHER_EMAIL!);
      await page.getByLabel('Password').fill(DISPATCHER_PASSWORD!);

      await page
        .getByRole('button', { name: 'Sign in' })
        .click();

      // 3. Dashboard is accessible after successful authentication.
      await expect(page).toHaveURL('http://localhost:3000/');

      await expect(
        page.getByRole('heading', {
          name: 'מסלולי שירות יומיים',
        }),
      ).toBeVisible();

      // 4. Dispatcher signs out.
      await page
        .getByRole('button', { name: 'התנתקות' })
        .click();

      // 5. Session is terminated and the user returns to Login.
      await expect(page).toHaveURL(/\/login/);

      // 6. Attempting to navigate directly to the protected dashboard
      // must redirect the logged-out user back to Login.
      await page.goto('http://localhost:3000/');

      await expect(page).toHaveURL(/\/login/);

      // Operational dashboard information must not be rendered.
      await expect(
        page.getByRole('heading', {
          name: 'מסלולי שירות יומיים',
        }),
      ).toHaveCount(0);

      // No unexpected browser-side errors should occur.
      expect(
        consoleErrors,
        `Unexpected console errors: ${consoleErrors.join('\n')}`,
      ).toEqual([]);
    },
  );
});