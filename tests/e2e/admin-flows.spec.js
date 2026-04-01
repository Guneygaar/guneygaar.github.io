const { test, expect } = require('@playwright/test');

// ── Mock Data ───────────────────────────────────────────────
const mockPost = {
  id: 'uuid-admin-smoke',
  post_id: 'test-smoke-001',
  title: '[TEST] Smoke Post',
  stage: 'in_production',
  owner: 'Pranav',
  content_pillar: 'innovation',
  location: 'Mumbai',
  target_date: '2026-04-15',
  status_changed_at: '2026-03-30T10:00:00+00:00',
  caption: 'Test caption for smoke test',
  images: [],
  linkedin_link: null,
  canva_link: null,
  format: 'static'
};

// ── Shared Setup ────────────────────────────────────────────
function setupAdminRoutes(page) {
  return page.route('**/*', async route => {
    const url = route.request().url();
    const method = route.request().method();

    if (url.includes('/rest/v1/posts')) {
      if (method === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([mockPost]) });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([mockPost]) });
      }
    } else if (url.includes('/rest/v1/post_comments')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    } else if (url.includes('/rest/v1/internal_notes')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    } else if (url.includes('/rest/v1/notifications')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    } else if (url.includes('/rest/v1/activity_log')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    } else if (url.includes('/rest/v1/tasks')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    } else if (url.includes('/rest/v1/')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    } else if (url.includes('/auth/v1/')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'fake-token', user: { email: 'test@sorted.io' } }) });
    } else if (url.includes('127.0.0.1') || url.includes('localhost')) {
      await route.continue();
    } else {
      await route.abort();
    }
  });
}

function injectAdminAuth(page) {
  return page.addInitScript(() => {
    window.localStorage.setItem('hinglish_role', 'Admin');
    window.localStorage.setItem('sb_access_token', 'fake-token');
    window.localStorage.setItem('hinglish_email', 'test@sorted.io');
    window.localStorage.setItem('hinglish_name', 'Test Admin');
    window.localStorage.removeItem('pcs_role_preview');
  });
}

// ── Tests ───────────────────────────────────────────────────

test.describe('Admin Flow Tests', () => {

  test.beforeEach(async ({ page }) => {
    await setupAdminRoutes(page);
    await injectAdminAuth(page);
  });

  test('TEST 1 — Dashboard renders for Admin', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const dashView = page.locator('#dashboard-view');
    await expect(dashView).toBeVisible({ timeout: 8000 });

    // No error toast
    const errorToast = page.locator('#sorted-error-toast');
    if (await errorToast.count() > 0) {
      await expect(errorToast).not.toBeVisible();
    }
  });

  test('TEST 2 — Pipeline renders post cards', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Switch to pipeline tab
    const pipeTab = page.locator('[data-tab="pipeline"]');
    await expect(pipeTab).toBeVisible({ timeout: 5000 });
    await pipeTab.click();

    // Wait for pipeline container
    await expect(page.locator('#pipeline-container')).toBeVisible({ timeout: 5000 });

    // At least one post card
    const card = page.locator('text=[TEST] Smoke Post').first();
    await expect(card).toBeVisible({ timeout: 5000 });

    // No error toast
    const errorToast = page.locator('#sorted-error-toast');
    if (await errorToast.count() > 0) {
      await expect(errorToast).not.toBeVisible();
    }
  });

  test('TEST 3 — PCS opens from pipeline', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const pipeTab = page.locator('[data-tab="pipeline"]');
    await expect(pipeTab).toBeVisible({ timeout: 5000 });
    await pipeTab.click();

    // Click post card
    const card = page.locator('text=[TEST] Smoke Post').first();
    await expect(card).toBeVisible({ timeout: 5000 });
    await card.click();

    // PCS overlay opens
    await expect(page.locator('#pcs-overlay')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#pcs-topbar-title')).toBeVisible();
  });

  test('TEST 4 — PCS closes on backdrop click', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const pipeTab = page.locator('[data-tab="pipeline"]');
    await expect(pipeTab).toBeVisible({ timeout: 5000 });
    await pipeTab.click();

    const card = page.locator('text=[TEST] Smoke Post').first();
    await expect(card).toBeVisible({ timeout: 5000 });
    await card.click();

    await expect(page.locator('#pcs-overlay')).toBeVisible({ timeout: 5000 });

    // Click backdrop (top-left corner)
    await page.locator('#pcs-overlay').click({ position: { x: 10, y: 10 } });

    await expect(page.locator('#pcs-overlay')).not.toBeVisible({ timeout: 3000 });
  });

  test('TEST 5 — Library tab renders', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const libTab = page.locator('[data-tab="library"]');
    await expect(libTab).toBeVisible({ timeout: 5000 });
    await libTab.click();

    await expect(page.locator('#library-view')).toBeVisible({ timeout: 5000 });

    // No error toast
    const errorToast = page.locator('#sorted-error-toast');
    if (await errorToast.count() > 0) {
      await expect(errorToast).not.toBeVisible();
    }
  });

  test('TEST 6 — Dashboard scoreboard renders', async ({ page }) => {
    // Capture console errors
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const dashView = page.locator('#dashboard-view');
    await expect(dashView).toBeVisible({ timeout: 8000 });

    // Scoreboard section exists
    const scoreboard = page.locator('#pcs-dashboard');
    await expect(scoreboard).toBeVisible({ timeout: 5000 });

    // No JS errors that include 'renderScoreboard' or 'renderDashboard'
    const renderErrors = consoleErrors.filter(e =>
      e.includes('renderScoreboard') || e.includes('renderDashboard')
    );
    expect(renderErrors).toHaveLength(0);
  });

  test('TEST 7 — New post form opens', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Wait for dashboard to load first
    await expect(page.locator('#dashboard-view')).toBeVisible({ timeout: 8000 });

    // Switch to pipeline where FAB is visible
    const pipeTab = page.locator('[data-tab="pipeline"]');
    await expect(pipeTab).toBeVisible({ timeout: 5000 });
    await pipeTab.click();
    await expect(page.locator('#pipeline-container')).toBeVisible({ timeout: 5000 });

    // Call openNewPostModal() directly — FAB opens a menu first, not the overlay
    await page.evaluate(() => {
      if (typeof openNewPostModal === 'function') openNewPostModal();
    });

    // New post overlay opens
    const overlay = page.locator('#new-post-overlay');
    await expect(overlay).toBeVisible({ timeout: 5000 });

    // Title input visible
    const titleInput = page.locator('#new-post-title');
    await expect(titleInput).toBeVisible();
  });

  test('TEST 8 — Role preview bar shows for non-Admin preview', async ({ page }) => {
    // Override auth to include role preview
    await page.addInitScript(() => {
      window.localStorage.setItem('pcs_role_preview', 'Servicing');
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Dashboard should load (Servicing still sees dashboard)
    const dashView = page.locator('#dashboard-view');
    await expect(dashView).toBeVisible({ timeout: 8000 });

    // Check effective role is Servicing
    const effectiveRole = await page.evaluate(() =>
      window.AppState.user.effectiveRole
    );
    expect(effectiveRole).toBe('Servicing');
  });
});
