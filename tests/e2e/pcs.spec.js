const { test, expect } = require('@playwright/test');

// ── Mock Data ───────────────────────────────────────────────
const mockPost = {
  id: 'uuid-pcs-test',
  post_id: 'POST-PCS-TEST',
  title: 'PCS Smoke Test Post',
  stage: 'ready',
  owner: 'Pranav',
  content_pillar: 'innovation',
  location: 'Mumbai',
  target_date: '2026-04-15',
  status_changed_at: '2026-03-27T10:00:00+00:00',
  caption: 'This is a test caption for PCS smoke test.',
  images: ['https://picsum.photos/400/300'],
  linkedin_link: null,
  canva_link: null,
  format: 'carousel',
  _commentCount: 2
};

const mockComment = {
  id: 'comment-uuid-1',
  post_id: 'POST-PCS-TEST',
  author: 'Chitra',
  author_role: 'Servicing',
  message: 'This looks great, approve it.',
  created_at: '2026-03-27T10:00:00+00:00',
  read: false
};

// ── Shared Helper ───────────────────────────────────────────
async function openPCSCard(page) {
  // Wait for pipeline to render the mock post
  const card = page.locator('text=PCS Smoke Test Post').first();
  await expect(card).toBeVisible({ timeout: 5000 });

  // Click the post card to open PCS
  await card.click();

  // Wait for PCS overlay to appear
  await expect(page.locator('#pcs-overlay')).toBeVisible({ timeout: 5000 });
}

// ── Setup ───────────────────────────────────────────────────
test.beforeEach(async ({ page }) => {
  // Intercept all network requests
  await page.route('**/*', async route => {
    const url = route.request().url();
    const method = route.request().method();

    // Mock Supabase REST endpoints
    if (url.includes('/rest/v1/posts')) {
      if (method === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([mockPost]) });
      } else {
        // PATCH/DELETE — return success
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([mockPost]) });
      }
    } else if (url.includes('/rest/v1/post_comments')) {
      if (method === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([mockComment]) });
      } else {
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({}) });
      }
    } else if (url.includes('/rest/v1/notifications')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    } else if (url.includes('/rest/v1/activity_log')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    } else if (url.includes('/rest/v1/')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    } else if (url.includes('/auth/v1/')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'fake-token', user: { email: 'test@sorted.io' } }) });
    } else if (url.includes('picsum.photos')) {
      await route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
      });
    } else if (url.includes('127.0.0.1') || url.includes('localhost')) {
      await route.continue();
    } else {
      await route.abort();
    }
  });

  // Inject auth to bypass login
  await page.addInitScript(() => {
    window.localStorage.setItem('hinglish_role', 'Admin');
    window.localStorage.setItem('sb_access_token', 'fake-token');
    window.localStorage.setItem('hinglish_email', 'test@sorted.io');
    window.localStorage.setItem('hinglish_name', 'Test Admin');
  });

  // Load the app
  await page.goto('/', { waitUntil: 'domcontentloaded' });
});

// ── Tests ───────────────────────────────────────────────────

test('TEST 1 — PCS opens and renders correctly', async ({ page }) => {
  await openPCSCard(page);

  await expect(page.locator('#pcs-overlay')).toBeVisible();
  await expect(page.locator('#pcs-topbar-title')).toBeVisible();
  await expect(page.locator('#pcs-topbar-title')).not.toBeEmpty();
  await expect(page.locator('.pcs-tab-bar')).toBeVisible();

  // Client tab is where comments render; Caption is the default tab.
  await page.locator('.pcs-tab[data-tab="client"]').click();
  await expect(page.locator('#pcs-comments-list')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('#pcs-comments-list')).toContainText('This looks great, approve it.', { timeout: 5000 });

  await page.screenshot({ path: 'tests/e2e/screenshots/pcs-open.png' });
});

test('TEST 2 — PCS closes correctly', async ({ page }) => {
  await openPCSCard(page);
  await expect(page.locator('#pcs-overlay')).toBeVisible();

  // Click backdrop area (top-left corner of overlay)
  await page.locator('#pcs-overlay').click({ position: { x: 10, y: 10 } });

  // PCS overlay should be hidden
  await expect(page.locator('#pcs-overlay')).not.toBeVisible({ timeout: 3000 });

  await page.screenshot({ path: 'tests/e2e/screenshots/pcs-closed.png' });
});

test('TEST 3 — Comment input works', async ({ page }) => {
  await openPCSCard(page);

  // Client tab must be active for the comment input to be visible.
  await page.locator('.pcs-tab[data-tab="client"]').click();

  const input = page.locator('#pcs-comment-input');
  await expect(input).toBeVisible({ timeout: 5000 });

  await input.fill('Test comment from Playwright');
  await expect(input).toHaveValue('Test comment from Playwright');

  await expect(page.locator('#pcs-send-btn-client')).toBeVisible({ timeout: 5000 });

  await page.screenshot({ path: 'tests/e2e/screenshots/pcs-comment.png' });
});

test('TEST 4 — Stage pill shows current stage label', async ({ page }) => {
  await openPCSCard(page);

  // Advance button was removed from the redesign; the stage pill
  // in the PCS topbar now shows the current stage label.
  const stagePill = page.locator('#pcs-stage-pill');
  await expect(stagePill).toBeVisible({ timeout: 5000 });
  await expect(stagePill).not.toBeEmpty();

  await page.screenshot({ path: 'tests/e2e/screenshots/pcs-stage-label.png' });
});

test('TEST 5 — Image renders in PCS', async ({ page }) => {
  await openPCSCard(page);

  const img = page.locator('#pcs-photo-grid-wrap img').first();
  await expect(img).toBeVisible({ timeout: 5000 });

  await page.screenshot({ path: 'tests/e2e/screenshots/pcs-image.png' });
});

test('TEST 6 — PCS caption is visible', async ({ page }) => {
  await openPCSCard(page);

  await expect(page.locator('text=This is a test caption for PCS smoke test.')).toBeVisible({ timeout: 5000 });

  await page.screenshot({ path: 'tests/e2e/screenshots/pcs-caption.png' });
});

test('TEST 7 — PCS stage pill opens dropdown', async ({ page }) => {
  await openPCSCard(page);

  const stagePill = page.locator('#pcs-stage-pill');
  await expect(stagePill).toBeVisible({ timeout: 5000 });

  // Click the stage pill to open the chip dropdown
  await stagePill.click();

  // Assert the dropdown rendered at least one option
  await expect(page.locator('.pcs-chip-drop-item').first()).toBeVisible({ timeout: 3000 });

  // Dismiss the dropdown by clicking outside
  await page.locator('#pcs-screen').click({ position: { x: 10, y: 10 } });

  // Page should still be functional (no crash)
  await expect(page.locator('#pcs-screen')).toBeVisible();

  await page.screenshot({ path: 'tests/e2e/screenshots/pcs-stage-pill.png' });
});

test('TEST 8 — PCS handles delete flow initialization', async ({ page }) => {
  await openPCSCard(page);

  // Delete no longer has a PCS topbar trigger; invoke the confirm
  // overlay directly so we still cover the pcsConfirmDelete path.
  await page.evaluate(() => window.pcsConfirmDelete && window.pcsConfirmDelete());

  // Confirm overlay should appear (custom modal, not native dialog)
  await expect(page.locator('.pcs-confirm-overlay')).toBeVisible({ timeout: 3000 });
  await expect(page.locator('.pcs-confirm-overlay')).toContainText(/delete|sure/i);

  // Dismiss by clicking Cancel
  await page.locator('.pcs-confirm-cancel').click();
  await expect(page.locator('.pcs-confirm-overlay')).not.toBeVisible({ timeout: 2000 });

  await page.screenshot({ path: 'tests/e2e/screenshots/pcs-delete.png' });
});

test('TEST 9 — Library bypass opens PCS', async ({ page }) => {
  // Click Library tab
  const libTab = page.locator('[data-tab="library"]');
  await expect(libTab).toBeVisible({ timeout: 5000 });
  await libTab.click();

  // Wait for library view to render
  await expect(page.locator('#library-view')).toBeVisible({ timeout: 5000 });

  // Library loads its own data via libLoadPosts, which also hits /rest/v1/posts
  // Wait for the post card to appear in the library list
  const libCard = page.locator('#library-view').locator('text=PCS Smoke Test Post').first();
  await expect(libCard).toBeVisible({ timeout: 5000 });

  // Click the library card
  await libCard.click();

  // Library opens its own card overlay first (lib-card-overlay),
  // then "Open Post Card" button bridges to PCS
  const libOverlay = page.locator('#lib-card-overlay');
  if (await libOverlay.isVisible({ timeout: 2000 }).catch(() => false)) {
    // If library card overlay appeared, click "Open Post Card" to bridge to PCS
    const openPcsBtn = page.locator('text=Open Post Card');
    if (await openPcsBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await openPcsBtn.click();
    }
  }

  // PCS should now be open
  await expect(page.locator('#pcs-overlay')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('#pcs-topbar-title')).toBeVisible();

  await page.screenshot({ path: 'tests/e2e/screenshots/pcs-library-bypass.png' });
});
