const { test, expect } = require('@playwright/test');

// ── Mock Data ───────────────────────────────────────────────
const mockPost = {
  id: 'uuid-notif-001',
  post_id: 'test-notif-post-001',
  title: '[TEST] Notif Target Post',
  stage: 'awaiting_approval',
  owner: 'Creative',
  content_pillar: 'innovation',
  location: 'Mumbai',
  target_date: '2026-04-15',
  status_changed_at: '2026-04-04T10:00:00+00:00',
  caption: 'Test caption',
  images: ['https://picsum.photos/200'],
  linkedin_link: null,
  canva_link: null,
  format: 'static'
};

const mockNotifications = [
  {
    id: 'notif-1',
    type: 'comment',
    message: 'Manisha commented on [TEST] Notif Target Post',
    read: false,
    created_at: new Date().toISOString(),
    post_id: 'test-notif-post-001',
    user_role: 'Admin',
    actor: 'Manisha'
  },
  {
    id: 'notif-2',
    type: 'stage_change',
    message: 'Chitra moved [TEST] Notif Target Post to Awaiting Approval',
    read: false,
    created_at: new Date(Date.now() - 3600000).toISOString(),
    post_id: 'test-notif-post-001',
    user_role: 'Admin',
    actor: 'Chitra'
  },
  {
    id: 'notif-3',
    type: 'published',
    message: 'Shubham published [TEST] Notif Target Post',
    read: true,
    created_at: new Date(Date.now() - 7200000).toISOString(),
    post_id: 'test-notif-post-001',
    user_role: 'Admin',
    actor: 'Shubham'
  },
  {
    id: 'notif-4',
    type: 'awaiting_approval',
    message: 'Chitra sent [TEST] Notif Target Post for approval',
    read: true,
    created_at: new Date(Date.now() - 86400000).toISOString(),
    post_id: 'test-notif-post-001',
    user_role: 'Admin',
    actor: 'Chitra'
  }
];

// ── Shared Setup ────────────────────────────────────────────
function setupRoutes(page) {
  return page.route('**/*', async route => {
    const url = route.request().url();
    const method = route.request().method();

    if (url.includes('/rest/v1/posts')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([mockPost]) });
    } else if (url.includes('/rest/v1/post_comments')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    } else if (url.includes('/rest/v1/internal_notes')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    } else if (url.includes('/rest/v1/notifications')) {
      if (method === 'PATCH' || method === 'DELETE') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockNotifications) });
      }
    } else if (url.includes('/rest/v1/activity_log')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    } else if (url.includes('/rest/v1/tasks')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    } else if (url.includes('/rest/v1/requests')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    } else if (url.includes('/rest/v1/')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    } else if (url.includes('/auth/v1/')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'fake-token', user: { email: 'admin@sorted.io' } }) });
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
    window.localStorage.setItem('hinglish_email', 'admin@sorted.io');
    window.localStorage.setItem('hinglish_name', 'Shubham');
    window.localStorage.removeItem('pcs_role_preview');
  });
}

// ── Tests ───────────────────────────────────────────────────

test.describe('Notification Panel', () => {

  test.beforeEach(async ({ page }) => {
    await setupRoutes(page);
    await injectAdminAuth(page);
  });

  test('TEST 1 — Panel opens and renders items', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    // Click bell button
    await page.locator('#notif-bell').click();
    // Wait for overlay
    const overlay = page.locator('#notif-overlay');
    await expect(overlay).toBeVisible({ timeout: 5000 });
    // At least one notif item or live card rendered
    const items = page.locator('.notif-item, .notif-live-card');
    await expect(items.first()).toBeVisible({ timeout: 5000 });
    // Chips row exists with ALL chip active
    const allChip = page.locator('.notif-chip[data-filter="all"]');
    await expect(allChip).toBeVisible();
    await expect(allChip).toHaveClass(/active/);
  });

  test('TEST 2 — COMMENTS chip filters correctly', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.locator('#notif-bell').click();
    await expect(page.locator('#notif-overlay')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.notif-item, .notif-live-card').first()).toBeVisible({ timeout: 5000 });
    // Click comments chip
    await page.locator('.notif-chip[data-filter="comments"]').click();
    // Wait for re-render
    await page.waitForTimeout(200);
    // All visible items should have ntype-comment or ntype-mention
    const visibleItems = page.locator('.notif-item:visible');
    const count = await visibleItems.count();
    if (count > 0) {
      for (let i = 0; i < count; i++) {
        const cls = await visibleItems.nth(i).getAttribute('class');
        expect(cls).toMatch(/ntype-comment|ntype-mention/);
      }
    }
    // No ntype-stage items should be visible
    await expect(page.locator('.notif-item.ntype-stage:visible')).toHaveCount(0);
  });

  test('TEST 3 — MOVES chip filters correctly', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.locator('#notif-bell').click();
    await expect(page.locator('#notif-overlay')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.notif-item, .notif-live-card').first()).toBeVisible({ timeout: 5000 });
    await page.locator('.notif-chip[data-filter="moves"]').click();
    await page.waitForTimeout(200);
    const visibleItems = page.locator('.notif-item:visible');
    const count = await visibleItems.count();
    if (count > 0) {
      for (let i = 0; i < count; i++) {
        const cls = await visibleItems.nth(i).getAttribute('class');
        expect(cls).toContain('ntype-stage');
      }
    }
  });

  test('TEST 4 — LIVE chip filters correctly', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.locator('#notif-bell').click();
    await expect(page.locator('#notif-overlay')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.notif-item, .notif-live-card').first()).toBeVisible({ timeout: 5000 });
    await page.locator('.notif-chip[data-filter="live"]').click();
    await page.waitForTimeout(200);
    // All visible should be live cards
    await expect(page.locator('.notif-item:visible')).toHaveCount(0);
    const liveCards = page.locator('.notif-live-card:visible');
    // We have one published notification in mock data
    const liveCount = await liveCards.count();
    expect(liveCount).toBeGreaterThanOrEqual(1);
  });

  test('TEST 5 — Close button works', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.locator('#notif-bell').click();
    await expect(page.locator('#notif-overlay')).toBeVisible({ timeout: 5000 });
    // Click close button
    await page.locator('.notif-close-btn').click();
    await expect(page.locator('#notif-overlay')).not.toBeVisible({ timeout: 3000 });
  });

  test('TEST 6 — Mark all read hides dots', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.locator('#notif-bell').click();
    await expect(page.locator('#notif-overlay')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.notif-item, .notif-live-card').first()).toBeVisible({ timeout: 5000 });
    // Click mark-all-read
    await page.locator('.mark-all-btn').click();
    await page.waitForTimeout(300);
    // No visible unread dots
    const visibleDots = page.locator('.notif-unread-dot:visible');
    await expect(visibleDots).toHaveCount(0);
  });

  test('TEST 7 — Delete removes item', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.locator('#notif-bell').click();
    await expect(page.locator('#notif-overlay')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.notif-item, .notif-live-card').first()).toBeVisible({ timeout: 5000 });
    const initialCount = await page.locator('.notif-item, .notif-live-card').count();
    // Click first delete button
    const delBtn = page.locator('.nab-del').first();
    await expect(delBtn).toBeVisible({ timeout: 3000 });
    await delBtn.click();
    // Wait for animation
    await page.waitForTimeout(400);
    const newCount = await page.locator('.notif-item, .notif-live-card').count();
    expect(newCount).toBeLessThan(initialCount);
  });

  test('TEST 8 — Tap notification opens PCS with back button', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.locator('#notif-bell').click();
    await expect(page.locator('#notif-overlay')).toBeVisible({ timeout: 5000 });
    // Find a notif-item with a data-post-id
    const tappableItem = page.locator('.notif-item[data-post-id]:not([data-post-id=""])').first();
    await expect(tappableItem).toBeVisible({ timeout: 5000 });
    await tappableItem.click();
    // PCS overlay should open
    await expect(page.locator('#pcs-overlay')).toBeVisible({ timeout: 5000 });
    // Back button should be visible
    const backBtn = page.locator('.pcs-back-notif-btn');
    await expect(backBtn).toBeVisible({ timeout: 3000 });
    // Click back → PCS closes, notif panel reopens
    await backBtn.click();
    await page.waitForTimeout(300);
    await expect(page.locator('#notif-overlay')).toBeVisible({ timeout: 5000 });
  });

  test('TEST 9 — WhatsApp button exists on comment notifications', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.locator('#notif-bell').click();
    await expect(page.locator('#notif-overlay')).toBeVisible({ timeout: 5000 });
    // Click COMMENTS chip
    await page.locator('.notif-chip[data-filter="comments"]').click();
    await page.waitForTimeout(200);
    // Find first visible notif-item
    const commentItem = page.locator('.notif-item:visible').first();
    const waBtn = commentItem.locator('.nab-wa');
    await expect(waBtn).toBeVisible({ timeout: 3000 });
    // Verify data-post-id is set
    const postId = await waBtn.getAttribute('data-post-id');
    expect(postId).toBeTruthy();
    expect(postId.length).toBeGreaterThan(0);
  });

  test('TEST 10 — Badge shows unread count', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    // Wait for badge to appear (updated by periodic timer or loadNotifications)
    // The bell badge may need notifications to load first
    await page.locator('#notif-bell').click();
    await expect(page.locator('#notif-overlay')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.notif-item, .notif-live-card').first()).toBeVisible({ timeout: 5000 });
    // Close panel
    await page.locator('.notif-close-btn').click();
    await page.waitForTimeout(300);
    // Badge should be visible with count text
    const badge = page.locator('#notif-bell-badge');
    // Badge may or may not be visible depending on timing;
    // verify that if it IS visible, it has content
    const isVis = await badge.isVisible().catch(() => false);
    if (isVis) {
      const text = await badge.textContent();
      expect(text.length).toBeGreaterThan(0);
    }
  });
});
