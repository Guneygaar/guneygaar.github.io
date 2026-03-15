import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Extract just the normalise function from 05-api.js
const apiSrc = readFileSync(resolve(__dirname, '..', '05-api.js'), 'utf8');

function loadNormalise() {
  // Extract the normalise function body via regex
  const match = apiSrc.match(/function normalise\(rows\)\s*\{[\s\S]*?\n\}/);
  if (!match) throw new Error('Could not find normalise function');
  const fn = new Function(match[0] + '\n return normalise;');
  return fn();
}

const normalise = loadNormalise();

describe('normalise', () => {
  it('returns empty array for non-array input', () => {
    expect(normalise(null)).toEqual([]);
    expect(normalise(undefined)).toEqual([]);
    expect(normalise('string')).toEqual([]);
    expect(normalise(42)).toEqual([]);
  });

  it('returns empty array for empty array', () => {
    expect(normalise([])).toEqual([]);
  });

  it('maps content_pillar to contentPillar', () => {
    const rows = [{ content_pillar: 'leadership' }];
    const result = normalise(rows);
    expect(result[0].contentPillar).toBe('leadership');
  });

  it('maps target_date to targetDate', () => {
    const rows = [{ target_date: '2025-03-15' }];
    expect(normalise(rows)[0].targetDate).toBe('2025-03-15');
  });

  it('maps post_link to postLink', () => {
    const rows = [{ post_link: 'https://example.com' }];
    expect(normalise(rows)[0].postLink).toBe('https://example.com');
  });

  it('preserves original fields via spread', () => {
    const rows = [{ custom_field: 'keep-me', title: 'T' }];
    const result = normalise(rows);
    expect(result[0].custom_field).toBe('keep-me');
    expect(result[0].title).toBe('T');
  });

  it('defaults missing fields to empty string', () => {
    const result = normalise([{}]);
    expect(result[0].title).toBe('');
    expect(result[0].stage).toBe('');
    expect(result[0].owner).toBe('');
    expect(result[0].contentPillar).toBe('');
    expect(result[0].location).toBe('');
    expect(result[0].targetDate).toBe('');
    expect(result[0].postLink).toBe('');
    expect(result[0].comments).toBe('');
    expect(result[0].format).toBe('');
    expect(result[0].post_id).toBe('');
    expect(result[0].created_at).toBe('');
    expect(result[0].updated_at).toBe('');
  });

  it('prefers post_id over id for post_id field', () => {
    const rows = [{ post_id: 'POST-1', id: '42' }];
    expect(normalise(rows)[0].post_id).toBe('POST-1');
  });

  it('falls back to id when post_id is missing', () => {
    const rows = [{ id: '42' }];
    expect(normalise(rows)[0].post_id).toBe('42');
  });
});
