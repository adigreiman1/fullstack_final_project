import { expect, test } from '@playwright/test';

/**
 * E2E-02 - New Service Task Decision-Support Flow.
 *
 * Requires a controlled test environment containing:
 * - A valid dispatcher account.
 * - At least one service task scheduled during the next four days.
 * - The task must be within 20 km of E2E_SEARCH_ADDRESS.
 *
 * Credentials and the search address are read from environment variables
 * rather than being hard-coded in the repository.
 *
 * Address autocomplete uses the live Google Places API.
 *
 * Success criteria:
 * The dispatcher can search for a new service location, receive scheduling
 * recommendations, and inspect the recommended workday without modifying
 * SAP-mirrored data.
 */

const DISPATCHER_EMAIL = process.env.E2E_DISPATCHER_EMAIL;
const DISPATCHER_PASSWORD = process.env.E2E_DISPATCHER_PASSWORD;
const SEARCH_ADDRESS = process.env.E2E_SEARCH_ADDRESS;

test.describe('E2E-02 - New Service Task Decision-Support Flow', () => {
  test.skip(
    !DISPATCHER_EMAIL || !DISPATCHER_PASSWORD || !SEARCH_ADDRESS,
    'Set E2E_DISPATCHER_EMAIL, E2E_DISPATCHER_PASSWORD, and E2E_SEARCH_ADDRESS to run this test.',
  );

  test(
    'dispatcher searches an address, reviews recommendations, and opens the recommended workday',
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

      // 4. Dispatcher searches for a new service address.
      //
      // The current product uses Google Places autocomplete.
      const searchInput = page.getByPlaceholder('חיפוש כתובת...');

      await expect(searchInput).toBeVisible();

      const searchAndSelectAddress = async () => {
        await searchInput.fill('');
        await searchInput.fill(SEARCH_ADDRESS!);

        // Suggestions are rendered in the <ul> directly below
        // the address-search input.
        const suggestionsList = searchInput.locator(
          'xpath=../following-sibling::ul',
        );

        const firstSuggestion =
          suggestionsList.locator('button').first();

        await expect(firstSuggestion).toBeVisible({
          timeout: 10_000,
        });

        const suggestionText =
          await firstSuggestion.textContent();

        expect(suggestionText).not.toBeNull();

        await firstSuggestion.click();

        // Google Place Details resolves the selected prediction before
        // draftLocation is created, so wait until the selected address
        // appears in the dashboard.
        await expect(
          page.getByText(suggestionText!.trim()).first(),
        ).toBeVisible({
          timeout: 10_000,
        });

        return suggestionText!.trim();
      };

      const selectedAddress =
        await searchAndSelectAddress();

      // 5. The searched location is represented on the map.
      //
      // The pink draft-location marker stores the resolved address
      // in its title attribute.
      await expect(
        page.getByTitle(selectedAddress, { exact: false }),
      ).toBeAttached({
        timeout: 10_000,
      });

      // 6. The system calculates recommendations for the next four days.
      const recommendationsSection = page
        .getByRole('heading', {
          name: 'המלצות רכבים',
        })
        .locator('xpath=..');

      await expect(
        page.getByText('טוען המלצות…'),
      ).toHaveCount(0, {
        timeout: 15_000,
      });

      let recommendationButtons =
        recommendationsSection.locator('ul button');

      /*
       * A recommendation requires real seeded data:
       * at least one upcoming task within 20 km of the searched address.
       *
       * If a transient request/authentication failure occurs, clear the
       * draft and select the address again to re-trigger the Server Action.
       */
      await expect(async () => {
        if ((await recommendationButtons.count()) === 0) {
          await page
            .getByRole('button', { name: 'נקה חיפוש' })
            .click();

          await searchAndSelectAddress();

          await expect(
            page.getByText('טוען המלצות…'),
          ).toHaveCount(0, {
            timeout: 15_000,
          });

          recommendationButtons =
            recommendationsSection.locator('ul button');
        }

        await expect(
          recommendationButtons.first(),
        ).toBeVisible({
          timeout: 5_000,
        });
      }).toPass({
        timeout: 60_000,
        intervals: [2_000, 5_000, 10_000],
      });

      // 7. Recommendations are displayed from nearest to farthest.
      const distances = await recommendationButtons
        .locator('span')
        .filter({ hasText: /ק״מ$/ })
        .allTextContents();

      expect(distances.length).toBeGreaterThan(0);

      const parsedDistances = distances.map((value) =>
        parseFloat(value),
      );

      const sortedDistances = [...parsedDistances].sort(
        (a, b) => a - b,
      );

      expect(parsedDistances).toEqual(sortedDistances);

      // 8. Dispatcher selects the first recommendation.
      const firstRecommendation =
        recommendationButtons.first();

      await firstRecommendation.click();

      // 9. Dashboard navigates to the recommended workday.
      await expect(page).toHaveURL(
        /\?date=\d{4}-\d{2}-\d{2}/,
      );

      // 10. The searched address remains available so the dispatcher
      // can compare the new location with the existing day's schedule.
      await expect(
        page.getByText(selectedAddress).first(),
      ).toBeVisible();

      // No unexpected browser-side errors should occur.
      expect(
        consoleErrors,
        `Unexpected console errors: ${consoleErrors.join('\n')}`,
      ).toEqual([]);
    },
  );
});