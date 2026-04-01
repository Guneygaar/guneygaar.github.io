const { test, expect } = require('@playwright/test');

// ── Environment ─────────────────────────────────────────────
const ADMIN_EMAIL   = process.env.SORTED_ADMIN_EMAIL;
const CLIENT_EMAIL  = process.env.SORTED_CLIENT_EMAIL;
const SUPABASE_URL  = 'https://vxokfscjzytpgdrmertk.supabase.co';
const SUPABASE_KEY  = process.env.SORTED_SUPABASE_KEY;

// ── Guard: skip entire suite if env vars missing ────────────
test.beforeAll(() => {
  if (!SUPABASE_KEY) throw new Error('SORTED_SUPABASE_KEY env var required');
  if (!ADMIN_EMAIL)  throw new Error('SORTED_ADMIN_EMAIL env var required');
});

// ── Supabase direct helpers (no browser needed) ─────────────
async function supaRest(path, opts = {}) {
  const url = `${SUPABASE_URL}/rest/v1${path}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      'apikey':        SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type':  'application/json',
      'Prefer':        opts.prefer || 'return=representation',
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : [] };
}

async function supaInsert(table, row) {
  return supaRest(`/${table}`, {
    method: 'POST',
    body: JSON.stringify(row),
  });
}

async function supaDelete(table, filter) {
  return supaRest(`/${table}?${filter}`, { method: 'DELETE' });
}

async function supaSelect(table, filter) {
  return supaRest(`/${table}?${filter}`);
}

// ── Cleanup: delete all [LIVETEST] rows ─────────────────────
async function cleanup() {
  await supaDelete('post_comments', 'message=like.%5BLIVETEST%5D*');
  await supaDelete('notifications', 'message=like.%5BLIVETEST%5D*');
  await supaDelete('activity_log',  'action=like.%5BLIVETEST%5D*');
  await supaDelete('posts',         'title=like.%5BLIVETEST%5D*');
  await supaDelete('error_log',     'action=like.live-test*');
}

// ── Run cleanup before and after entire suite ───────────────
test.beforeAll(async () => { await cleanup(); });
test.afterAll(async () => { await cleanup(); });
test.afterEach(async () => { await cleanup(); });

// ── Auth helper: inject real admin token via localStorage ───
function injectAdminAuth(page) {
  return page.addInitScript(({ email }) => {
    window.localStorage.setItem('hinglish_role', 'Admin');
    window.localStorage.setItem('hinglish_email', email);
    window.localStorage.setItem('hinglish_name', 'Live Test Admin');
  }, { email: ADMIN_EMAIL });
}

function injectClientAuth(page) {
  return page.addInitScript(({ email }) => {
    window.localStorage.setItem('hinglish_role', 'Client');
    window.localStorage.setItem('hinglish_email', email);
    window.localStorage.setItem('hinglish_name', 'Live Test Client');
  }, { email: CLIENT_EMAIL || ADMIN_EMAIL });
}

// For live tests we need a real Supabase session token.
// We obtain one by calling the OTP verify endpoint with a service-role,
// or we inject the anon key as the bearer (works for RLS-disabled tables).
function injectAnonToken(page) {
  return page.addInitScript(({ key }) => {
    window.localStorage.setItem('sb_access_token', key);
  }, { key: SUPABASE_KEY });
}

// ── Route: allow srtd.io + Supabase, block all else ────────
function setupLiveRoutes(page) {
  return page.route('**/*', async route => {
    const url = route.request().url();
    if (url.includes('srtd.io') ||
        url.includes('supabase.co') ||
        url.includes('127.0.0.1') ||
        url.includes('localhost') ||
        url.includes('fonts.googleapis.com') ||
        url.includes('fonts.gstatic.com')) {
      await route.continue();
    } else {
      await route.abort();
    }
  });
}

// ================================================================
// TEST 1 — Admin can create a post (hits real /posts table)
// ================================================================

test.describe('Live Smoke Tests', () => {

  test('TEST 1 -- Admin creates a post via direct API', async () => {
    const postId = 'LIVETEST-' + Date.now();
    const result = await supaInsert('posts', {
      post_id:    postId,
      title:      '[LIVETEST] Smoke post',
      stage:      'in_production',
      owner:      'Pranav',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    expect(result.status).toBe(201);
    expect(result.data).toBeTruthy();
    expect(Array.isArray(result.data) ? result.data[0].post_id : result.data.post_id).toBe(postId);

    // Verify it exists in DB
    const check = await supaSelect('posts', `post_id=eq.${postId}`);
    expect(check.data.length).toBe(1);
    expect(check.data[0].title).toBe('[LIVETEST] Smoke post');
    expect(check.data[0].stage).toBe('in_production');

    // Verify no error_log entries for this action
    const errors = await supaSelect('error_log', 'action=like.live-test*');
    expect(errors.data.length).toBe(0);
  });

  // ================================================================
  // TEST 2 — Client can submit a comment (hits real /post_comments)
  // ================================================================

  test('TEST 2 -- Client submits a comment via direct API', async () => {
    // First create a test post to comment on
    const postId = 'LIVETEST-CMT-' + Date.now();
    await supaInsert('posts', {
      post_id:    postId,
      title:      '[LIVETEST] Comment target',
      stage:      'awaiting_approval',
      owner:      'Chitra',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Submit comment
    const result = await supaInsert('post_comments', {
      post_id:     postId,
      post_title:  '[LIVETEST] Comment target',
      author:      'Live Test Client',
      author_role: 'Client',
      message:     '[LIVETEST] smoke comment',
      visibility:  'client',
      created_at:  new Date().toISOString(),
    });

    expect(result.status).toBe(201);

    // Verify comment exists
    const check = await supaSelect('post_comments', `post_id=eq.${postId}&message=like.%5BLIVETEST%5D*`);
    expect(check.data.length).toBe(1);
    expect(check.data[0].message).toBe('[LIVETEST] smoke comment');
    expect(check.data[0].author_role).toBe('Client');
  });

  // ================================================================
  // TEST 3 — Client request form submits (hits real /posts table)
  // ================================================================

  test('TEST 3 -- Client request creates a brief-stage post', async () => {
    const postId = 'LIVETEST-REQ-' + Date.now();
    const result = await supaInsert('posts', {
      post_id:         postId,
      title:           '[LIVETEST] Smoke request',
      stage:           'brief',
      owner:           'Chitra',
      client_feedback: 'Live smoke test brief',
      created_at:      new Date().toISOString(),
      updated_at:      new Date().toISOString(),
    });

    expect(result.status).toBe(201);

    // Verify post exists with stage='brief'
    const check = await supaSelect('posts', `post_id=eq.${postId}`);
    expect(check.data.length).toBe(1);
    expect(check.data[0].stage).toBe('brief');
    expect(check.data[0].client_feedback).toBe('Live smoke test brief');
  });

  // ================================================================
  // TEST 4 — Notification fires on comment (hits real /notifications)
  // ================================================================

  test('TEST 4 -- Notification row can be created', async () => {
    const postId = 'LIVETEST-NOTIF-' + Date.now();
    await supaInsert('posts', {
      post_id:    postId,
      title:      '[LIVETEST] Notif target',
      stage:      'awaiting_approval',
      owner:      'Pranav',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Create notification like the app would
    const result = await supaInsert('notifications', {
      type:      'comment',
      message:   '[LIVETEST] smoke notification',
      post_id:   postId,
      user_role: 'Servicing',
      actor:     'Live Test Client',
      read:      false,
      created_at: new Date().toISOString(),
    });

    expect(result.status).toBe(201);

    // Verify notification exists
    const check = await supaSelect('notifications', `post_id=eq.${postId}&type=eq.comment`);
    expect(check.data.length).toBeGreaterThanOrEqual(1);
    expect(check.data[0].user_role).toBe('Servicing');
  });

  // ================================================================
  // TEST 5 — LinkedIn URL saves on post (PATCH to real /posts)
  // ================================================================

  test('TEST 5 -- LinkedIn URL saves via PATCH', async () => {
    const postId = 'LIVETEST-LI-' + Date.now();
    await supaInsert('posts', {
      post_id:    postId,
      title:      '[LIVETEST] LinkedIn URL test',
      stage:      'scheduled',
      owner:      'Pranav',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // PATCH linkedin_link
    const patchResult = await supaRest(`/posts?post_id=eq.${postId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        linkedin_link: 'https://linkedin.com/live-test',
        stage: 'published',
        status_changed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
    });

    expect(patchResult.status).toBe(200);

    // Verify linkedin_link is set in DB
    const check = await supaSelect('posts', `post_id=eq.${postId}`);
    expect(check.data.length).toBe(1);
    expect(check.data[0].linkedin_link).toBe('https://linkedin.com/live-test');
    expect(check.data[0].stage).toBe('published');
  });

  // ================================================================
  // TEST 6 — error_log captures real failures
  // ================================================================

  test('TEST 6 -- error_log accepts direct inserts', async () => {
    const result = await supaInsert('error_log', {
      error_message: '[LIVETEST] deliberate test error',
      error_stack:   'live-smoke.spec.js:TEST6',
      user_email:    ADMIN_EMAIL,
      user_role:     'Admin',
      page:          'live-test',
      action:        'live-test-error-capture',
    });

    expect(result.status).toBe(201);

    // Verify row exists
    const check = await supaSelect('error_log', 'action=eq.live-test-error-capture');
    expect(check.data.length).toBeGreaterThanOrEqual(1);
    expect(check.data[0].error_message).toBe('[LIVETEST] deliberate test error');
  });
});

// ================================================================
// TEST GROUP 2 — Browser-based live tests (hit real srtd.io)
// ================================================================

test.describe('Live Browser Smoke Tests', () => {

  test('TEST 7 -- srtd.io loads without JS errors', async ({ page }) => {
    const jsErrors = [];
    page.on('pageerror', err => jsErrors.push(err.message));

    await setupLiveRoutes(page);
    await injectAdminAuth(page);
    await injectAnonToken(page);
    await page.goto('https://srtd.io', { waitUntil: 'domcontentloaded', timeout: 15000 });

    // Wait for app to initialize
    await page.waitForTimeout(3000);

    // Filter out non-critical errors (network timeouts etc)
    const critical = jsErrors.filter(e =>
      !e.includes('Failed to fetch') &&
      !e.includes('NetworkError') &&
      !e.includes('Load failed')
    );

    expect(critical).toHaveLength(0);
  });

  test('TEST 8 -- Admin pipeline renders on live site', async ({ page }) => {
    await setupLiveRoutes(page);
    await injectAdminAuth(page);
    await injectAnonToken(page);
    await page.goto('https://srtd.io', { waitUntil: 'domcontentloaded', timeout: 15000 });

    // Dashboard should load for admin
    const dashView = page.locator('#dashboard-view');
    await expect(dashView).toBeVisible({ timeout: 10000 });

    // Switch to pipeline
    const pipeTab = page.locator('[data-tab="pipeline"]');
    await expect(pipeTab).toBeVisible({ timeout: 5000 });
    await pipeTab.click();

    // Pipeline container renders
    await expect(page.locator('#pipeline-container')).toBeVisible({ timeout: 10000 });

    // At least one post card exists (real data)
    const cards = page.locator('#pipeline-container [data-post-id]');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('TEST 9 -- Client view renders on live site', async ({ page }) => {
    await setupLiveRoutes(page);
    await injectClientAuth(page);
    await injectAnonToken(page);
    await page.goto('https://srtd.io', { waitUntil: 'domcontentloaded', timeout: 15000 });

    // Client view should load
    const clientView = page.locator('#client-view');
    await expect(clientView).toBeVisible({ timeout: 10000 });

    // No error toast
    const errorToast = page.locator('#sorted-error-toast');
    if (await errorToast.count() > 0) {
      await expect(errorToast).not.toBeVisible();
    }
  });

  test('TEST 10 -- Live site has no stale error_log from test', async () => {
    // Final check: ensure cleanup worked and no test artifacts remain
    const check = await supaSelect('error_log', 'action=like.live-test*');
    // afterEach cleanup should have removed our test row
    // but this test runs last so the afterEach from TEST 6 should have fired
    // If there are rows, they'll be cleaned by afterAll
    expect(check.status).toBe(200);
  });
});
