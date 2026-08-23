import { expect, test } from '@playwright/test';

/**
 * E2E-02 - New Service Task Decision-Support Flow (test specification section 16).
 *
 * Requires a controlled test environment (see specification section 3) whose
 * `service_tasks` table has at least one routable task scheduled within the
 * next four days and within 20 km of E2E_SEARCH_ADDRESS, plus a dispatcher
 * account to sign in with. Credentials and the search address are read from
 * the environment rather than hard-coded so the same test can target any
 * seeded environment without editing the file, and so no real credentials
 * are committed to the repo. This test hits the real Mapbox Geocoding API
 * (per spec section 3, a smaller set of E2E tests may use the live service).
 *
 * Success criteria (per the spec): the dispatcher can use the dashboard to
 * evaluate a potential new-task assignment without modifying SAP data.
 */

const DISPATCHER_EMAIL = process.env.E2E_DISPATCHER_EMAIL;
const DISPATCHER_PASSWORD = process.env.E2E_DISPATCHER_PASSWORD;
const SEARCH_ADDRESS = process.env.E2E_SEARCH_ADDRESS;

test.describe('E2E-02 - New Service Task Decision-Support Flow', () => {
  test.skip(
    !DISPATCHER_EMAIL || !DISPATCHER_PASSWORD || !SEARCH_ADDRESS,
    'Set E2E_DISPATCHER_EMAIL, E2E_DISPATCHER_PASSWORD, and E2E_SEARCH_ADDRESS (an address with a seeded ' +
      'recommendation candidate within 20 km in the next 4 days) to run this test.',
  );

  test('dispatcher searches an address, reviews recommendations, and jumps to the recommended workday', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => consoleErrors.push(error.message));

    // 8. Dispatcher signs in.
    await page.goto('http://localhost:3000/');
    await expect(page).toHaveURL(/\/login/);
    await page.getByLabel('Email').fill(DISPATCHER_EMAIL!);
    await page.getByLabel('Password').fill(DISPATCHER_PASSWORD!);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL('http://localhost:3000/');
    await expect(page.getByRole('heading', { name: 'Daily Service Routes' })).toBeVisible();

    // 9-10. Dispatcher searches for a new service address and selects the
    // correct suggestion. Scoped to the suggestions list rendered next to the
    // search input — the sidebar's vehicle legend is also a <ul> of buttons,
    // so an unscoped `ul button` would be ambiguous. Wrapped in a helper
    // because the recommendations wait below needs to redo this step to
    // re-trigger the fetch on a transient auth failure.
    const searchInput = page.getByPlaceholder('Search address...');
    const suggestionsList = searchInput.locator('xpath=../following-sibling::ul');
    let selectedAddress: string | null = null;

    const searchAndSelectAddress = async () => {
      await searchInput.fill('');
      await searchInput.fill(SEARCH_ADDRESS!);
      const firstSuggestion = suggestionsList.locator('button').first();
      await expect(firstSuggestion).toBeVisible({ timeout: 10_000 });
      selectedAddress = await firstSuggestion.textContent();
      await firstSuggestion.click();
      await expect(page.getByText(selectedAddress!.trim())).toBeVisible();
    };

    await searchAndSelectAddress();

    // 11. The location appears on the map (asserted inside the helper above).

    // 12. The system calculates upcoming vehicle/date recommendations.
    //
    // Supabase can log a transient "JWT issued at future" clock-skew warning
    // right after sign-in, which rejects the first recommendations request
    // with an auth error before the client refreshes its session token. The
    // app doesn't auto-retry a failed fetch, so waiting longer on its own
    // wouldn't help — instead, retry the address selection itself (which
    // re-fires the recommendations fetch) until it succeeds or we give up.
    const recommendationButtons = page.locator('h3', { hasText: 'Vehicle Recommendations' })
      .locator('xpath=following-sibling::*[1]')
      .locator('button');

    await expect(async () => {
      await expect(page.getByText('Loading recommendations…')).toHaveCount(0, { timeout: 10_000 });
      if ((await recommendationButtons.count()) === 0) {
        await page.getByRole('button', { name: 'Clear Search' }).click();
        await searchAndSelectAddress();
      }
      await expect(recommendationButtons.first()).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 60_000, intervals: [2_000, 5_000, 10_000] });

    // 13. Recommendations are displayed in distance order.
    const distances = await recommendationButtons
      .locator('span')
      .filter({ hasText: /km$/ })
      .allTextContents();
    const parsedDistances = distances.map((value) => parseFloat(value));
    const sortedDistances = [...parsedDistances].sort((a, b) => a - b);
    expect(parsedDistances).toEqual(sortedDistances);

    // 14. Dispatcher selects a recommendation.
    const firstRecommendation = recommendationButtons.first();
    const recommendationDateText = await firstRecommendation.locator('span').first().textContent();

    // 15. Dashboard navigates to the relevant workday.
    await firstRecommendation.click();
    await expect(page).toHaveURL(/\?date=\d{4}-\d{2}-\d{2}/);

    // 16. Dispatcher compares the new location with the existing schedule —
    // the searched address and its recommendations stay visible for comparison.
    await expect(page.getByText(selectedAddress!.trim())).toBeVisible();
    await expect(page.getByText(recommendationDateText!.trim()).first()).toBeVisible();

    expect(consoleErrors, `Unexpected console errors: ${consoleErrors.join('\n')}`).toEqual([]);
  });
});
