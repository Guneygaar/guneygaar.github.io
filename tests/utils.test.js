import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load utils.js as plain script (no ES modules)
const utilsSrc = readFileSync(resolve(__dirname, '..', 'utils.js'), 'utf8');

function loadUtils() {
  const fn = new Function(utilsSrc + `
    return { getTitle, getPostId, parseDate, formatDate, esc, timeAgo };
  `);
  return fn();
}

const { getTitle, getPostId, parseDate, formatDate, esc, timeAgo } = loadUtils();

// ─── getTitle ───────────────────────────────────
describe('getTitle', () => {
  it('returns title when present', () => {
    expect(getTitle({ title: 'My Post' })).toBe('My Post');
  });

  it('falls back to post_id', () => {
    expect(getTitle({ post_id: 'POST-123' })).toBe('POST-123');
  });

  it('falls back to Untitled', () => {
    expect(getTitle({})).toBe('Untitled');
  });

  it('prefers title over post_id', () => {
    expect(getTitle({ title: 'T', post_id: 'P' })).toBe('T');
  });
});

// ─── getPostId ──────────────────────────────────
describe('getPostId', () => {
  it('returns post_id when present', () => {
    expect(getPostId({ post_id: 'POST-1' })).toBe('POST-1');
  });

  it('falls back to id', () => {
    expect(getPostId({ id: '42' })).toBe('42');
  });

  it('returns empty string when neither exists', () => {
    expect(getPostId({})).toBe('');
  });
});

// ─── parseDate ──────────────────────────────────
describe('parseDate', () => {
  it('returns null for null/undefined/empty', () => {
    expect(parseDate(null)).toBeNull();
    expect(parseDate(undefined)).toBeNull();
    expect(parseDate('')).toBeNull();
  });

  it('parses valid ISO date', () => {
    const d = parseDate('2025-01-15');
    expect(d).toBeInstanceOf(Date);
    expect(d.getFullYear()).toBe(2025);
  });

  it('returns null for invalid date strings', () => {
    expect(parseDate('not-a-date')).toBeNull();
  });
});

// ─── formatDate ─────────────────────────────────
describe('formatDate', () => {
  it('returns null for null input', () => {
    expect(formatDate(null)).toBeNull();
  });

  it('returns null for invalid date', () => {
    expect(formatDate('garbage')).toBeNull();
  });

  it('formats in en-GB locale', () => {
    const result = formatDate('2025-03-15');
    // en-GB format: "15 Mar 2025"
    expect(result).toMatch(/15/);
    expect(result).toMatch(/Mar/);
    expect(result).toMatch(/2025/);
  });
});

// ─── esc ────────────────────────────────────────
describe('esc', () => {
  it('escapes ampersand', () => {
    expect(esc('a&b')).toBe('a&amp;b');
  });

  it('escapes less-than', () => {
    expect(esc('<script>')).toBe('&lt;script&gt;');
  });

  it('escapes quotes', () => {
    expect(esc('"hello"')).toBe('&quot;hello&quot;');
    expect(esc("it's")).toBe("it&#39;s");
  });

  it('handles null and undefined', () => {
    expect(esc(null)).toBe('');
    expect(esc(undefined)).toBe('');
  });

  it('handles numbers', () => {
    expect(esc(42)).toBe('42');
  });

  it('escapes all five characters together', () => {
    expect(esc('&<>"\''))
      .toBe('&amp;&lt;&gt;&quot;&#39;');
  });
});

// ─── timeAgo ────────────────────────────────────
describe('timeAgo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));
  });

  it('returns empty string for falsy input', () => {
    expect(timeAgo(null)).toBe('');
    expect(timeAgo('')).toBe('');
    expect(timeAgo(undefined)).toBe('');
  });

  it('returns "just now" for < 60s ago', () => {
    expect(timeAgo('2025-06-15T11:59:30Z')).toBe('just now');
  });

  it('returns minutes ago', () => {
    expect(timeAgo('2025-06-15T11:55:00Z')).toBe('5m ago');
  });

  it('returns hours ago', () => {
    expect(timeAgo('2025-06-15T09:00:00Z')).toBe('3h ago');
  });

  it('returns days ago', () => {
    expect(timeAgo('2025-06-13T12:00:00Z')).toBe('2d ago');
  });

  afterEach(() => {
    vi.useRealTimers();
  });
});
