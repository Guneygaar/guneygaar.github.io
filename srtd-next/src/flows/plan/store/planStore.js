// Plan flow Zustand store. Mirrors the spec state shape + actions.
// Data access through planApi.js. Role is set from the App bridge
// at mount time via setRole(); components read it via the hook.

import { create } from 'zustand';
import {
  fetchPlanPosts,
  fetchPostMetrics,
  fetchReasonComments,
  fetchCaptionAndImages,
  fetchPlanRequests,
  rescheduleTarget as apiReschedule
} from '../api/planApi.js';

function currentMonthRange() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const firstLocal = new Date(y, m, 1);
  const lastLocal = new Date(y, m + 1, 0);
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return { monthStart: iso(firstLocal), monthEnd: iso(lastLocal) };
}

function monthEndISOFromStartISO(monthStartISO) {
  // Input: 'YYYY-MM-01'. Output: 'YYYY-MM-DD' (last day of month).
  const parts = (monthStartISO || '').split('-');
  if (parts.length !== 3) return monthStartISO;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  if (!y || !m) return monthStartISO;
  const last = new Date(y, m, 0);
  const pad = (n) => String(n).padStart(2, '0');
  return `${y}-${pad(m)}-${pad(last.getDate())}`;
}

function normalizeMonthStartISO(anyISO) {
  // Coerces any 'YYYY-MM-DD' to 'YYYY-MM-01'.
  const parts = (anyISO || '').split('-');
  if (parts.length !== 3) return anyISO;
  return `${parts[0]}-${parts[1]}-01`;
}

function monthStartISOForDate(dateISO) {
  // 'YYYY-MM-DD' -> 'YYYY-MM-01'. Returns '' on unparseable input.
  const parts = (dateISO || '').split('-');
  if (parts.length !== 3) return '';
  return `${parts[0]}-${parts[1]}-01`;
}

const DEFAULT_RANGE = currentMonthRange();

export const usePlanStore = create((set, get) => ({
  posts: [],
  loadedMonths: [],
  metrics: {},
  reasons: {},
  requests: [],
  requestsLoading: false,
  requestsError: null,
  currentPost: null,
  currentView: 'board',
  currentFilter: { stage: 'all' },
  currentDay: null,
  activeSheet: null,
  toast: { msg: '', undoAction: null, visible: false, timerId: null },
  theme: 'light',
  role: 'admin',
  monthStart: DEFAULT_RANGE.monthStart,
  monthEnd: DEFAULT_RANGE.monthEnd,
  loading: false,
  loadError: null,
  insightsPeriod: 'month',

  async loadData() {
    set({ loading: true, loadError: null, loadedMonths: [], posts: [] });

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const y = now.getFullYear();
    const m = now.getMonth();
    const curStart = `${y}-${pad(m + 1)}-01`;
    const prevDate = new Date(y, m - 1, 1);
    const nextDate = new Date(y, m + 1, 1);
    const prevStart = `${prevDate.getFullYear()}-${pad(prevDate.getMonth() + 1)}-01`;
    const nextStart = `${nextDate.getFullYear()}-${pad(nextDate.getMonth() + 1)}-01`;

    // Year-cap clamp: do not preload months outside the current calendar year.
    // If today is January, skip December of previous year.
    // If today is December, skip January of next year.
    const prevInYear = prevDate.getFullYear() === y;
    const nextInYear = nextDate.getFullYear() === y;

    try {
      const metricsPromise = fetchPostMetrics();
      // Current month first (blocks initial paint).
      await get().loadMonthIfMissing(curStart);
      const metricsById = await metricsPromise;
      set({ metrics: metricsById });
      // Prev + next in background (fire-and-forget), clamped within CURRENT_YEAR.
      if (prevInYear) get().loadMonthIfMissing(prevStart);
      if (nextInYear) get().loadMonthIfMissing(nextStart);
    } catch (err) {
      set({ loading: false, loadError: (err && err.message) || 'Failed to load plan data' });
    }
  },

  async loadMonthIfMissing(monthStartISO) {
    const normStart = normalizeMonthStartISO(monthStartISO);
    if (!normStart) return;
    const { loadedMonths } = get();
    if (loadedMonths.some((m) => m.start === normStart)) return;
    const normEnd = monthEndISOFromStartISO(normStart);

    // Mark loading (optional: we only toggle `loading` if nothing is loaded yet,
    // so the initial mount shows the skeleton but sentinel-triggered fetches stay silent).
    const loadingFlagNeeded = loadedMonths.length === 0;
    if (loadingFlagNeeded) set({ loading: true, loadError: null });

    try {
      const postsRows = await fetchPlanPosts(normStart, normEnd);
      const newMonth = { start: normStart, end: normEnd, posts: Array.isArray(postsRows) ? postsRows : [] };

      // Merge + sort by start ascending.
      const merged = [...get().loadedMonths.filter((m) => m.start !== normStart), newMonth]
        .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));

      // Flat posts view for legacy selectors (useCalendarPosts, usePosts, etc.).
      const flatPosts = merged.flatMap((m) => m.posts);

      // Widen monthStart/monthEnd to the overall loaded range.
      const overallStart = merged[0] ? merged[0].start : get().monthStart;
      const overallEnd = merged[merged.length - 1] ? merged[merged.length - 1].end : get().monthEnd;

      // Reasons fetch for rejected/parked rows in the new month.
      const reasonCandidates = (newMonth.posts || [])
        .filter((p) => p.stage === 'rejected' || p.stage === 'parked')
        .map((p) => p.post_id)
        .filter(Boolean);
      let reasonsAdditions = {};
      if (reasonCandidates.length > 0) {
        try {
          reasonsAdditions = await fetchReasonComments(reasonCandidates);
        } catch (err) {
          reasonsAdditions = {};
        }
      }

      set({
        loadedMonths: merged,
        posts: flatPosts,
        reasons: { ...get().reasons, ...reasonsAdditions },
        monthStart: overallStart,
        monthEnd: overallEnd,
        loading: false
      });
    } catch (err) {
      set({ loading: false, loadError: (err && err.message) || 'Failed to load month' });
    }
  },

  async loadRequests() {
    set({ requestsLoading: true, requestsError: null });
    try {
      const rows = await fetchPlanRequests();
      set({ requests: Array.isArray(rows) ? rows : [], requestsLoading: false });
    } catch (err) {
      set({ requestsLoading: false, requestsError: (err && err.message) || 'Failed to load briefs' });
    }
  },

  async loadCaptionFor(post) {
    if (!post || !post.id) return;
    if (post.caption != null && post.images != null) return;
    try {
      const row = await fetchCaptionAndImages(post.id);
      if (!row) return;
      const transform = (p) => p.id === post.id ? { ...p, caption: row.caption, images: row.images } : p;
      const posts = get().posts.map(transform);
      const newLoadedMonths = get().loadedMonths.map((mo) => ({
        ...mo,
        posts: (mo.posts || []).map(transform)
      }));
      const cur = get().currentPost;
      const nextCur = cur && cur.id === post.id ? { ...cur, caption: row.caption, images: row.images } : cur;
      set({ posts, loadedMonths: newLoadedMonths, currentPost: nextCur });
    } catch (err) {
      // Silent - card sheet renders without caption if this fails.
    }
  },

  getPostsForDate(dateISO) {
    if (!dateISO) return [];
    const key = String(dateISO).slice(0, 10);
    const { posts } = get();
    return posts.filter((p) => (p.target_date || '').slice(0, 10) === key);
  },

  setView(v) { set({ currentView: v }); },
  setFilter(f) { set({ currentFilter: f || { stage: 'all' } }); },
  clearFilter() { set({ currentFilter: { stage: 'all' } }); },

  openMiniCard(post) {
    set({ currentPost: post, activeSheet: 'miniCard' });
    if (post && (post.caption == null || post.images == null)) {
      get().loadCaptionFor(post);
    }
  },
  closeMiniCard() { set({ currentPost: null, activeSheet: null }); },

  openDay(d) { set({ currentDay: d, activeSheet: 'day' }); },
  closeDay() { set({ currentDay: null, activeSheet: null }); },

  openMenu() { set({ activeSheet: 'menu' }); },
  closeMenu() { set({ activeSheet: null }); },

  openFab() { set({ activeSheet: 'fab' }); },
  closeFab() { set({ activeSheet: null }); },

  closeSheet() { set({ activeSheet: null, currentPost: null, currentDay: null }); },

  navigateMiniCard(direction) {
    const { posts, currentPost } = get();
    if (!currentPost || posts.length === 0) return;
    const sorted = [...posts].sort((a, b) => {
      const da = a.target_date || '';
      const db = b.target_date || '';
      if (da !== db) return da < db ? -1 : 1;
      const pa = a.post_id || '';
      const pb = b.post_id || '';
      return pa < pb ? -1 : pa > pb ? 1 : 0;
    });
    const idx = sorted.findIndex((p) => p.id === currentPost.id);
    if (idx < 0) return;
    const next = direction === 'next' ? idx + 1 : idx - 1;
    if (next < 0 || next >= sorted.length) return;
    const target = sorted[next];
    set({ currentPost: target });
    if (target.caption == null || target.images == null) {
      get().loadCaptionFor(target);
    }
  },

  async rescheduleTarget(postIdUuid, newDateISO) {
    const { loadedMonths, posts, currentPost } = get();

    // Locate the post inside loadedMonths.
    let oldMonthStart = null;
    let target = null;
    for (const mo of loadedMonths) {
      const hit = (mo.posts || []).find((p) => p.id === postIdUuid);
      if (hit) {
        oldMonthStart = mo.start;
        target = hit;
        break;
      }
    }

    // Fallback: post may live only in the flat posts array (edge case).
    if (!target) {
      target = posts.find((p) => p.id === postIdUuid);
    }
    if (!target) return;

    const oldDate = target.target_date;
    if (oldDate === newDateISO) return;

    const newMonthStart = monthStartISOForDate(newDateISO);
    const newMonthIsLoaded = loadedMonths.some((m) => m.start === newMonthStart);

    // Build the updated post object.
    const updatedPost = { ...target, target_date: newDateISO };

    // Produce newLoadedMonths with the post moved between months if both old + new are loaded,
    // otherwise update in place within its current month.
    let newLoadedMonths;
    if (oldMonthStart && newMonthIsLoaded && oldMonthStart !== newMonthStart) {
      // Cross-month move: remove from old, append to new.
      newLoadedMonths = loadedMonths.map((mo) => {
        if (mo.start === oldMonthStart) {
          return { ...mo, posts: (mo.posts || []).filter((p) => p.id !== postIdUuid) };
        }
        if (mo.start === newMonthStart) {
          return { ...mo, posts: [...(mo.posts || []), updatedPost] };
        }
        return mo;
      });
    } else if (oldMonthStart) {
      // Same-month move OR target month not loaded: update in place in old month.
      newLoadedMonths = loadedMonths.map((mo) => {
        if (mo.start === oldMonthStart) {
          return {
            ...mo,
            posts: (mo.posts || []).map((p) => p.id === postIdUuid ? updatedPost : p)
          };
        }
        return mo;
      });
    } else {
      // Post not found in any month (fallback): leave loadedMonths alone.
      newLoadedMonths = loadedMonths;
    }

    const nextFlatPosts = newLoadedMonths.length > 0
      ? newLoadedMonths.flatMap((m) => m.posts)
      : posts.map((p) => p.id === postIdUuid ? updatedPost : p);

    const nextCur = currentPost && currentPost.id === postIdUuid
      ? { ...currentPost, target_date: newDateISO }
      : currentPost;

    set({ loadedMonths: newLoadedMonths, posts: nextFlatPosts, currentPost: nextCur });

    const parts = (newDateISO || '').split('-');
    const d = parts.length === 3 ? new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])) : null;
    const DOWS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const msg = d
      ? `Moved to ${d.getDate()} ${MONTHS[d.getMonth()]} - ${DOWS[d.getDay()]}`
      : 'Moved';

    get().showToast({
      msg,
      duration: 4000,
      undoAction: () => get().rescheduleTarget(postIdUuid, oldDate)
    });

    try {
      await apiReschedule(postIdUuid, newDateISO);
    } catch (err) {
      // Rollback on failure: reverse the move optimistically.
      const curLoadedMonths = get().loadedMonths;
      const curPosts = get().posts;
      const revertedPost = { ...updatedPost, target_date: oldDate };

      let revertedMonths;
      if (oldMonthStart && newMonthIsLoaded && oldMonthStart !== newMonthStart) {
        revertedMonths = curLoadedMonths.map((mo) => {
          if (mo.start === newMonthStart) {
            return { ...mo, posts: (mo.posts || []).filter((p) => p.id !== postIdUuid) };
          }
          if (mo.start === oldMonthStart) {
            return { ...mo, posts: [...(mo.posts || []), revertedPost] };
          }
          return mo;
        });
      } else if (oldMonthStart) {
        revertedMonths = curLoadedMonths.map((mo) => {
          if (mo.start === oldMonthStart) {
            return {
              ...mo,
              posts: (mo.posts || []).map((p) => p.id === postIdUuid ? revertedPost : p)
            };
          }
          return mo;
        });
      } else {
        revertedMonths = curLoadedMonths;
      }

      const revertFlat = revertedMonths.length > 0
        ? revertedMonths.flatMap((m) => m.posts)
        : curPosts.map((p) => p.id === postIdUuid ? revertedPost : p);

      const curNow = get().currentPost;
      const revertCur = curNow && curNow.id === postIdUuid
        ? { ...curNow, target_date: oldDate }
        : curNow;
      set({ loadedMonths: revertedMonths, posts: revertFlat, currentPost: revertCur });
      get().showToast({ msg: 'Reschedule failed', duration: 3000, undoAction: null });
    }
  },

  showToast({ msg, duration, undoAction }) {
    const cur = get().toast;
    if (cur && cur.timerId) clearTimeout(cur.timerId);
    const dur = typeof duration === 'number' ? duration : 3000;
    const timerId = setTimeout(() => {
      set({ toast: { msg: '', undoAction: null, visible: false, timerId: null } });
    }, dur);
    set({ toast: { msg: String(msg || ''), undoAction: undoAction || null, visible: true, timerId } });
  },

  dismissToast() {
    const cur = get().toast;
    if (cur && cur.timerId) clearTimeout(cur.timerId);
    set({ toast: { msg: '', undoAction: null, visible: false, timerId: null } });
  },

  setTheme(t) {
    set({ theme: t === 'dark' ? 'dark' : 'light' });
  },

  setRole(r) {
    const norm = (r || '').toLowerCase();
    const role = (norm === 'admin' || norm === 'agency' || norm === 'client') ? norm : 'agency';
    set({ role });
  },

  setMonthRange(monthStart, monthEnd) {
    set({ monthStart, monthEnd });
  },

  setInsightsPeriod(p) {
    const allowed = p === 'week' || p === 'month' || p === 'quarter';
    set({ insightsPeriod: allowed ? p : 'month' });
  },

  initializeDefaultView(role) {
    const defaults = { client: 'calendar', admin: 'board', agency: 'board' };
    set({ currentView: defaults[role] || 'board' });
  }
}));
