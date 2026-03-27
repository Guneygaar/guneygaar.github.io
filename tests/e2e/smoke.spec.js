const { test, expect } = require('@playwright/test');

test('pipeline bypasses login and renders post cards locally', async ({ page }) => {
  // 1. Block external requests, mock Supabase API, allow localhost
  const MOCK_POST = [{
    id: 'uuid-smoke-test',
    post_id: 'POST-SMOKE',
    title: 'CTO Smoke Test Post',
    stage: 'ready',
    owner: 'Pranav',
    content_pillar: 'innovation',
    target_date: '2026-04-01'
  }];

  await page.route('**/*', async route => {
    const url = route.request().url();
    // Return mock post for posts endpoint
    if (url.includes('/rest/v1/posts')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_POST) });
    // Return empty array for other Supabase REST calls
    } else if (url.includes('/rest/v1/')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    // Allow local server requests through
    } else if (url.includes('127.0.0.1') || url.includes('localhost')) {
      await route.continue();
    // Block everything else (Google Fonts, etc.)
    } else {
      await route.abort();
    }
  });

  // 2. Inject exact auth keys to bypass login
  await page.addInitScript(() => {
    window.localStorage.setItem('hinglish_role', 'Admin');
    window.localStorage.setItem('sb_access_token', 'fake-token');
    window.localStorage.setItem('hinglish_email', 'test@sorted.io');
    window.localStorage.setItem('hinglish_name', 'Test');
  });

  // 3. Load the app
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  // 4. Assert a specific mock post card rendered on screen
  const mockPostCard = page.locator('text=CTO Smoke Test Post').first();
  await expect(mockPostCard).toBeVisible({ timeout: 5000 });

  // 5. Take a proof screenshot
  await page.screenshot({ path: 'tests/e2e/screenshots/smoke-rendered.png' });
});
