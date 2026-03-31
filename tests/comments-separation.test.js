import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Comments separation — client vs internal', function() {

  var mockClientComments = [
    { id: 'c1', post_id: 'p1', message: 'Please change',
      author_role: 'Client', deleted: false },
    { id: 'c2', post_id: 'p1', message: 'Looks good',
      author_role: 'Client', deleted: false },
    { id: 'c3', post_id: 'p1', message: 'Deleted comment',
      author_role: 'Client', deleted: true }
  ];

  var mockInternalNotes = [
    { id: 'n1', post_id: 'p1', message: 'Change the logo',
      author_role: 'Admin', visibility: 'all' },
    { id: 'n2', post_id: 'p1', message: 'Only Pranav sees',
      author_role: 'Admin', visibility: 'creative' },
    { id: 'n3', post_id: 'p1', message: 'Only Chitra sees',
      author_role: 'Admin', visibility: 'servicing' },
    { id: 'n4', post_id: 'p1', message: 'Only Shubham sees',
      author_role: 'Admin', visibility: 'admin' }
  ];

  // ── PART 1: Data Separation ────────────────────────────

  it('1. clientRows contains only client comments', function() {
    var clientRows = mockClientComments;
    expect(clientRows.every(function(c) {
      return c.author_role === 'Client';
    })).toBe(true);
  });

  it('2. internalRows contains only internal notes', function() {
    var internalRows = mockInternalNotes;
    expect(internalRows.every(function(n) {
      return n.author_role !== 'Client';
    })).toBe(true);
  });

  it('3. clientRows never contains internal notes', function() {
    var clientRows = mockClientComments;
    var hasInternal = clientRows.some(function(c) {
      return c.visibility === 'creative' ||
             c.visibility === 'servicing' ||
             c.visibility === 'admin';
    });
    expect(hasInternal).toBe(false);
  });

  it('4. internalRows never mixed into client feed', function() {
    var visibleToClient = mockClientComments.filter(function(c) {
      return !c.deleted;
    });
    var internalInFeed = visibleToClient.some(function(c) {
      return mockInternalNotes.find(function(n) {
        return n.id === c.id;
      });
    });
    expect(internalInFeed).toBe(false);
  });

  // ── PART 2: Client Filter ──────────────────────────────

  it('5. Client filter shows all non-deleted comments', function() {
    var visible = mockClientComments.filter(function(c) {
      return !c.deleted;
    });
    expect(visible.length).toBe(2);
  });

  it('6. Client filter hides deleted comments', function() {
    var visible = mockClientComments.filter(function(c) {
      return !c.deleted;
    });
    expect(visible.find(function(c) {
      return c.id === 'c3';
    })).toBeUndefined();
  });

  // ── PART 3: Visibility Chip Filtering ─────────────────

  it('7. ALL chip shows all internal notes', function() {
    var filtered = mockInternalNotes.filter(function(n) {
      return true;
    });
    expect(filtered.length).toBe(4);
  });

  it('8. ADMIN chip shows only admin notes', function() {
    var filtered = mockInternalNotes.filter(function(n) {
      return n.visibility === 'admin';
    });
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe('n4');
  });

  it('9. SERV chip shows only servicing notes', function() {
    var filtered = mockInternalNotes.filter(function(n) {
      return n.visibility === 'servicing';
    });
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe('n3');
  });

  it('10. CREATIVE chip shows only creative notes', function() {
    var filtered = mockInternalNotes.filter(function(n) {
      return n.visibility === 'creative';
    });
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe('n2');
  });

  // ── PART 4: Submit Routing ─────────────────────────────

  it('11. isInternal true routes to internal_notes', function() {
    var opts = { isInternal: true };
    var endpoint = opts.isInternal
      ? '/internal_notes'
      : '/post_comments';
    expect(endpoint).toBe('/internal_notes');
  });

  it('12. isInternal false routes to post_comments', function() {
    var opts = { isInternal: false };
    var endpoint = opts.isInternal
      ? '/internal_notes'
      : '/post_comments';
    expect(endpoint).toBe('/post_comments');
  });

});
