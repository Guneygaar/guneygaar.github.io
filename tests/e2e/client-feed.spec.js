const { test, expect } = require('@playwright/test');

// ── Mock Data ───────────────────────────────────────────────
const LONG_CAPTION = 'A'.repeat(250); // 250 chars, well over 210 limit

const mockPosts = [
  {
    id: 'uuid-cf-1',
    post_id: 'POST-CF-APPROVE',
    title: 'Client Approval Post',
    stage: 'awaiting_approval',
    owner: 'Chitra',
    content_pillar: 'leadership',
    location: 'Mumbai',
    target_date: '2026-04-01',
    status_changed_at: '2026-03-25T10:00:00+00:00',
    caption: 'Short caption for approval post.',
    images: ['https://picsum.photos/400/300'],
    linkedin_link: null,
    canva_link: null,
    comments: null,
    format: 'static',
    _commentCount: 0
  },
  {
    id: 'uuid-cf-2',
    post_id: 'POST-CF-INPUT',
    title: 'Brand Input Post',
    stage: 'awaiting_brand_input',
    owner: 'Pranav',
    content_pillar: 'innovation',
    location: 'Delhi',
    target_date: '2026-04-05',
    status_changed_at: '2026-03-24T10:00:00+00:00',
    caption: 'Need your thoughts on this direction.',
    images: [],
    linkedin_link: null,
    canva_link: null,
    comments: null,
    format: 'carousel',
    _commentCount: 1
  },
  {
    id: 'uuid-cf-3',
    post_id: 'POST-CF-PUBLISHED',
    title: 'Published Success Post',
    stage: 'published',
    owner: 'Chitra',
    content_pillar: 'sustainability',
    location: 'Bangalore',
    target_date: '2026-03-20',
    status_changed_at: '2026-03-18T10:00:00+00:00',
    caption: 'Already live on LinkedIn.',
    images: ['https://picsum.photos/400/301'],
    linkedin_link: 'https://linkedin.com/post/123',
    canva_link: null,
    comments: null,
    format: 'static',
    _commentCount: 0
  },
  {
    id: 'uuid-cf-4',
    post_id: 'POST-CF-LONGCAP',
    title: 'Long Caption Post',
    stage: 'awaiting_approval',
    owner: 'Pranav',
    content_pillar: 'leadership',
    location: 'Mumbai',
    target_date: '2026-04-10',
    status_changed_at: '2026-03-26T10:00:00+00:00',
    caption: LONG_CAPTION,
    images: [],
    linkedin_link: null,
    canva_link: null,
    comments: null,
    format: 'static',
    _commentCount: 0
  }
];

const mockComments = [
  {
    id: 'comment-cf-1',
    post_id: 'POST-CF-INPUT',
    author: 'Chitra',
    author_role: 'Servicing',
    message: 'Please share brand guidelines.',
    created_at: '2026-03-24T12:00:00+00:00',
    read: false
  }
];

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

// ── CLIENT FEED SMOKE TESTS ────────────────────────────────

test.describe('Client Feed Smoke Tests', () => {

  test.beforeEach(async ({ page }) => {
    await setupClientRoutes(page, mockPosts);
    await injectClientAuth(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
  });

  test('TEST 1 — Client feed loads with correct posts', async ({ page }) => {
    // Verify feed container renders
    const clientView = page.locator('#client-view');
    await expect(clientView).toBeVisible({ timeout: 5000 });

    // Verify at least one post card appears
    const cards = clientView.locator('[data-card-id]');
    await expect(cards.first()).toBeVisible({ timeout: 5000 });
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // Verify no internal-stage posts are visible (scoped to cards only)
    const internalCards = clientView.locator('[data-card-id][data-stage="in_production"], [data-card-id][data-stage="brief"], [data-card-id][data-stage="ready"]');
    await expect(internalCards).toHaveCount(0);
  });

  test('TEST 2 — Client sees correct bottom nav', async ({ page }) => {
    await expect(page.locator('#client-view')).toBeVisible({ timeout: 5000 });

    const nav = page.locator('#bottom-nav');
    await expect(nav).toBeVisible({ timeout: 5000 });

    // Verify Feed, Requests, Alerts are present
    await expect(nav.locator('text=Feed')).toBeVisible();
    await expect(nav.locator('text=Requests')).toBeVisible();
    await expect(nav.locator('text=Alerts')).toBeVisible();

    // Verify agency-only tabs are NOT visible
    await expect(nav.locator('text=Dashboard')).not.toBeVisible();
    await expect(nav.locator('text=Posts')).not.toBeVisible();
    await expect(nav.locator('text=Library')).not.toBeVisible();
    await expect(nav.locator('text=Insights')).not.toBeVisible();
  });

  test('TEST 3 — FAB is hidden for client', async ({ page }) => {
    await expect(page.locator('#client-view')).toBeVisible({ timeout: 5000 });

    // Verify #fab has display none
    const fab = page.locator('#fab');
    if (await fab.count() > 0) {
      await expect(fab).toBeHidden();
    }

    // Verify #main-fab-btn has display none
    const fabBtn = page.locator('#main-fab-btn');
    if (await fabBtn.count() > 0) {
      await expect(fabBtn).toBeHidden();
    }
  });

  test('TEST 4 — Approve popup fires correctly', async ({ page }) => {
    await expect(page.locator('#client-view')).toBeVisible({ timeout: 5000 });

    // Find first awaiting_approval card (scoped to data-card-id elements)
    const approvalCard = page.locator('#client-view [data-card-id][data-stage="awaiting_approval"]').first();
    await expect(approvalCard).toBeVisible({ timeout: 5000 });

    // Click Approve button
    const approveBtn = approvalCard.locator('[data-action="clientApprovePrompt"]');
    await expect(approveBtn).toBeVisible({ timeout: 3000 });
    await approveBtn.click();

    // Verify popup appears with correct text
    const popup = page.locator('#client-approve-popup');
    await expect(popup).toBeVisible({ timeout: 3000 });
    await expect(page.locator('text=Approve this post?')).toBeVisible();

    // Click Cancel
    await page.locator('[data-action="approveCancel"]').click();

    // Verify popup closes
    await expect(popup).not.toBeVisible({ timeout: 3000 });

    // Verify card is unchanged (still awaiting_approval)
    await expect(approvalCard).toBeVisible();
    await expect(approvalCard).toHaveAttribute('data-stage', 'awaiting_approval');
  });

  test('TEST 5 — Comment input focuses on Comment tap', async ({ page }) => {
    await expect(page.locator('#client-view')).toBeVisible({ timeout: 5000 });

    // Find first awaiting_approval card
    const card = page.locator('#client-view [data-card-id][data-stage="awaiting_approval"]').first();
    await expect(card).toBeVisible({ timeout: 5000 });

    // Get post id from card
    const postId = await card.getAttribute('data-card-id');

    // Click Comment button
    const commentBtn = card.locator('[data-action="focusComment"]');
    await expect(commentBtn).toBeVisible({ timeout: 3000 });
    await commentBtn.click();

    // Verify the comment input receives focus
    const commentInput = page.locator('#comment-input-' + postId);
    await expect(commentInput).toBeFocused({ timeout: 3000 });

    // Verify PCS overlay is NOT open
    const modalOpen = await page.evaluate(() => window._modalOpen);
    expect(modalOpen).toBeFalsy();
  });

  test('TEST 6 — PCS never opens for client', async ({ page }) => {
    await expect(page.locator('#client-view')).toBeVisible({ timeout: 5000 });

    const card = page.locator('#client-view [data-card-id][data-stage="awaiting_approval"]').first();
    await expect(card).toBeVisible({ timeout: 5000 });

    // Click every tappable element on a card
    // Avatar
    const avatar = card.locator('img').first();
    if (await avatar.count() > 0) {
      await avatar.click({ force: true });
    }

    // Title text
    const title = card.locator('text=Client Approval Post');
    await title.click({ force: true });

    // Card body area (the badge area)
    const badge = card.locator('span').first();
    if (await badge.count() > 0) {
      await badge.click({ force: true });
    }

    // Comment text (if any comments visible)
    const commentText = card.locator('div').nth(3);
    await commentText.click({ force: true });

    // Verify _modalOpen remains false throughout
    const modalOpen = await page.evaluate(() => window._modalOpen);
    expect(modalOpen).toBeFalsy();
  });

  test('TEST 7 — Caption truncates at 210 chars', async ({ page }) => {
    await expect(page.locator('#client-view')).toBeVisible({ timeout: 5000 });

    // Find the card with the long caption
    const longCapCard = page.locator('[data-card-id="POST-CF-LONGCAP"]');
    await expect(longCapCard).toBeVisible({ timeout: 5000 });

    // Verify truncated text ends with ...more
    const moreLink = longCapCard.locator('[data-action="expand-caption"]');
    await expect(moreLink).toBeVisible({ timeout: 3000 });
    await expect(moreLink).toHaveText('...more');

    // Click ...more to expand
    await moreLink.click();

    // After expanding, the caption container replaces innerHTML with full text
    // Verify full caption is now present (all 250 'A' characters)
    const capContainer = page.locator('#cap-POST-CF-LONGCAP');
    const capText = await capContainer.textContent();
    expect(capText.length).toBeGreaterThan(210);

    // Verify ...more link is gone (replaced by full text)
    await expect(longCapCard.locator('[data-action="expand-caption"]')).toHaveCount(0);

    // Verify no navigation occurs (still on same page)
    const modalOpen = await page.evaluate(() => window._modalOpen);
    expect(modalOpen).toBeFalsy();
  });

  test('TEST 8 — Published posts are read only', async ({ page }) => {
    await expect(page.locator('#client-view')).toBeVisible({ timeout: 5000 });

    // Find published card (scoped to card elements)
    const pubCard = page.locator('#client-view [data-card-id][data-stage="published"]').first();
    await expect(pubCard).toBeVisible({ timeout: 5000 });

    // Verify no Approve button
    const approveBtn = pubCard.locator('[data-action="clientApprovePrompt"]');
    await expect(approveBtn).toHaveCount(0);

    // Verify no comment input
    const commentInput = pubCard.locator('input[type="text"]');
    await expect(commentInput).toHaveCount(0);

    // Verify approved strip is visible (stats bar shows "Approved")
    await expect(pubCard.locator('text=Approved')).toBeVisible({ timeout: 3000 });
  });

  test('TEST 9 — Client cannot see internal posts', async ({ page }) => {
    await expect(page.locator('#client-view')).toBeVisible({ timeout: 5000 });

    // Verify allPosts filtered for client contains only allowed stages
    const stages = await page.evaluate(() => {
      return (window.allPosts || []).map(p => p.stage);
    });

    const allowedStages = ['awaiting_approval', 'awaiting_brand_input', 'published'];
    const internalStages = ['in_production', 'ready', 'brief', 'brief_done', 'scheduled'];

    for (const stage of stages) {
      expect(allowedStages).toContain(stage);
    }

    for (const stage of internalStages) {
      expect(stages).not.toContain(stage);
    }
  });

  test('TEST 10 — Empty state renders correctly', async ({ page }) => {
    // Override routes to return empty posts
    await page.unrouteAll();
    await setupClientRoutes(page, []);
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('#client-view')).toBeVisible({ timeout: 5000 });

    // Verify empty state message
    await expect(page.locator('text=Nothing awaiting your review')).toBeVisible({ timeout: 5000 });

    // Verify no card elements
    const cards = page.locator('#client-view [data-card-id]');
    await expect(cards).toHaveCount(0);
  });
});

// ── WHATSAPP APPROVAL SMOKE TESTS ──────────────────────────

test.describe('WhatsApp Approval Smoke Tests', () => {

  test('TEST 11 — Approval page loads from slug', async ({ page }) => {
    // Mock Supabase for the /ok/ page
    await page.route('**/*', async route => {
      const url = route.request().url();
      if (url.includes('/rest/v1/posts')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{
            id: 'uuid-ok-1',
            post_id: 'POST-OK-TEST',
            title: 'Test Slug Post',
            stage: 'awaiting_approval',
            owner: 'Pranav',
            content_pillar: 'innovation',
            caption: 'Approval test caption.',
            images: []
          }])
        });
      } else if (url.includes('/rest/v1/')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
      } else if (url.includes('127.0.0.1') || url.includes('localhost')) {
        await route.continue();
      } else {
        await route.abort();
      }
    });

    // Navigate to the approval page with a slug
    await page.goto('/ok/?p=test-slug', { waitUntil: 'domcontentloaded' });

    // Verify approval view renders without crashing
    await expect(page.locator('body')).toBeVisible({ timeout: 5000 });
    // The page shows "Approve Post" button once the post loads
    await expect(page.locator('text=Approve Post')).toBeVisible({ timeout: 5000 });
  });

  test('TEST 12 — Rejection page loads from slug', async ({ page }) => {
    // Mock Supabase for the /no/ page
    await page.route('**/*', async route => {
      const url = route.request().url();
      if (url.includes('/rest/v1/posts')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{
            id: 'uuid-no-1',
            post_id: 'POST-NO-TEST',
            title: 'Test Slug Post',
            stage: 'awaiting_approval',
            owner: 'Pranav',
            content_pillar: 'innovation',
            caption: 'Rejection test caption.',
            images: []
          }])
        });
      } else if (url.includes('/rest/v1/')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
      } else if (url.includes('127.0.0.1') || url.includes('localhost')) {
        await route.continue();
      } else {
        await route.abort();
      }
    });

    // Navigate to the rejection page with a slug
    await page.goto('/no/?p=test-slug', { waitUntil: 'domcontentloaded' });

    // Verify rejection view renders without crashing
    await expect(page.locator('body')).toBeVisible({ timeout: 5000 });
    // The page shows "Send Feedback" button and feedback form once post loads
    await expect(page.locator('text=Send Feedback')).toBeVisible({ timeout: 5000 });
  });
});
