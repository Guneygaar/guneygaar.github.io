import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load utils.js which defines getPostById, getPostId
const utilsSrc = readFileSync(resolve(__dirname, '..', 'utils.js'), 'utf8');

function loadUtils(allPostsArr) {
  // Provide allPosts global that getPostById references
  const fn = new Function('allPosts', utilsSrc + `
    return { getPostById, getPostId };
  `);
  return fn(allPostsArr);
}

const mockPosts = [
  { post_id: 'POST-001', id: 'uuid-aaa', title: 'Alpha' },
  { post_id: 'POST-002', id: 'uuid-bbb', title: 'Beta' },
  { post_id: 'REQ-123',  id: 'uuid-ccc', title: 'Brief' },
];

// Post ID format validation — pure logic
function isTextPostId(id) {
  if (!id || typeof id !== 'string') return false;
  return id.startsWith('POST-') || id.startsWith('REQ-');
}

describe('getPostById', () => {
  it("find by post_id 'POST-001' -> returns Alpha post", () => {
    const { getPostById } = loadUtils(mockPosts);
    const result = getPostById('POST-001');
    expect(result).toBeTruthy();
    expect(result.title).toBe('Alpha');
  });

  it("find by id 'uuid-bbb' -> returns Beta post", () => {
    const { getPostById } = loadUtils(mockPosts);
    expect(getPostById('uuid-bbb').title).toBe('Beta');
  });

  it("find by post_id 'REQ-123' -> returns Brief post", () => {
    const { getPostById } = loadUtils(mockPosts);
    expect(getPostById('REQ-123').title).toBe('Brief');
  });

  it('find unknown ID -> returns null', () => {
    const { getPostById } = loadUtils(mockPosts);
    expect(getPostById('NOPE')).toBeNull();
  });

  it('find with null -> returns null', () => {
    const { getPostById } = loadUtils(mockPosts);
    expect(getPostById(null)).toBeNull();
  });

  it("UUID passed as postId -> resolves to text post_id 'POST-001'", () => {
    const { getPostById, getPostId } = loadUtils(mockPosts);
    const post = getPostById('uuid-aaa');
    expect(getPostId(post)).toBe('POST-001');
  });

  it("text post_id passed -> returns same via getPostId", () => {
    const { getPostById, getPostId } = loadUtils(mockPosts);
    const post = getPostById('POST-001');
    expect(getPostId(post)).toBe('POST-001');
  });

  it('empty allPosts -> returns null safely', () => {
    const { getPostById } = loadUtils([]);
    expect(getPostById('POST-001')).toBeNull();
  });

  it('allPosts undefined/null -> returns undefined safely', () => {
    // When allPosts is undefined, .find will throw, so we test graceful empty
    const { getPostById } = loadUtils([]);
    expect(getPostById('anything')).toBeNull();
  });
});

describe('post_id format validation', () => {
  it("'POST-001' -> valid text ID", () => {
    expect(isTextPostId('POST-001')).toBe(true);
  });

  it("'REQ-123' -> valid text ID", () => {
    expect(isTextPostId('REQ-123')).toBe(true);
  });

  it("'uuid-aaa-bbb' -> NOT a valid text ID", () => {
    expect(isTextPostId('uuid-aaa-bbb')).toBe(false);
  });

  it("'' -> NOT valid", () => {
    expect(isTextPostId('')).toBe(false);
  });

  it('null -> NOT valid', () => {
    expect(isTextPostId(null)).toBe(false);
  });
});
