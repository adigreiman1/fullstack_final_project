import { expect, test } from '@playwright/test';

/**
 * E2E-01 - Daily Planning Flow (test specification section 16).
 *
 * Requires a controlled test environment (see specification section 3) whose
 * `service_tasks` table has at least one routable vehicle (>= 2 valid-coordinate
 * tasks) scheduled for today in the Asia/Jerusalem timezone, plus a dispatcher
 * account to sign in with. Credentials are read from the environment rather than
 * hard-coded so the same test can target any seeded environment without editing
 * the file, and so no real credentials are committed to the repo.
 *
 * Success criteria (per the spec): the complete daily operational view can be
 * reached and used without an error.
 */

const DISPATCHER_EMAIL = process.env.E2E_DISPATCHER_EMAIL;
const DISPATCHER_PASSWORD = process.env.E2E_DISPATCHER_PASSWORD;

test.describe('E2E-01 - Daily Planning Flow', () => {
  test.skip(
    !DISPATCHER_EMAIL || !DISPATCHER_PASSWORD,
    'Set E2E_DISPATCHER_EMAIL and E2E_DISPATCHER_PASSWORD to a seeded test-environment dispatcher account to run this test.',
  );

  test('dispatcher signs in, reviews the day\'s routes, and inspects a task', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => consoleErrors.push(error.message));

    // 1. Dispatcher opens the application.
    await page.goto('http://localhost:3000/');

    // Unauthenticated, so the app must bounce to sign-in before anything else.
    await expect(page).toHaveURL(/\/login/);

    // 2. Dispatcher signs in.
    await page.getByLabel('Email').fill(DISPATCHER_EMAIL!);
    await page.getByLabel('Password').fill(DISPATCHER_PASSWORD!);
    await page.getByRole('button', { name: 'Sign in' }).click();

    // 3. Dashboard loads the selected workday.
    await expect(page).toHaveURL('http://localhost:3000/');
    await expect(page.getByRole('heading', { name: 'Daily Service Routes' })).toBeVisible();

    // 4. Service vehicles and tasks are displayed.
    const stopMarkers = page.locator('button[aria-label*=", stop "]');
    await expect(stopMarkers.first()).toBeVisible({ timeout: 15_000 });

    // 5. Optimized routes are calculated — wait for the in-flight optimisation
    // note to clear rather than asserting a fixed delay.
    await expect(page.getByText('Optimising route…')).toHaveCount(0, { timeout: 20_000 });

    // 6. Dispatcher selects a task.
    // force: true — the Mapbox GL canvas sits on top of the marker's hit area
    // and intercepts pointer events, even though the marker is the element
    // that's visually clickable.
    await stopMarkers.first().click({ force: true });

    // 7. Task information is displayed.
    const tooltip = page.locator('.task-tooltip');
    await expect(tooltip).toBeVisible();
    await expect(tooltip.getByText('Address:')).toBeVisible();

    expect(consoleErrors, `Unexpected console errors: ${consoleErrors.join('\n')}`).toEqual([]);
  });
});
