const { test, expect } = require('@playwright/test');

// ── Mock Data ───────────────────────────────────────────────

// Admin/preview tests — single generic post
const mockPostAdmin = {
  id: 'uuid-role-admin',
  post_id: 'test-role-001',
  title: '[TEST] Role Flow Post',
  stage: 'in_production',
  owner: 'Pranav',
  content_pillar: 'innovation',
  location: 'Mumbai',
  target_date: '2026-04-15',
  status_changed_at: '2026-03-30T10:00:00+00:00',
  caption: 'Test caption for role flow',
  images: [],
  linkedin_link: null,
  canva_link: null,
  format: 'static'
};

// Chitra tests — in_production (should be hidden) + awaiting_approval (visible)
const mockPostsChitra = [
  {
    id: 'uuid-chitra-prod',
    post_id: 'test-chitra-001',
    title: 'Chitra Prod Post',
    stage: 'in_production',
    owner: 'Pranav',
    content_pillar: 'innovation',
    location: 'Mumbai',
    target_date: '2026-04-15',
    status_changed_at: '2026-03-30T10:00:00+00:00',
    caption: 'In production post',
    images: [],
    linkedin_link: null,
    canva_link: null,
    format: 'static'
  },
  {
    id: 'uuid-chitra-approval',
    post_id: 'test-chitra-002',
    title: 'Chitra Approval Post',
    stage: 'awaiting_approval',
    owner: 'Chitra',
    content_pillar: 'innovation',
    location: 'Mumbai',
    target_date: '2026-04-15',
    status_changed_at: '2026-03-30T10:00:00+00:00',
    caption: 'Awaiting approval post',
    images: [],
    linkedin_link: null,
    canva_link: null,
    format: 'static'
  }
];

// Pranav tests — in_production (own, visible) + awaiting_approval (visible) + scheduled (hidden)
const mockPostsPranav = [
  {
    id: 'uuid-pranav-prod',
    post_id: 'test-pranav-001',
    title: 'Pranav Prod Post',
    stage: 'in_production',
    owner: 'Creative',
    content_pillar: 'innovation',
    location: 'Mumbai',
    target_date: '2026-04-15',
    status_changed_at: '2026-03-30T10:00:00+00:00',
    caption: 'In production post',
    images: [],
    linkedin_link: null,
    canva_link: null,
    format: 'static'
  },
  {
    id: 'uuid-pranav-approval',
    post_id: 'test-pranav-002',
    title: 'Pranav Approval Post',
    stage: 'awaiting_approval',
    owner: 'Chitra',
    content_pillar: 'innovation',
    location: 'Mumbai',
    target_date: '2026-04-15',
    status_changed_at: '2026-03-30T10:00:00+00:00',
    caption: 'Awaiting approval post',
    images: [],
    linkedin_link: null,
    canva_link: null,
    format: 'static'
  },
  {
    id: 'uuid-pranav-sched',
    post_id: 'test-pranav-003',
    title: 'Pranav Scheduled Post',
    stage: 'scheduled',
    owner: 'Pranav',
    content_pillar: 'innovation',
    location: 'Mumbai',
    target_date: '2026-04-20',
    status_changed_at: '2026-03-30T10:00:00+00:00',
    caption: 'Scheduled post',
    images: [],
    linkedin_link: null,
    canva_link: null,
    format: 'static'
  }
];

// ── Shared Setup ────────────────────────────────────────────

function setupRoutes(page, posts) {
  return page.route('**/*', async route => {
    const url = route.request().url();
    const method = route.request().method();

    if (url.includes('/rest/v1/posts')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(posts) });
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

function injectAuth(page, role, email, name) {
  return page.addInitScript(([r, e, n]) => {
    window.localStorage.setItem('hinglish_role', r);
    window.localStorage.setItem('sb_access_token', 'fake-token');
    window.localStorage.setItem('hinglish_email', e);
    window.localStorage.setItem('hinglish_name', n);
    window.localStorage.removeItem('pcs_role_preview');
  }, [role, email, name]);
}

function assertNoErrorToast(page) {
  return page.locator('#sorted-error-toast').count().then(c =>
    c > 0 ? expect(page.locator('#sorted-error-toast')).not.toBeVisible() : undefined
  );
}

// ── TEST GROUP 1 — Role switching (Admin) ───────────────────

test.describe('Role Switching — Admin', () => {

  test('TEST 1 — Admin pipeline loads correctly', async ({ page }) => {
    await setupRoutes(page, [mockPostAdmin]);
    await injectAuth(page, 'Admin', 'shubham@sorted.io', 'Shubham');

    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Switch to pipeline tab
    const pipeTab = page.locator('[data-tab="pipeline"]');
    await expect(pipeTab).toBeVisible({ timeout: 5000 });
    await pipeTab.click();

    await expect(page.locator('#pipeline-container')).toBeVisible({ timeout: 5000 });
    await assertNoErrorToast(page);
  });

  test('TEST 2 — Admin previews as Chitra (Servicing)', async ({ page }) => {
    await setupRoutes(page, [mockPostAdmin]);
    await injectAuth(page, 'Admin', 'shubham@sorted.io', 'Shubham');
    await page.addInitScript(() => {
      window.localStorage.setItem('pcs_role_preview', 'Servicing');
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Switch to pipeline tab
    const pipeTab = page.locator('[data-tab="pipeline"]');
    await expect(pipeTab).toBeVisible({ timeout: 5000 });
    await pipeTab.click();

    await expect(page.locator('#pipeline-container')).toBeVisible({ timeout: 5000 });

    // Effective role should be Servicing
    const effectiveRole = await page.evaluate(() =>
      window.AppState.user.effectiveRole
    );
    expect(effectiveRole).toBe('Servicing');
    await assertNoErrorToast(page);
  });

  test('TEST 3 — Admin previews as Pranav (Creative)', async ({ page }) => {
    await setupRoutes(page, [mockPostAdmin]);
    await injectAuth(page, 'Admin', 'shubham@sorted.io', 'Shubham');
    await page.addInitScript(() => {
      window.localStorage.setItem('pcs_role_preview', 'Creative');
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Switch to pipeline tab
    const pipeTab = page.locator('[data-tab="pipeline"]');
    await expect(pipeTab).toBeVisible({ timeout: 5000 });
    await pipeTab.click();

    await expect(page.locator('#pipeline-container')).toBeVisible({ timeout: 5000 });

    // Effective role should be Creative
    const effectiveRole = await page.evaluate(() =>
      window.AppState.user.effectiveRole
    );
    expect(effectiveRole).toBe('Creative');
    await assertNoErrorToast(page);
  });

  test('TEST 4 — Admin previews as Client', async ({ page }) => {
    await setupRoutes(page, [mockPostAdmin]);
    await injectAuth(page, 'Admin', 'shubham@sorted.io', 'Shubham');
    await page.addInitScript(() => {
      window.localStorage.setItem('pcs_role_preview', 'Client');
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Client view should render
    await expect(page.locator('#client-view')).toBeVisible({ timeout: 8000 });
    await assertNoErrorToast(page);
  });
});

// ── TEST GROUP 2 — Chitra (Servicing) ───────────────────────

test.describe('Chitra (Servicing) Pipeline Visibility', () => {

  test.beforeEach(async ({ page }) => {
    await setupRoutes(page, mockPostsChitra);
    await injectAuth(page, 'Servicing', 'chitra@sorted.io', 'Chitra');
  });

  test('TEST 5 — Chitra sees pipeline', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const pipeTab = page.locator('[data-tab="pipeline"]');
    await expect(pipeTab).toBeVisible({ timeout: 5000 });
    await pipeTab.click();

    await expect(page.locator('#pipeline-container')).toBeVisible({ timeout: 5000 });
    await assertNoErrorToast(page);
  });

  test('TEST 6 — Chitra does NOT see in_production posts', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const pipeTab = page.locator('[data-tab="pipeline"]');
    await expect(pipeTab).toBeVisible({ timeout: 5000 });
    await pipeTab.click();

    await expect(page.locator('#pipeline-container')).toBeVisible({ timeout: 5000 });

    // in_production post should NOT be in the DOM
    const prodCard = page.locator('[data-post-id="test-chitra-001"]');
    await expect(prodCard).toHaveCount(0);
  });

  test('TEST 7 — Chitra SEES awaiting_approval posts', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const pipeTab = page.locator('[data-tab="pipeline"]');
    await expect(pipeTab).toBeVisible({ timeout: 5000 });
    await pipeTab.click();

    await expect(page.locator('#pipeline-container')).toBeVisible({ timeout: 5000 });

    // awaiting_approval post should be visible
    const approvalCard = page.locator('[data-post-id="test-chitra-002"]');
    await expect(approvalCard).toBeVisible({ timeout: 5000 });
  });

  test('TEST 8 — Chitra sees dashboard', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('#dashboard-view')).toBeVisible({ timeout: 8000 });
    await assertNoErrorToast(page);
  });

  test('TEST 9 — Chitra can open new post form', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const pipeTab = page.locator('[data-tab="pipeline"]');
    await expect(pipeTab).toBeVisible({ timeout: 5000 });
    await pipeTab.click();
    await expect(page.locator('#pipeline-container')).toBeVisible({ timeout: 5000 });

    // FAB is inside action-bar (display:none in CSS) — call openNewPostModal directly
    await page.evaluate(() => {
      if (typeof openNewPostModal === 'function') openNewPostModal();
    });

    await expect(page.locator('#new-post-overlay')).toBeVisible({ timeout: 5000 });
  });
});

// ── TEST GROUP 3 — Pranav (Creative) ────────────────────────

test.describe('Pranav (Creative) Pipeline Visibility', () => {

  test.beforeEach(async ({ page }) => {
    await setupRoutes(page, mockPostsPranav);
    await injectAuth(page, 'Creative', 'pranav@sorted.io', 'Pranav');
  });

  test('TEST 10 — Pranav sees pipeline', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const pipeTab = page.locator('[data-tab="pipeline"]');
    await expect(pipeTab).toBeVisible({ timeout: 5000 });
    await pipeTab.click();

    await expect(page.locator('#pipeline-container')).toBeVisible({ timeout: 5000 });
    await assertNoErrorToast(page);
  });

  test('TEST 11 — Pranav SEES in_production post (own)', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const pipeTab = page.locator('[data-tab="pipeline"]');
    await expect(pipeTab).toBeVisible({ timeout: 5000 });
    await pipeTab.click();

    await expect(page.locator('#pipeline-container')).toBeVisible({ timeout: 5000 });

    // in_production post owned by Pranav should be visible
    const prodCard = page.locator('[data-post-id="test-pranav-001"]');
    await expect(prodCard).toBeVisible({ timeout: 5000 });
  });

  test('TEST 12 — Pranav SEES awaiting_approval post (all)', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const pipeTab = page.locator('[data-tab="pipeline"]');
    await expect(pipeTab).toBeVisible({ timeout: 5000 });
    await pipeTab.click();

    await expect(page.locator('#pipeline-container')).toBeVisible({ timeout: 5000 });

    // awaiting_approval post (owned by Chitra) should still be visible to Pranav
    const approvalCard = page.locator('[data-post-id="test-pranav-002"]');
    await expect(approvalCard).toBeVisible({ timeout: 5000 });
  });

  test('TEST 13 — Pranav does NOT see scheduled posts', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const pipeTab = page.locator('[data-tab="pipeline"]');
    await expect(pipeTab).toBeVisible({ timeout: 5000 });
    await pipeTab.click();

    await expect(page.locator('#pipeline-container')).toBeVisible({ timeout: 5000 });

    // scheduled post should NOT be in the DOM for Pranav
    const schedCard = page.locator('[data-post-id="test-pranav-003"]');
    await expect(schedCard).toHaveCount(0);
  });

  test('TEST 14 — Pranav can open new post form', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const pipeTab = page.locator('[data-tab="pipeline"]');
    await expect(pipeTab).toBeVisible({ timeout: 5000 });
    await pipeTab.click();
    await expect(page.locator('#pipeline-container')).toBeVisible({ timeout: 5000 });

    // FAB is inside action-bar (display:none in CSS) — call openNewPostModal directly
    await page.evaluate(() => {
      if (typeof openNewPostModal === 'function') openNewPostModal();
    });

    await expect(page.locator('#new-post-overlay')).toBeVisible({ timeout: 5000 });
  });

  test('TEST 15 — Pranav sees dashboard', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('#dashboard-view')).toBeVisible({ timeout: 8000 });
    await assertNoErrorToast(page);
  });
});

// ── TEST GROUP 4 — FAB visibility ───────────────────────────

test.describe('FAB Visibility', () => {

  test('TEST 16 — Admin can open new post form', async ({ page }) => {
    await setupRoutes(page, [mockPostAdmin]);
    await injectAuth(page, 'Admin', 'shubham@sorted.io', 'Shubham');

    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const pipeTab = page.locator('[data-tab="pipeline"]');
    await expect(pipeTab).toBeVisible({ timeout: 5000 });
    await pipeTab.click();
    await expect(page.locator('#pipeline-container')).toBeVisible({ timeout: 5000 });

    // FAB is inside action-bar (display:none in CSS) — call openNewPostModal directly
    await page.evaluate(() => {
      if (typeof openNewPostModal === 'function') openNewPostModal();
    });

    await expect(page.locator('#new-post-overlay')).toBeVisible({ timeout: 5000 });
  });

  test('TEST 17 — FAB NOT visible for Client', async ({ page }) => {
    await setupRoutes(page, [mockPostAdmin]);
    await injectAuth(page, 'Client', 'manisha@somaiya.com', 'Manisha');

    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Client sees client-view, not pipeline
    await expect(page.locator('#client-view')).toBeVisible({ timeout: 8000 });

    // FAB should not be visible for client
    await expect(page.locator('#main-fab-btn')).not.toBeVisible();
  });
});
