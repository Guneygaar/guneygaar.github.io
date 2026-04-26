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
  await expect(page.locator('#pcs-react-overlay')).toBeVisible({ timeout: 5000 });
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

  await expect(page.locator('#pcs-react-overlay')).toBeVisible();

  // Title renders as an <h1> inside the React overlay.
  const title = page.locator('#pcs-react-overlay h1').first();
  await expect(title).toBeVisible();
  await expect(title).not.toBeEmpty();

  // Tabs.jsx renders text-only tab buttons under #pcs-react-overlay; "Comments"
  // replaces the legacy "Client" tab.
  const commentsTab = page.locator('#pcs-react-overlay button', { hasText: 'Comments' }).first();
  await expect(commentsTab).toBeVisible({ timeout: 5000 });
  await commentsTab.click();

  await expect(page.locator('#pcs-react-overlay')).toContainText(
    'This looks great, approve it.',
    { timeout: 5000 }
  );

  await page.screenshot({ path: 'tests/e2e/screenshots/pcs-open.png' });
});

test('TEST 2 — PCS closes correctly', async ({ page }) => {
  await openPCSCard(page);
  await expect(page.locator('#pcs-react-overlay')).toBeVisible();

  // React PCS has no backdrop click region — close via the topbar Close button.
  await page.locator('#pcs-react-overlay [aria-label="Close"]').click();

  // PCS overlay should unmount
  await expect(page.locator('#pcs-react-overlay')).toHaveCount(0, { timeout: 3000 });

  await page.screenshot({ path: 'tests/e2e/screenshots/pcs-closed.png' });
});

test('TEST 3 — Comment input works', async ({ page }) => {
  await openPCSCard(page);

  // Comments tab must be active for Composer to render in the comments tree.
  await page.locator('#pcs-react-overlay button', { hasText: 'Comments' }).first().click();

  // Composer.jsx wraps its root in [data-composer]; textarea is ref-only,
  // send button is reachable by aria-label.
  const composer = page.locator('#pcs-react-overlay [data-composer]');
  await expect(composer).toBeVisible({ timeout: 5000 });

  const input = composer.locator('textarea').first();
  await expect(input).toBeVisible({ timeout: 5000 });

  await input.fill('Test comment from Playwright');
  await expect(input).toHaveValue('Test comment from Playwright');

  await expect(composer.locator('[aria-label="Send"]')).toBeVisible({ timeout: 5000 });

  await page.screenshot({ path: 'tests/e2e/screenshots/pcs-comment.png' });
});

test('TEST 4 — Stage pill shows current stage label', async ({ page }) => {
  await openPCSCard(page);

  // KickerRow.jsx renders the stage label inside the topbar (the second
  // <span> of the canMove button when admin can move the stage). Stage label
  // is uppercase: STAGE_LABELS[mockPost.stage='ready'] -> 'READY'.
  const stagePill = page.locator('#pcs-react-overlay header button', { hasText: 'READY' }).first();
  await expect(stagePill).toBeVisible({ timeout: 5000 });
  await expect(stagePill).not.toBeEmpty();

  await page.screenshot({ path: 'tests/e2e/screenshots/pcs-stage-label.png' });
});

test('TEST 5 — Image renders in PCS', async ({ page }) => {
  await openPCSCard(page);

  // PhotoStrip.jsx renders ThumbImg <img> elements inside the
  // overflow-x-auto carousel under #pcs-react-overlay.
  const img = page.locator('#pcs-react-overlay .overflow-x-auto img').first();
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

  // PR-2.2 replaced the popover dropdown with a full-screen BottomSheet:
  // tapping the stage pill in KickerRow opens PcsDetailSheet expanded on
  // the "stage" SheetRow, which reveals StageOptions buttons.
  const stagePill = page.locator('#pcs-react-overlay header button', { hasText: 'READY' }).first();
  await expect(stagePill).toBeVisible({ timeout: 5000 });
  await stagePill.click();

  // Stage SheetRow exposes a data-field attribute we can use as scope.
  const stageRow = page.locator('[data-field="stage"]');
  await expect(stageRow).toBeVisible({ timeout: 3000 });

  // At least one stage option button rendered inside the sheet.
  await expect(stageRow.locator('button').first()).toBeVisible({ timeout: 3000 });

  // BottomSheet backdrop click dismisses the sheet (CommentSheet wraps the
  // entire viewport with a fixed inset-0 backdrop at z-index 2699).
  await page.locator('div.fixed.inset-0.bg-black\\/50').first().click({ position: { x: 5, y: 5 } });

  // PCS overlay still visible and functional (no crash)
  await expect(page.locator('#pcs-react-overlay')).toBeVisible();

  await page.screenshot({ path: 'tests/e2e/screenshots/pcs-stage-pill.png' });
});

test('TEST 8 — PCS handles delete flow initialization', async ({ page }) => {
  await openPCSCard(page);

  // Open the metadata sheet (KickerRow [aria-label="Post details"] in the
  // topbar opens PcsDetailSheet which contains the Danger Zone delete row).
  await page.locator('#pcs-react-overlay [aria-label="Post details"]').click();

  // Tap the React delete trigger (admin-only).
  const deleteTrigger = page.locator('[data-testid="pcs-detail-delete-trigger"]');
  await expect(deleteTrigger).toBeVisible({ timeout: 3000 });
  await deleteTrigger.click();

  // PostDeleteConfirm modal renders with Cancel + Delete + post preview.
  const confirm = page.locator('[data-testid="post-delete-confirm"]');
  await expect(confirm).toBeVisible({ timeout: 3000 });
  await expect(confirm).toContainText(/delete|undone/i);
  await expect(confirm).toContainText('PCS Smoke Test Post');

  // Cancel button dismisses the modal without deleting.
  await page.locator('[data-testid="post-delete-confirm-cancel"]').click();
  await expect(confirm).toHaveCount(0, { timeout: 2000 });

  // PCS overlay must still be open after a cancelled delete.
  await expect(page.locator('#pcs-react-overlay')).toBeVisible();

  await page.screenshot({ path: 'tests/e2e/screenshots/pcs-delete.png' });
});

// TODO PR-3.16: Library tile taps call vanilla _renderPCS bypassing React PCS bridge.
// 09-library.js libOpenPostCard must route through window.openPCS or pcsFlow.open.
// Re-enable once library bridge migrates. Currently opens dormant vanilla overlay.
test.skip('TEST 9 — Library bypass opens PCS', async ({ page }) => {
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
  await expect(page.locator('#pcs-react-overlay')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('#pcs-react-overlay h1')).toBeVisible();

  await page.screenshot({ path: 'tests/e2e/screenshots/pcs-library-bypass.png' });
});
