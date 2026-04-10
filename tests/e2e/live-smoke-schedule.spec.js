const { test, expect } = require('@playwright/test');

// ── Environment ─────────────────────────────────────────────
const SITE_URL           = 'https://srtd.io';
const CLIENT_EMAIL       = process.env.SORTED_CLIENT_EMAIL;
const ADMIN_EMAIL        = process.env.SORTED_ADMIN_EMAIL;
const SUPABASE_URL       = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY  = process.env.SUPABASE_ANON_KEY;
const EXPECTED_VERSION   = process.env.EXPECTED_VERSION;

// Skip a test with a console.warn instead of failing the suite.
function skipIfMissing(names) {
  var missing = names.filter(function(n) { return !process.env[n]; });
  if (missing.length) {
    console.warn('[smoke] skipping — missing env vars: ' + missing.join(', '));
    test.skip(true, 'missing env vars: ' + missing.join(', '));
  }
}

// ── 1. Site reachable ──────────────────────────────────────
test('1. site reachable — srtd.io loads with non-empty title', async ({ page }) => {
  const resp = await page.goto(SITE_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
  expect(resp).not.toBeNull();
  expect(resp.status()).toBeLessThan(400);
  const title = await page.title();
  expect(title).toBeTruthy();
  expect(title.length).toBeGreaterThan(0);
});

// ── 2. Version match ───────────────────────────────────────
test('2. expected version is served on srtd.io', async ({ page }) => {
  if (!EXPECTED_VERSION) {
    console.warn('[smoke] skipping version check — EXPECTED_VERSION not set');
    test.skip(true, 'EXPECTED_VERSION not set');
    return;
  }
  await page.goto(SITE_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
  const html = await page.content();
  expect(html).toContain('?v=' + EXPECTED_VERSION);
});

// ── 3. All 20 versioned assets return 200 ──────────────────
test('3. all versioned assets return 200', async ({ page, request }) => {
  await page.goto(SITE_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
  const html = await page.content();
  const matches = html.match(/(?:src|href)="([^"]*\?v=[^"]+)"/g) || [];
  const urls = matches
    .map(function(m) {
      var inner = m.match(/"([^"]+)"/)[1];
      if (inner.startsWith('http')) return inner;
      if (inner.startsWith('//')) return 'https:' + inner;
      if (inner.startsWith('/')) return SITE_URL + inner;
      return SITE_URL + '/' + inner;
    });
  expect(urls.length).toBeGreaterThan(0);

  const failures = [];
  for (const url of urls) {
    try {
      const resp = await request.get(url, { timeout: 10000 });
      if (resp.status() !== 200) failures.push(url + ' → ' + resp.status());
    } catch (err) {
      failures.push(url + ' → ' + (err && err.message));
    }
  }
  if (failures.length) {
    throw new Error('Non-200 asset responses:\n  ' + failures.join('\n  '));
  }
});

// ── 4. Supabase reachable ──────────────────────────────────
test('4. Supabase REST endpoint reachable', async ({ request }) => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('[smoke] skipping Supabase reachability — SUPABASE_URL or SUPABASE_ANON_KEY not set');
    test.skip(true, 'SUPABASE_URL/SUPABASE_ANON_KEY not set');
    return;
  }
  const resp = await request.fetch(SUPABASE_URL + '/rest/v1/posts', {
    method: 'HEAD',
    headers: { apikey: SUPABASE_ANON_KEY },
    timeout: 15000
  });
  // 200 = ok, 400 = reachable but insufficient auth — both prove
  // the host is alive and the anon key is recognised.
  expect([200, 400]).toContain(resp.status());
});

// ── 5. Open 1 post and verify comments load ────────────────
test('5. client can open a post and comments/empty-state renders', async ({ page }) => {
  if (!CLIENT_EMAIL || !SUPABASE_ANON_KEY) {
    console.warn('[smoke] skipping client-post check — SORTED_CLIENT_EMAIL or SUPABASE_ANON_KEY not set');
    test.skip(true, 'SORTED_CLIENT_EMAIL/SUPABASE_ANON_KEY not set');
    return;
  }

  // Same localStorage-injection pattern used by live-smoke.spec.js.
  await page.addInitScript(({ email, token }) => {
    window.localStorage.setItem('hinglish_role', 'Client');
    window.localStorage.setItem('hinglish_email', email);
    window.localStorage.setItem('hinglish_name', 'Smoke Test Client');
    window.localStorage.setItem('sb_access_token', token);
  }, { email: CLIENT_EMAIL, token: SUPABASE_ANON_KEY });

  await page.goto(SITE_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });

  // Wait for at least one post card in the client feed, then click.
  const firstCard = page.locator('#client-view [data-post-id]').first();
  await expect(firstCard).toBeVisible({ timeout: 15000 });
  await firstCard.click();

  // Overlay may be PCS or the client post overlay; the comments
  // list OR an empty-state message should appear.
  const commentsIndicator = page.locator(
    '#pcs-comments-list, [data-comments-list], .cf-empty, text=/no comments/i'
  ).first();
  await expect(commentsIndicator).toBeVisible({ timeout: 10000 });
});

// ── 6. error_log recent-rows check ─────────────────────────
test('6. error_log has fewer than 3 rows in last 30 min', async ({ request }) => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('[smoke] skipping error_log check — SUPABASE_URL or SUPABASE_ANON_KEY not set');
    test.skip(true, 'SUPABASE_URL/SUPABASE_ANON_KEY not set');
    return;
  }
  const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const url = SUPABASE_URL +
    '/rest/v1/error_log?select=error_message,created_at,app_version' +
    '&created_at=gt.' + encodeURIComponent(since) +
    '&order=created_at.desc&limit=50';
  const resp = await request.get(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: 'Bearer ' + SUPABASE_ANON_KEY
    },
    timeout: 15000
  });
  expect(resp.status()).toBe(200);
  const rows = await resp.json();
  if (!Array.isArray(rows)) {
    throw new Error('error_log query returned non-array: ' + JSON.stringify(rows));
  }
  if (rows.length >= 3) {
    const summary = rows.slice(0, 10).map(function(r) {
      return '- [' + (r.created_at || '?') + '] (' + (r.app_version || '?') + ') ' + (r.error_message || '<no message>');
    }).join('\n');
    throw new Error('error_log has ' + rows.length + ' rows in last 30 min:\n' + summary);
  }
});
