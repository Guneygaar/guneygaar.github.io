import { describe, it, expect, beforeEach } from 'vitest';

describe('AppState compat layer', function() {

  beforeEach(function() {
    window.AppState = {
      user: {
        name: null,
        email: null,
        role: null,
        effectiveRole: null,
        previewRole: null
      },
      posts: { all: [], cached: [], loaded: false,
        source: null, parked: [],
        activityLogs: [], activityFetched: false },
      pcs: { open: false, postId: null, post: null,
        editingTarget: null, closeTimer: null,
        pendingComment: null,
        lightbox: { images: [], index: 0 },
        activeMenu: null },
      ui: { modalOpen: false, deferredRender: false,
        activeTab: null, taskFilter: null,
        pipelineFilter: [], nrsUrgency: 'normal',
        retryCount: 0, retryTimer: null,
        realtimeTimer: null, unreadCount: 0 },
      timers: { dashDatetime: null, renderTimer: null }
    };

    delete window.currentRole;
    Object.defineProperty(window, 'currentRole', {
      get: function() { return window.AppState.user.role; },
      set: function(v) { window.AppState.user.role = v; },
      configurable: true
    });

    delete window.effectiveRole;
    Object.defineProperty(window, 'effectiveRole', {
      get: function() { return window.AppState.user.effectiveRole; },
      set: function(v) { window.AppState.user.effectiveRole = v; },
      configurable: true
    });
  });

  it('window.AppState is defined', function() {
    expect(window.AppState).toBeDefined();
    expect(window.AppState.user).toBeDefined();
  });

  it('writing to currentRole mutates AppState.user.role', function() {
    window.currentRole = 'Admin';
    expect(window.AppState.user.role).toBe('Admin');
  });

  it('writing to AppState.user.role mutates currentRole', function() {
    window.AppState.user.role = 'Servicing';
    expect(window.currentRole).toBe('Servicing');
  });

  it('writing to effectiveRole mutates AppState.user.effectiveRole', function() {
    window.effectiveRole = 'Creative';
    expect(window.AppState.user.effectiveRole).toBe('Creative');
  });

  it('writing to AppState.user.effectiveRole mutates effectiveRole', function() {
    window.AppState.user.effectiveRole = 'Client';
    expect(window.effectiveRole).toBe('Client');
  });

  it('aliases are independent - currentRole does not affect effectiveRole', function() {
    window.currentRole = 'Admin';
    window.effectiveRole = 'Creative';
    expect(window.AppState.user.role).toBe('Admin');
    expect(window.AppState.user.effectiveRole).toBe('Creative');
  });

});
