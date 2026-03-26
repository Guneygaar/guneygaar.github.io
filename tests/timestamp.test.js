import { describe, it, expect } from 'vitest';

// Pure JS Date tests — no file loading needed.
// Tests the exact timestamp patterns Supabase returns and IST conversion.

function parseSupabaseTimestamp(raw) {
  if (!raw) return new Date(NaN);
  return new Date(
    String(raw)
      .replace(' ', 'T')
      .replace('+00:00', 'Z')
      .replace('+00', 'Z')
  );
}

describe('created_at parsing', () => {
  it('"2026-03-26 12:11:26+00:00" parses to valid Date', () => {
    const d = parseSupabaseTimestamp('2026-03-26 12:11:26+00:00');
    expect(d).toBeInstanceOf(Date);
    expect(isNaN(d.getTime())).toBe(false);
  });

  it('"2026-03-26T12:11:26+00:00" parses to valid Date', () => {
    const d = parseSupabaseTimestamp('2026-03-26T12:11:26+00:00');
    expect(d).toBeInstanceOf(Date);
    expect(isNaN(d.getTime())).toBe(false);
  });

  it('"2026-03-26 12:11:26+00" parses to valid Date', () => {
    const d = parseSupabaseTimestamp('2026-03-26 12:11:26+00');
    expect(d).toBeInstanceOf(Date);
    expect(isNaN(d.getTime())).toBe(false);
  });

  it('"2026-03-26T12:11:26Z" parses to valid Date (already correct)', () => {
    const d = parseSupabaseTimestamp('2026-03-26T12:11:26Z');
    expect(d).toBeInstanceOf(Date);
    expect(isNaN(d.getTime())).toBe(false);
  });

  it('"2026-03-26 12:11:26" parses to valid Date (no timezone)', () => {
    const d = parseSupabaseTimestamp('2026-03-26 12:11:26');
    expect(d).toBeInstanceOf(Date);
    expect(isNaN(d.getTime())).toBe(false);
  });

  it('null -> NaN (handled gracefully)', () => {
    const d = parseSupabaseTimestamp(null);
    expect(isNaN(d.getTime())).toBe(true);
  });

  it('"" -> NaN (handled gracefully)', () => {
    const d = parseSupabaseTimestamp('');
    expect(isNaN(d.getTime())).toBe(true);
  });
});

describe('IST conversion', () => {
  it('"2026-03-26T06:30:00Z" -> IST hour should be 12', () => {
    const d = new Date('2026-03-26T06:30:00Z');
    const istHour = Number(
      d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false })
    );
    expect(istHour).toBe(12);
  });

  it('"2026-03-26T18:30:00Z" -> IST hour should be 0 (midnight next day)', () => {
    const d = new Date('2026-03-26T18:30:00Z');
    const istHour = Number(
      d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false })
    );
    expect(istHour).toBe(0);
  });
});
