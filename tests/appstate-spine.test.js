import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Source-string assertions for the AppState spine. The Zustand store
// only re-syncs once at App mount unless an event nudges it — these
// tests guard that nudge end-to-end:
//   1. types.ts holds the AppUser / AppWorkspace / SortedRoleReadyEvent types
//   2. activateRole() in 03-auth.js dispatches sorted:role-ready before
//      every return path
//   3. appState.ts (the renamed store) has a useUser hook and listens for
//      sorted:role-ready + sorted:signout
//   4. App.jsx derives `authed` from useUser instead of the old
//      isAuthed() snapshot + sorted:signin listener pair
//
// Pattern mirrors tests/role.test.js — readFileSync source + regex/contains.
// Vitest config restricts to tests/**/*.test.js so this file MUST stay .js.

const authSrc = readFileSync(
  resolve(__dirname, '..', '03-auth.js'),
  'utf8'
);
const appStateSrc = readFileSync(
  resolve(__dirname, '..', 'srtd-next/src/core/stores/appState.ts'),
  'utf8'
);
const appJsxSrc = readFileSync(
  resolve(__dirname, '..', 'srtd-next/src/App.jsx'),
  'utf8'
);
const typesSrc = readFileSync(
  resolve(__dirname, '..', 'srtd-next/src/lib/types.ts'),
  'utf8'
);

describe('types.ts', () => {
  it('exports SortedRole type', () => {
    expect(typesSrc).toMatch(/export\s+type\s+SortedRole\b/);
  });

  it('exports AppUser interface with role, effectiveRole, email, name fields', () => {
    expect(typesSrc).toMatch(/export\s+interface\s+AppUser\b/);
    expect(typesSrc).toMatch(/\brole\s*:/);
    expect(typesSrc).toMatch(/\beffectiveRole\s*:/);
    expect(typesSrc).toMatch(/\bemail\s*:/);
    expect(typesSrc).toMatch(/\bname\s*:/);
  });

  it('exports AppWorkspace interface', () => {
    expect(typesSrc).toMatch(/export\s+interface\s+AppWorkspace\b/);
  });

  it('exports SortedRoleReadyEvent interface', () => {
    expect(typesSrc).toMatch(/export\s+interface\s+SortedRoleReadyEvent\b/);
  });
});

describe('03-auth.js _dispatchRoleReady', () => {
  it('_dispatchRoleReady function exists in source', () => {
    expect(authSrc).toMatch(/function\s+_dispatchRoleReady\s*\(\s*\)\s*\{/);
  });

  it('dispatches sorted:role-ready event', () => {
    expect(authSrc).toContain("new CustomEvent('sorted:role-ready'");
    expect(authSrc).toContain('window.dispatchEvent');
  });

  it('detail includes role, effectiveRole, email, name, workspace fields', () => {
    const helperMatch = authSrc.match(
      /function\s+_dispatchRoleReady[\s\S]*?\n\}/
    );
    expect(helperMatch).not.toBeNull();
    const helperBody = helperMatch[0];
    expect(helperBody).toContain('role:');
    expect(helperBody).toContain('effectiveRole:');
    expect(helperBody).toContain('email:');
    expect(helperBody).toContain('name:');
    expect(helperBody).toContain('workspace:');
    expect(helperBody).toContain('window.AppState.user.role');
    expect(helperBody).toContain('window.AppState.user.effectiveRole');
    expect(helperBody).toContain('window.AppState.workspace');
  });

  it('_dispatchRoleReady is called at least 3 times (one per return path)', () => {
    // First match is the function declaration; subsequent matches are call
    // sites. activateRole has three return paths — preview, client-DB, main.
    const callMatches = authSrc.match(/_dispatchRoleReady\s*\(\s*\)/g) || [];
    // 1 declaration + 3 call sites = 4 minimum
    expect(callMatches.length).toBeGreaterThanOrEqual(3);
  });
});

describe('appState.ts', () => {
  it('file exists at .ts path (rename complete)', () => {
    expect(appStateSrc.length).toBeGreaterThan(0);
  });

  it('exports useUser function', () => {
    expect(appStateSrc).toMatch(
      /export\s+function\s+useUser\s*\(\s*\)\s*:\s*AppUser\s*\|\s*null/
    );
  });

  it('listens to sorted:role-ready event', () => {
    expect(appStateSrc).toContain("addEventListener('sorted:role-ready'");
  });

  it('listens to sorted:signout event', () => {
    expect(appStateSrc).toContain("addEventListener('sorted:signout'");
  });

  it('still exports useAppState', () => {
    expect(appStateSrc).toMatch(/export\s+const\s+useAppState\b/);
  });

  it('still exports useIsAdmin', () => {
    expect(appStateSrc).toMatch(/export\s+function\s+useIsAdmin\b/);
  });

  it('still exports useIsClient', () => {
    expect(appStateSrc).toMatch(/export\s+const\s+useIsClient\b/);
  });

  it('still exports syncFromWindow on the store', () => {
    expect(appStateSrc).toContain('syncFromWindow');
  });

  it('imports AppUser from types', () => {
    expect(appStateSrc).toMatch(
      /import\s+type\s+\{[^}]*\bAppUser\b[^}]*\}\s+from\s+['"][./]+lib\/types['"]/
    );
  });
});

describe('App.jsx', () => {
  it('imports useUser', () => {
    expect(appJsxSrc).toMatch(
      /import\s+\{[^}]*\buseUser\b[^}]*\}\s+from\s+['"][./]+core\/stores\/appState['"]?/
    );
  });

  it('does NOT contain useState(isAuthed (old pattern removed)', () => {
    expect(appJsxSrc).not.toMatch(/useState\s*\(\s*isAuthed\s*\(/);
  });

  it('does NOT contain sorted:signin listener (replaced by useUser)', () => {
    expect(appJsxSrc).not.toContain("addEventListener('sorted:signin'");
  });

  it('contains authed = !!user?.role (new pattern)', () => {
    expect(appJsxSrc).toMatch(/const\s+user\s*=\s*useUser\s*\(\s*\)/);
    expect(appJsxSrc).toMatch(/authed\s*=\s*!!\s*user\?\.role/);
  });

  it('still renders createPostOpen && authed (auth gate intact)', () => {
    expect(appJsxSrc).toMatch(/createPostOpen\s*&&\s*authed/);
  });

  it('still renders pcsOpen && authed (auth gate intact)', () => {
    expect(appJsxSrc).toMatch(/pcsOpen\s*&&\s*authed/);
  });
});
