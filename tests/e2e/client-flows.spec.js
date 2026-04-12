const { test, expect } = require('@playwright/test');

// ── Mock Data ───────────────────────────────────────────────
const mockPosts = [
  {
    id: 'uuid-client-001',
    post_id: 'test-client-001',
    title: '[TEST] Awaiting Approval Post',
    stage: 'awaiting_approval',
    owner: 'Pranav',
    content_pillar: 'innovation',
    location: 'Mumbai',
    target_date: '2026-04-10',
    status_changed_at: '2026-03-28T10:00:00+00:00',
    caption: 'Test caption for client smoke test',
    images: [],
    linkedin_link: null,
    canva_link: null,
    format: 'static'
  },
  {
    id: 'uuid-client-002',
    post_id: 'test-client-002',
    title: '[TEST] Brand Input Post',
    stage: 'awaiting_brand_input',
    owner: 'Chitra',
    content_pillar: 'leadership',
    location: 'Delhi',
    target_date: '2026-04-12',
    status_changed_at: '2026-03-27T10:00:00+00:00',
    caption: 'Test caption brand input',
    images: [],
    linkedin_link: null,
    canva_link: null,
    format: 'carousel'
  },
  {
    id: 'uuid-client-003',
    post_id: 'test-client-003',
    title: '[TEST] Published Post',
    stage: 'published',
    owner: 'Pranav',
    content_pillar: 'sustainability',
    location: 'Bangalore',
    target_date: '2026-03-20',
    status_changed_at: '2026-03-18T10:00:00+00:00',
    caption: 'Published caption',
    images: [],
    linkedin_link: 'https://linkedin.com/post/456',
    canva_link: null,
    format: 'static'
  }
];

const mockComments = [];

// ── Shared Setup ────────────────────────────────────────────
function setupClientRoutes(page, posts) {
  return page.route('**/*', async route => {
    const url = route.request().url();
    const method = route.request().method();

    if (url.includes('/rest/v1/posts')) {
      if (method === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(posts) });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(posts) });
      }
    } else if (url.includes('/rest/v1/post_comments')) {
      if (method === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockComments) });
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
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'fake-token', user: { email: 'client@sorted.io' } }) });
    } else if (url.includes('127.0.0.1') || url.includes('localhost')) {
      await route.continue();
    } else {
      await route.abort();
    }
  });
}

function injectClientAuth(page) {
  return page.addInitScript(() => {
    window.localStorage.setItem('hinglish_role', 'Client');
    window.localStorage.setItem('sb_access_token', 'fake-token');
    window.localStorage.setItem('hinglish_email', 'client@sorted.io');
    window.localStorage.setItem('hinglish_name', 'Test Client');
  });
}

// ── GROUP 1: Client view loads correctly ────────────────────

test.describe('Client View Loads', () => {

  test.beforeEach(async ({ page }) => {
    await setupClientRoutes(page, mockPosts);
    await injectClientAuth(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
  });

  test('TEST 1 -- Client feed renders', async ({ page }) => {
    const clientView = page.locator('#client-view');
    await expect(clientView).toBeVisible({ timeout: 5000 });

    // Pipeline container should NOT be visible for client
    const pipeline = page.locator('#pipeline-container');
    if (await pipeline.count() > 0) {
      await expect(pipeline).not.toBeVisible();
    }

    // No error toast
    const errorToast = page.locator('#sorted-error-toast');
    if (await errorToast.count() > 0) {
      await expect(errorToast).not.toBeVisible();
    }
  });

  test('TEST 2 -- Client sees awaiting_approval posts', async ({ page }) => {
    await expect(page.locator('#client-view')).toBeVisible({ timeout: 5000 });

    const card = page.locator('[data-card-id="test-client-001"]');
    await expect(card).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=[TEST] Awaiting Approval Post')).toBeVisible();
  });

  test('TEST 3 -- Client sees awaiting_brand_input posts', async ({ page }) => {
    await expect(page.locator('#client-view')).toBeVisible({ timeout: 5000 });

    const card = page.locator('[data-card-id="test-client-002"]');
    await expect(card).toBeVisible({ timeout: 5000 });
  });

  test('TEST 4 -- Client bottom nav renders correctly', async ({ page }) => {
    await expect(page.locator('#client-view')).toBeVisible({ timeout: 5000 });

    const nav = page.locator('#bottom-nav');
    await expect(nav).toBeVisible({ timeout: 5000 });

    await expect(nav.locator('button[data-action="nav-feed"]')).toBeVisible();
    await expect(nav.locator('button[data-action="nav-pipeline"]')).toBeVisible();
    await expect(nav.locator('button[data-action="nav-library"]')).toBeVisible();
  });

  test('TEST 5 -- Client does NOT see FAB', async ({ page }) => {
    await expect(page.locator('#client-view')).toBeVisible({ timeout: 5000 });

    const fabBtn = page.locator('#main-fab-btn');
    if (await fabBtn.count() > 0) {
      await expect(fabBtn).toBeHidden();
    }
  });
});

// ── GROUP 2: Comment flow ───────────────────────────────────

test.describe('Client Comment Flow', () => {

  test.beforeEach(async ({ page }) => {
    await setupClientRoutes(page, mockPosts);
    await injectClientAuth(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#client-view')).toBeVisible({ timeout: 5000 });
  });

  test('TEST 6 -- Comment input renders on awaiting_approval post', async ({ page }) => {
    const card = page.locator('[data-card-id="test-client-001"]');
    await expect(card).toBeVisible({ timeout: 5000 });

    // Comment section is collapsed by default — click Comment button to expand
    const commentBtn = card.locator('button[data-action="focusComment"]');
    await commentBtn.click();

    const input = page.locator('#comment-input-test-client-001');
    await expect(input).toBeVisible({ timeout: 5000 });

    const sendBtn = page.locator('button[data-action="submitComment"][data-id="test-client-001"]');
    await expect(sendBtn).toBeVisible();
  });

  test('TEST 7 -- Comment input renders on awaiting_brand_input post', async ({ page }) => {
    const card = page.locator('[data-card-id="test-client-002"]');
    await expect(card).toBeVisible({ timeout: 5000 });

    // Comment section is collapsed by default — click Comment button to expand
    const commentBtn = card.locator('button[data-action="focusComment"]');
    await commentBtn.click();

    const input = page.locator('#comment-input-test-client-002');
    await expect(input).toBeVisible({ timeout: 5000 });
  });

  test('TEST 8 -- Comment input does NOT render on published post', async ({ page }) => {
    // Published post card should exist
    const card = page.locator('[data-card-id="test-client-003"]');
    await expect(card).toBeVisible({ timeout: 5000 });

    // But no comment input
    const input = page.locator('#comment-input-test-client-003');
    await expect(input).toHaveCount(0);
  });

  test('TEST 9 -- Client can type in comment input', async ({ page }) => {
    const card = page.locator('[data-card-id="test-client-001"]');
    await expect(card).toBeVisible({ timeout: 5000 });

    // Expand collapsed comment section
    const commentBtn = card.locator('button[data-action="focusComment"]');
    await commentBtn.click();

    const input = page.locator('#comment-input-test-client-001');
    await expect(input).toBeVisible({ timeout: 5000 });

    await input.click();
    await input.fill('Test comment from smoke test');
    await expect(input).toHaveValue('Test comment from smoke test');
  });

  test('TEST 10 -- Comment send button visible when input has text', async ({ page }) => {
    const card = page.locator('[data-card-id="test-client-001"]');
    await expect(card).toBeVisible({ timeout: 5000 });

    // Expand collapsed comment section
    const commentBtn = card.locator('button[data-action="focusComment"]');
    await commentBtn.click();

    const input = page.locator('#comment-input-test-client-001');
    await expect(input).toBeVisible({ timeout: 5000 });
    await input.fill('Some text');

    const sendBtn = page.locator('button[data-action="submitComment"][data-id="test-client-001"]');
    await expect(sendBtn).toBeVisible();
  });

  test('TEST 11 -- PHOTO button visible below comment input', async ({ page }) => {
    const card = page.locator('[data-card-id="test-client-001"]');
    await expect(card).toBeVisible({ timeout: 5000 });

    // Expand collapsed comment section
    const commentBtn = card.locator('button[data-action="focusComment"]');
    await commentBtn.click();

    const photoBtn = card.locator('[aria-label="PHOTO"]');
    await expect(photoBtn).toBeVisible({ timeout: 3000 });
  });

  test('TEST 12 -- @MENTION button visible below comment input', async ({ page }) => {
    const card = page.locator('[data-card-id="test-client-001"]');
    await expect(card).toBeVisible({ timeout: 5000 });

    // Expand collapsed comment section
    const commentBtn = card.locator('button[data-action="focusComment"]');
    await commentBtn.click();

    const mentionBtn = card.locator('[aria-label="mention"]');
    await expect(mentionBtn).toBeVisible({ timeout: 3000 });
  });
});

// ── GROUP 3: Approve flow ───────────────────────────────────

test.describe('Client Approve Flow', () => {

  test.beforeEach(async ({ page }) => {
    await setupClientRoutes(page, mockPosts);
    await injectClientAuth(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#client-view')).toBeVisible({ timeout: 5000 });
  });

  test('TEST 13 -- Approve button visible on awaiting_approval post', async ({ page }) => {
    const card = page.locator('[data-card-id="test-client-001"]');
    await expect(card).toBeVisible({ timeout: 5000 });

    const approveBtn = card.locator('[data-action="clientApprovePrompt"]');
    await expect(approveBtn).toBeVisible({ timeout: 3000 });
  });

  test('TEST 14 -- Approve button NOT visible on awaiting_brand_input post', async ({ page }) => {
    const card = page.locator('[data-card-id="test-client-002"]');
    await expect(card).toBeVisible({ timeout: 5000 });

    // awaiting_brand_input gets an empty spacer div instead of approve button
    const approveBtn = card.locator('[data-action="clientApprovePrompt"]');
    await expect(approveBtn).toHaveCount(0);
  });

  test('TEST 15 -- Approve popup opens on approve click', async ({ page }) => {
    const card = page.locator('[data-card-id="test-client-001"]');
    await expect(card).toBeVisible({ timeout: 5000 });

    const approveBtn = card.locator('[data-action="clientApprovePrompt"]');
    await approveBtn.click();

    const popup = page.locator('#client-approve-popup');
    await expect(popup).toBeVisible({ timeout: 3000 });

    const title = page.locator('#client-approve-title');
    await expect(title).toContainText('[TEST] Awaiting Approval Post');
  });

  test('TEST 16 -- Approve popup closes on cancel', async ({ page }) => {
    const card = page.locator('[data-card-id="test-client-001"]');
    await expect(card).toBeVisible({ timeout: 5000 });

    // Open popup
    const approveBtn = card.locator('[data-action="clientApprovePrompt"]');
    await approveBtn.click();

    const popup = page.locator('#client-approve-popup');
    await expect(popup).toBeVisible({ timeout: 3000 });

    // Cancel
    await page.locator('[data-action="approveCancel"]').click();
    await expect(popup).not.toBeVisible({ timeout: 3000 });
  });
});

// ── GROUP 4: New request flow ───────────────────────────────

test.describe('Client New Request Flow', () => {

  test.beforeEach(async ({ page }) => {
    await setupClientRoutes(page, mockPosts);
    await injectClientAuth(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#client-view')).toBeVisible({ timeout: 5000 });
  });

  test('TEST 17 -- Top dots menu opens', async ({ page }) => {
    // Click the 3-dot menu toggle in top bar
    const dotsBtn = page.locator('[data-action="top-menu-toggle"]');
    await expect(dotsBtn).toBeVisible({ timeout: 3000 });
    await dotsBtn.click();

    // New request option should be visible inside the dropdown
    const newReqBtn = page.locator('[data-action="new-request"]');
    await expect(newReqBtn).toBeVisible({ timeout: 3000 });
  });

  test('TEST 18 -- New request form opens', async ({ page }) => {
    // Open dots menu
    await page.locator('[data-action="top-menu-toggle"]').click();
    await expect(page.locator('[data-action="new-request"]')).toBeVisible({ timeout: 3000 });

    // Click new request
    await page.locator('[data-action="new-request"]').click();

    // Request overlay opens
    const overlay = page.locator('#req-overlay');
    await expect(overlay).toBeVisible({ timeout: 3000 });

    await expect(page.locator('#req-name')).toBeVisible();
    await expect(page.locator('#req-topic')).toBeVisible();
    await expect(page.locator('#req-submit-btn')).toBeVisible();
  });

  test('TEST 19 -- Request submit disabled when fields empty', async ({ page }) => {
    // Open request form
    await page.locator('[data-action="top-menu-toggle"]').click();
    await page.locator('[data-action="new-request"]').click();
    await expect(page.locator('#req-overlay')).toBeVisible({ timeout: 3000 });

    const btn = page.locator('#req-submit-btn');
    await expect(btn).toBeDisabled();
  });

  test('TEST 20 -- Request submit enables when name + brief filled', async ({ page }) => {
    // Open request form
    await page.locator('[data-action="top-menu-toggle"]').click();
    await page.locator('[data-action="new-request"]').click();
    await expect(page.locator('#req-overlay')).toBeVisible({ timeout: 3000 });

    // Fill required fields
    await page.locator('#req-name').fill('[TEST] Smoke request');
    await page.locator('#req-topic').fill('This is a test brief for smoke testing');

    // Trigger validation by dispatching input event
    await page.locator('#req-name').dispatchEvent('input');
    await page.locator('#req-topic').dispatchEvent('input');

    const btn = page.locator('#req-submit-btn');
    await expect(btn).not.toBeDisabled({ timeout: 3000 });
  });

  test('TEST 21 -- Request form closes on cancel', async ({ page }) => {
    // Open request form
    await page.locator('[data-action="top-menu-toggle"]').click();
    await page.locator('[data-action="new-request"]').click();
    await expect(page.locator('#req-overlay')).toBeVisible({ timeout: 3000 });

    // Click cancel (first reqClose button)
    await page.locator('[data-action="reqClose"]').first().click();
    await expect(page.locator('#req-overlay')).not.toBeVisible({ timeout: 3000 });
  });
});

// ── GROUP 5: Published post is read only ────────────────────

test.describe('Client Published Post Read Only', () => {

  test.beforeEach(async ({ page }) => {
    await setupClientRoutes(page, mockPosts);
    await injectClientAuth(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#client-view')).toBeVisible({ timeout: 5000 });
  });

  test('TEST 22 -- Published post shows no comment input', async ({ page }) => {
    const card = page.locator('[data-card-id="test-client-003"]');
    await expect(card).toBeVisible({ timeout: 5000 });

    const input = page.locator('#comment-input-test-client-003');
    await expect(input).toHaveCount(0);
  });

  test('TEST 23 -- Published post shows no approve button', async ({ page }) => {
    const card = page.locator('[data-card-id="test-client-003"]');
    await expect(card).toBeVisible({ timeout: 5000 });

    const approveBtn = card.locator('[data-action="clientApprovePrompt"]');
    await expect(approveBtn).toHaveCount(0);
  });
});
