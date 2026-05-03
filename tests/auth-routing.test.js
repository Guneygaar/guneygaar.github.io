import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Plan is the permanent home for agency roles. Dashboard is dead for
// routing purposes (library code stays, just never activated on login).
// Guard that activateRole() in 03-auth.js stops activating dashboard-view
// while still loading posts and starting Realtime.

const authSrc = readFileSync(
  resolve(__dirname, '..', '03-auth.js'),
  'utf8'
);

describe('03-auth.js activateRole routing', () => {
  it('does NOT activate dashboard-view on login', () => {
    expect(authSrc).not.toMatch(
      /getElementById\(\s*['"]dashboard-view['"]\s*\)\?\.classList\.add\(\s*['"]active['"]\s*\)/
    );
  });

  it('still calls loadPosts() in activateRole', () => {
    expect(authSrc).toMatch(/\bloadPosts\s*\(\s*\)/);
  });

  it('still calls startRealtime() in activateRole', () => {
    expect(authSrc).toMatch(/\bstartRealtime\s*\(\s*\)/);
  });
});
