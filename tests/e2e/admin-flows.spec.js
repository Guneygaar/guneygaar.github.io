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
    } else if (url.includes('/rest/v1/plans')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    } else if (url.includes('/rest/v1/plan_cells')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    } else if (url.includes('/rest/v1/workspaces')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 'test-ws', slug: 'default' }]) });
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

function injectServicingAuth(page) {
  return page.addInitScript(() => {
    window.localStorage.setItem('hinglish_role', 'Servicing');
    window.localStorage.setItem('sb_access_token', 'fake-token');
    window.localStorage.setItem('hinglish_email', 'servicing@sorted.io');
    window.localStorage.setItem('hinglish_name', 'Test Servicing');
    window.localStorage.removeItem('pcs_role_preview');
  });
}

function injectCreativeAuth(page) {
  return page.addInitScript(() => {
    window.localStorage.setItem('hinglish_role', 'Creative');
    window.localStorage.setItem('sb_access_token', 'fake-token');
    window.localStorage.setItem('hinglish_email', 'creative@sorted.io');
    window.localStorage.setItem('hinglish_name', 'Test Creative');
    window.localStorage.removeItem('pcs_role_preview');
  });
}

// Asserts Plan-as-home: body.plan-active OR #panel-pipeline visible.
async function expectPlanLanding(page) {
  await page.waitForFunction(() => {
    const planActive = document.body.classList.contains('plan-active');
    const panel = document.getElementById('panel-pipeline');
    const panelVisible = !!panel && getComputedStyle(panel).display !== 'none';
    return planActive || panelVisible;
  }, null, { timeout: 8000 });
}

// ── Tests ───────────────────────────────────────────────────

test.describe('Admin Flow Tests', () => {

  test.beforeEach(async ({ page }) => {
    await setupAdminRoutes(page);
    await injectAdminAuth(page);
  });

  test('TEST 1 — Admin lands on Plan', async ({ page }) => {
    await page.goto('/?plan_react=1', { waitUntil: 'domcontentloaded' });

    await expectPlanLanding(page);

    // No error toast
    const errorToast = page.locator('#sorted-error-toast');
    if (await errorToast.count() > 0) {
      await expect(errorToast).not.toBeVisible();
    }
  });

  test('TEST 2 — Pipeline renders post cards', async ({ page }) => {
    await page.goto('/?plan_react=0', { waitUntil: 'domcontentloaded' });

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
    await page.goto('/?plan_react=0', { waitUntil: 'domcontentloaded' });

    const pipeTab = page.locator('[data-tab="pipeline"]');
    await expect(pipeTab).toBeVisible({ timeout: 5000 });
    await pipeTab.click();

    // Click post card
    const card = page.locator('text=[TEST] Smoke Post').first();
    await expect(card).toBeVisible({ timeout: 5000 });
    await card.click();

    // PCS overlay opens
    await expect(page.locator('#pcs-react-overlay')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#pcs-react-overlay h1')).toBeVisible();
  });

  test('TEST 4 — PCS closes via topbar Close button', async ({ page }) => {
    await page.goto('/?plan_react=0', { waitUntil: 'domcontentloaded' });

    const pipeTab = page.locator('[data-tab="pipeline"]');
    await expect(pipeTab).toBeVisible({ timeout: 5000 });
    await pipeTab.click();

    await expect(page.locator('#pipeline-container')).toBeVisible({ timeout: 5000 });

    const card = page.locator('text=[TEST] Smoke Post').first();
    await expect(card).toBeVisible({ timeout: 5000 });
    await card.click();

    await expect(page.locator('#pcs-react-overlay')).toBeVisible({ timeout: 5000 });

    // React PCS has no backdrop click region — close via the topbar Close button.
    await page.locator('#pcs-react-overlay [aria-label="Close"]').click();

    await expect(page.locator('#pcs-react-overlay')).toHaveCount(0, { timeout: 3000 });
  });

  test('TEST 5 — Library tab renders', async ({ page }) => {
    await page.goto('/?plan_react=0', { waitUntil: 'domcontentloaded' });

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

  test('TEST 6 — Servicing role lands on Plan', async ({ page, context }) => {
    // Override admin auth with servicing creds before navigation.
    await context.clearCookies();
    await injectServicingAuth(page);

    await page.goto('/?plan_react=1', { waitUntil: 'domcontentloaded' });

    await expectPlanLanding(page);

    const effectiveRole = await page.evaluate(() =>
      window.AppState && window.AppState.user && window.AppState.user.effectiveRole
    );
    expect(effectiveRole).toBe('Servicing');
  });

  test('TEST 7 — New post form opens', async ({ page }) => {
    await page.goto('/?plan_react=0', { waitUntil: 'domcontentloaded' });

    // Wait for openNewPostModal to be defined (vanilla bundle ready).
    await page.waitForFunction(() => typeof window.openNewPostModal === 'function', null, { timeout: 8000 });

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

  test('TEST 8 — Admin role preview lands on Plan', async ({ page }) => {
    // Override auth to include role preview
    await page.addInitScript(() => {
      window.localStorage.setItem('pcs_role_preview', 'Servicing');
    });

    await page.goto('/?plan_react=1', { waitUntil: 'domcontentloaded' });

    await expectPlanLanding(page);

    // Check effective role is Servicing (preview)
    const effectiveRole = await page.evaluate(() =>
      window.AppState && window.AppState.user && window.AppState.user.effectiveRole
    );
    expect(effectiveRole).toBe('Servicing');
  });

  test('TEST 9 — Creative role lands on Plan', async ({ page, context }) => {
    await context.clearCookies();
    await injectCreativeAuth(page);

    await page.goto('/?plan_react=1', { waitUntil: 'domcontentloaded' });

    await expectPlanLanding(page);

    const effectiveRole = await page.evaluate(() =>
      window.AppState && window.AppState.user && window.AppState.user.effectiveRole
    );
    expect(effectiveRole).toBe('Creative');
  });
});
