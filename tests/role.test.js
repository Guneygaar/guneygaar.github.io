import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load 03-auth.js and extract _normaliseRole
const authSrc = readFileSync(resolve(__dirname, '..', '03-auth.js'), 'utf8');

function loadNormaliseRole() {
  const match = authSrc.match(/function _normaliseRole\(r\)\s*\{[\s\S]*?\n\}/);
  if (!match) throw new Error('Could not find _normaliseRole function');
  const fn = new Function(match[0] + '\n return _normaliseRole;');
  return fn();
}

const _normaliseRole = loadNormaliseRole();

// Role detection helpers — inline pure logic matching codebase patterns
function isPranav(role) {
  var r = (role || '').toLowerCase();
  return r === 'creative' || r === 'pranav';
}

function isChitra(role) {
  var r = (role || '').toLowerCase();
  return r === 'servicing' || r === 'chitra';
}

function isClient(role) {
  return (role || '').toLowerCase() === 'client';
}

// _normaliseRole
describe('_normaliseRole', () => {
  it("'admin' -> 'Admin'", () => {
    expect(_normaliseRole('admin')).toBe('Admin');
  });

  it("'ADMIN' -> 'Admin'", () => {
    expect(_normaliseRole('ADMIN')).toBe('Admin');
  });

  it("'creative' -> 'Creative'", () => {
    expect(_normaliseRole('creative')).toBe('Creative');
  });

  it("'pranav' -> 'Pranav'", () => {
    expect(_normaliseRole('pranav')).toBe('Pranav');
  });

  it("'servicing' -> 'Servicing'", () => {
    expect(_normaliseRole('servicing')).toBe('Servicing');
  });

  it("'chitra' -> 'Chitra'", () => {
    expect(_normaliseRole('chitra')).toBe('Chitra');
  });

  it("'client' -> 'Client'", () => {
    expect(_normaliseRole('client')).toBe('Client');
  });

  it("null/undefined -> 'Admin' (default)", () => {
    expect(_normaliseRole(null)).toBe('Admin');
    expect(_normaliseRole(undefined)).toBe('Admin');
  });
});

// isPranav
describe('isPranav', () => {
  it("'creative' -> true", () => {
    expect(isPranav('creative')).toBe(true);
  });

  it("'pranav' -> true", () => {
    expect(isPranav('pranav')).toBe(true);
  });

  it("'Creative' -> true (case insensitive)", () => {
    expect(isPranav('Creative')).toBe(true);
  });

  it("'admin' -> false", () => {
    expect(isPranav('admin')).toBe(false);
  });

  it("'client' -> false", () => {
    expect(isPranav('client')).toBe(false);
  });

  it("'servicing' -> false", () => {
    expect(isPranav('servicing')).toBe(false);
  });
});

// isChitra
describe('isChitra', () => {
  it("'servicing' -> true", () => {
    expect(isChitra('servicing')).toBe(true);
  });

  it("'chitra' -> true", () => {
    expect(isChitra('chitra')).toBe(true);
  });

  it("'Servicing' -> true", () => {
    expect(isChitra('Servicing')).toBe(true);
  });

  it("'admin' -> false", () => {
    expect(isChitra('admin')).toBe(false);
  });

  it("'creative' -> false", () => {
    expect(isChitra('creative')).toBe(false);
  });
});

// isClient
describe('isClient', () => {
  it("'client' -> true", () => {
    expect(isClient('client')).toBe(true);
  });

  it("'Client' -> true", () => {
    expect(isClient('Client')).toBe(true);
  });

  it("'admin' -> false", () => {
    expect(isClient('admin')).toBe(false);
  });
});
