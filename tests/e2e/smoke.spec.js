const { test, expect } = require('@playwright/test');

test('pipeline renders locally without crashing', async ({ page }) => {

  // 1. Block ALL external requests - only allow localhost through.
  // This prevents Google Fonts, Supabase API, etc. from hanging the page load.
  await page.route('**/*', async route => {
    const url = route.request().url();
    if (url.includes('127.0.0.1') || url.includes('localhost')) {
      await route.continue();
    } else {
      await route.abort();
    }
  });

  // 2. Mock the Supabase Auth Session in localStorage BEFORE navigating
  // This ensures the app doesn't get stuck on a login screen
  await page.addInitScript(() => {
    window.localStorage.setItem('supabase.auth.token', JSON.stringify({
      currentSession: {
        access_token: 'fake-token',
        user: { email: 'test@sorted.io', role: 'authenticated' }
      },
      expiresAt: Math.floor(Date.now() / 1000) + 3600
    }));
  });

  // 3. Load the local app (uses baseURL from config)
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  // 4. Wait for network to settle
  await page.waitForLoadState('networkidle', { timeout: 10000 });

  // 5. Hard verification: Ensure we are actually looking at the pipeline, not a blank screen or login wall
  const pipelineContainer = page.locator('#pipeline-container');
  await expect(pipelineContainer).toBeAttached({ timeout: 5000 });

  // Verify basic app shell exists
  const bodyText = await page.evaluate(() => document.body.innerHTML.length);
  expect(bodyText).toBeGreaterThan(500);

  // Take a proof screenshot
  await page.screenshot({ path: 'tests/e2e/screenshots/smoke.png' });
});
