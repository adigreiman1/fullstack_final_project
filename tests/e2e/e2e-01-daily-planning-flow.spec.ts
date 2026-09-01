import { expect, test } from '@playwright/test';

/**
 * E2E-01 - Daily Planning Flow.
 *
 * This test uses a known workday that already contains service-task data
 * in the shared Supabase test environment.
 *
 * The selected date is 2026-08-20 because it contains multiple valid
 * service tasks for the same vehicle, allowing both map markers and
 * route optimization to be verified.
 *
 * Credentials are provided through environment variables and are never
 * hard-coded in the repository.
 */

const DISPATCHER_EMAIL = process.env.E2E_DISPATCHER_EMAIL;
const DISPATCHER_PASSWORD = process.env.E2E_DISPATCHER_PASSWORD;

const TEST_DATE = '2026-08-20';

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

      // 1. Dispatcher opens a known workday that contains service tasks.
      await page.goto(
        `http://localhost:3000/?date=${TEST_DATE}`,
      );

      // An unauthenticated user should be redirected to Login.
      await expect(page).toHaveURL(/\/login/);

      // 2. Dispatcher signs in.
      await page
        .getByLabel('אימייל:')
        .fill(DISPATCHER_EMAIL!);

      await page
        .getByLabel('סיסמה:')
        .fill(DISPATCHER_PASSWORD!);

      await page
        .getByRole('button', { name: 'Sign in' })
        .click();

      // 3. After authentication, the requested workday should be restored.
      await expect(page).toHaveURL(
        `http://localhost:3000/?date=${TEST_DATE}`,
      );

      await expect(
        page.getByRole('heading', {
          name: 'מסלולי שירות יומיים',
        }),
      ).toBeVisible();

      // 4. Service-task map markers should be available.
      const stopMarkers = page.locator(
        'button[aria-label*=", stop "]',
      );

      await expect(stopMarkers.first()).toBeAttached({
        timeout: 15_000,
      });

      // 5. Wait until route optimization finishes.
      await expect(
        page.getByText('מחשב מסלול…'),
      ).toHaveCount(0, {
        timeout: 20_000,
      });

      // 6. Select a task from the sidebar.
      //
      // Selecting from the sidebar is more stable than clicking directly
      // on a map marker because a marker may temporarily be outside the
      // current visible map viewport.
      const taskRows = page.locator(
        'aside ol button:not(:disabled)',
      );

      await expect(taskRows.first()).toBeVisible({
        timeout: 15_000,
      });

      await taskRows.first().click();

      // 7. Task details should be displayed.
      const tooltip = page.locator('.task-tooltip');

      await expect(tooltip).toBeVisible();

      await expect(
        tooltip.getByText('כתובת'),
      ).toBeVisible();

      // 8. No unexpected browser-side JavaScript errors should occur.
      expect(
        consoleErrors,
        `Unexpected console errors: ${consoleErrors.join('\n')}`,
      ).toEqual([]);
    },
  );
});