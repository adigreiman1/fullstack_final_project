import { expect, test } from '@playwright/test';

/**
 * E2E-01 - Daily Planning Flow.
 *
 * Requires a controlled test environment containing:
 * - A valid dispatcher account.
 * - At least one service vehicle with service tasks scheduled for today.
 * - At least two valid-coordinate tasks for one vehicle so route
 *   optimization can be exercised.
 *
 * Credentials are provided through environment variables and are never
 * hard-coded in the repository.
 */

const DISPATCHER_EMAIL = process.env.E2E_DISPATCHER_EMAIL;
const DISPATCHER_PASSWORD = process.env.E2E_DISPATCHER_PASSWORD;

test.describe('E2E-01 - Daily Planning Flow', () => {
  test.skip(
    !DISPATCHER_EMAIL || !DISPATCHER_PASSWORD,
    'Set E2E_DISPATCHER_EMAIL and E2E_DISPATCHER_PASSWORD to run this test.',
  );

  test(
    'dispatcher signs in, reviews the daily routes, and inspects a task',
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

      // 3. Dashboard loads.
      await expect(page).toHaveURL('http://localhost:3000/');

      await expect(
        page.getByRole('heading', {
          name: 'מסלולי שירות יומיים',
        }),
      ).toBeVisible();

      // 4. Service vehicles and map markers are loaded.
      const stopMarkers = page.locator(
        'button[aria-label*=", stop "]',
      );

      await expect(stopMarkers.first()).toBeAttached({
        timeout: 15_000,
      });

      // 5. Wait until route optimisation finishes.
      await expect(
        page.getByText('מחשב מסלול…'),
      ).toHaveCount(0, {
        timeout: 20_000,
      });

      // 6. Dispatcher selects a task from the visible task list.
      //
      // We intentionally select the task from the sidebar instead of
      // clicking a Mapbox marker. Map markers can temporarily be outside
      // the current viewport, which makes direct marker clicks brittle
      // in automated browser tests.
      const taskRows = page.locator(
        'aside ol button:not(:disabled)',
      );

      await expect(taskRows.first()).toBeVisible({
        timeout: 15_000,
      });

      await taskRows.first().click();

      // 7. Task information is displayed.
      const tooltip = page.locator('.task-tooltip');

      await expect(tooltip).toBeVisible();

      await expect(
        tooltip.getByText('כתובת'),
      ).toBeVisible();

      // No unexpected JavaScript errors should occur.
      expect(
        consoleErrors,
        `Unexpected console errors: ${consoleErrors.join('\n')}`,
      ).toEqual([]);
    },
  );
});