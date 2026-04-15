import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load 03-auth.js and extract normalizeRole (canonical helper).
// PR #860 deleted the dead _normaliseRole helper (which mapped person
// names to person names); all role canonicalisation now flows through
// window.normalizeRole and the role-based helpers below.
const authSrc = readFileSync(resolve(__dirname, '..', '03-auth.js'), 'utf8');

function loadNormalizeRole() {
  const match = authSrc.match(/function normalizeRole\(r\)\s*\{[\s\S]*?\n\}/);
  if (!match) throw new Error('Could not find normalizeRole function');
  const fn = new Function(match[0] + '\n return normalizeRole;');
  return fn();
}

const normalizeRole = loadNormalizeRole();

// Role detection helpers — inline pure logic matching codebase patterns.
// Sorted is a scalable SaaS product; all role checks are role-based and
// must not contain hardcoded person names.
function isCreativeRole(role) {
  return (role || '').toLowerCase() === 'creative';
}

function isServicingRole(role) {
  return (role || '').toLowerCase() === 'servicing';
}

function isClient(role) {
  return (role || '').toLowerCase() === 'client';
}

// isCreativeRole
describe('isCreativeRole', () => {
  it("'creative' -> true", () => {
    expect(isCreativeRole('creative')).toBe(true);
  });

  it("'Creative' -> true (case insensitive)", () => {
    expect(isCreativeRole('Creative')).toBe(true);
  });

  it("'admin' -> false", () => {
    expect(isCreativeRole('admin')).toBe(false);
  });

  it("'client' -> false", () => {
    expect(isCreativeRole('client')).toBe(false);
  });

  it("'servicing' -> false", () => {
    expect(isCreativeRole('servicing')).toBe(false);
  });
});

// isServicingRole
describe('isServicingRole', () => {
  it("'servicing' -> true", () => {
    expect(isServicingRole('servicing')).toBe(true);
  });

  it("'Servicing' -> true", () => {
    expect(isServicingRole('Servicing')).toBe(true);
  });

  it("'admin' -> false", () => {
    expect(isServicingRole('admin')).toBe(false);
  });

  it("'creative' -> false", () => {
    expect(isServicingRole('creative')).toBe(false);
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

// normalizeRole — maps lowercase role strings to canonical Title-Case DB roles
describe('normalizeRole', () => {
  it("null -> null", () => {
    expect(normalizeRole(null)).toBe(null);
  });

  it("undefined -> null", () => {
    expect(normalizeRole(undefined)).toBe(null);
  });

  it("'creative' -> 'Creative'", () => {
    expect(normalizeRole('creative')).toBe('Creative');
  });

  it("'Creative' -> 'Creative'", () => {
    expect(normalizeRole('Creative')).toBe('Creative');
  });

  it("'servicing' -> 'Servicing'", () => {
    expect(normalizeRole('servicing')).toBe('Servicing');
  });

  it("'admin' -> 'Admin'", () => {
    expect(normalizeRole('admin')).toBe('Admin');
  });

  it("'Admin' -> 'Admin'", () => {
    expect(normalizeRole('Admin')).toBe('Admin');
  });

  it("'client' -> 'Client'", () => {
    expect(normalizeRole('client')).toBe('Client');
  });

  it("'Client' -> 'Client'", () => {
    expect(normalizeRole('Client')).toBe('Client');
  });

  it("unknown role passes through unchanged", () => {
    expect(normalizeRole('SuperAdmin')).toBe('SuperAdmin');
  });

  it("normalizeRole is exported on window in source", () => {
    expect(authSrc).toContain('window.normalizeRole = normalizeRole');
  });
});
