import { describe, it, expect, beforeEach } from 'vitest';

describe('AppState posts group', function() {

  beforeEach(function() {
    window._appStateDevMode = false;
    window.AppState = {
      posts: {
        all: [],
        cached: [],
        loaded: false,
        source: null,
        parked: [],
        activityLogs: [],
        activityFetched: false,
        setAll: function(newPosts) {
          if (window._appStateDevMode) {
            var ids = newPosts.map(function(p) { return p.post_id; });
            var uniqueIds = new Set(ids);
            if (ids.length !== uniqueIds.size) {
              console.warn('LEGACY STATE WARNING: Duplicate post_ids detected.');
            }
          }
          window.AppState.posts.all = newPosts;
        }
      }
    };
  });

  // -- PART 1: CORE MECHANICS (8 tests) --

  it('1. AppState.posts.all initializes as empty array', function() {
    expect(Array.isArray(window.AppState.posts.all)).toBe(true);
    expect(window.AppState.posts.all.length).toBe(0);
  });

  it('2. Can write hydrated array to AppState.posts.all', function() {
    window.AppState.posts.setAll([
      { post_id: 'p1', title: 'Sugar King', stage: 'ready' },
      { post_id: 'p2', title: 'KIAAR', stage: 'awaiting_approval' }
    ]);
    expect(window.AppState.posts.all.length).toBe(2);
    expect(window.AppState.posts.all[0].post_id).toBe('p1');
    expect(window.AppState.posts.all[1].stage).toBe('awaiting_approval');
  });

  it('3. Can find a specific post from AppState.posts.all', function() {
    window.AppState.posts.setAll([
      { post_id: 'p1', title: 'Sugar King' },
      { post_id: 'p2', title: 'KIAAR' }
    ]);
    var found = window.AppState.posts.all.find(function(p) {
      return p.post_id === 'p2';
    });
    expect(found).toBeDefined();
    expect(found.title).toBe('KIAAR');
    expect(window.AppState.posts.all.length).toBe(2);
  });

  it('4. Concat pattern works - replaces allPosts.push', function() {
    window.AppState.posts.setAll([{ post_id: 'p1' }]);
    window.AppState.posts.all = window.AppState.posts.all.concat([
      { post_id: 'p2', stage: 'ready' }
    ]);
    expect(window.AppState.posts.all.length).toBe(2);
    expect(window.AppState.posts.all[1].post_id).toBe('p2');
  });

  it('5. Filter pattern works - replaces allPosts.splice', function() {
    window.AppState.posts.setAll([
      { post_id: 'p1' },
      { post_id: 'p2' },
      { post_id: 'p3' }
    ]);
    window.AppState.posts.all = window.AppState.posts.all.filter(function(p) {
      return p.post_id !== 'p2';
    });
    expect(window.AppState.posts.all.length).toBe(2);
    expect(window.AppState.posts.all.find(function(p) {
      return p.post_id === 'p2';
    })).toBeUndefined();
  });

  it('6. Map pattern works - replaces allPosts[idx].x = y', function() {
    window.AppState.posts.setAll([
      { post_id: 'p1', stage: 'ready' },
      { post_id: 'p2', stage: 'ready' }
    ]);
    window.AppState.posts.all = window.AppState.posts.all.map(function(p) {
      return p.post_id === 'p1'
        ? Object.assign({}, p, { stage: 'awaiting_approval' })
        : p;
    });
    expect(window.AppState.posts.all[0].stage).toBe('awaiting_approval');
    expect(window.AppState.posts.all[1].stage).toBe('ready');
  });

  it('7. AppState.posts.loaded initializes as false', function() {
    expect(window.AppState.posts.loaded).toBe(false);
  });

  it('8. AppState.posts.cached initializes as empty array', function() {
    expect(Array.isArray(window.AppState.posts.cached)).toBe(true);
    expect(window.AppState.posts.cached.length).toBe(0);
  });

  // -- PART 2: IMMUTABILITY GUARANTEE (1 test) --

  it('9. Every mutation creates a new array reference', function() {
    window.AppState.posts.setAll([{ post_id: 'p1' }]);
    var ref1 = window.AppState.posts.all;

    window.AppState.posts.all = window.AppState.posts.all.concat([
      { post_id: 'p2' }
    ]);
    var ref2 = window.AppState.posts.all;
    expect(ref1).not.toBe(ref2);

    window.AppState.posts.all = window.AppState.posts.all.filter(function(p) {
      return p.post_id !== 'p2';
    });
    var ref3 = window.AppState.posts.all;
    expect(ref2).not.toBe(ref3);

    window.AppState.posts.all = window.AppState.posts.all.map(function(p) {
      return Object.assign({}, p, { stage: 'ready' });
    });
    var ref4 = window.AppState.posts.all;
    expect(ref3).not.toBe(ref4);
  });

  // -- PART 3: CRITICAL EDGE CASES (4 tests) --

  it('10. EC-9: Map with nonexistent post_id returns array unharmed', function() {
    window.AppState.posts.setAll([{ post_id: 'p1', stage: 'ready' }]);
    window.AppState.posts.all = window.AppState.posts.all.map(function(p) {
      return p.post_id === 'nonexistent'
        ? Object.assign({}, p, { stage: 'approved' })
        : p;
    });
    expect(window.AppState.posts.all.length).toBe(1);
    expect(window.AppState.posts.all[0].stage).toBe('ready');
  });

  it('11. EC-11: post_comments survive Object.assign mutation', function() {
    window.AppState.posts.setAll([{
      post_id: 'p1',
      stage: 'ready',
      post_comments: [
        { id: 'c1', message: 'Please change this line' }
      ]
    }]);
    window.AppState.posts.all = window.AppState.posts.all.map(function(p) {
      return p.post_id === 'p1'
        ? Object.assign({}, p, { stage: 'awaiting_approval' })
        : p;
    });
    expect(window.AppState.posts.all[0].post_comments.length).toBe(1);
    expect(window.AppState.posts.all[0].post_comments[0].message)
      .toBe('Please change this line');
  });

  it('12. EC-12: images array survives Object.assign mutation', function() {
    window.AppState.posts.setAll([{
      post_id: 'p1',
      stage: 'ready',
      images: [
        'https://pub-6a2a4aa8073d454ab9aeee69ef841635.r2.dev/img1.jpg',
        'https://pub-6a2a4aa8073d454ab9aeee69ef841635.r2.dev/img2.jpg'
      ]
    }]);
    window.AppState.posts.all = window.AppState.posts.all.map(function(p) {
      return p.post_id === 'p1'
        ? Object.assign({}, p, { stage: 'awaiting_approval' })
        : p;
    });
    expect(window.AppState.posts.all[0].images.length).toBe(2);
  });

  it('13. EC-13: posts.cached is independent from posts.all', function() {
    var sharedData = [{ post_id: 'p1' }];
    window.AppState.posts.setAll(sharedData);
    window.AppState.posts.cached = sharedData;
    window.AppState.posts.all = window.AppState.posts.all.concat([
      { post_id: 'p2' }
    ]);
    expect(window.AppState.posts.all.length).toBe(2);
    expect(window.AppState.posts.cached.length).toBe(1);
  });

});
