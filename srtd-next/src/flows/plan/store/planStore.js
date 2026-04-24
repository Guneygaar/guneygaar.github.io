// Plan flow Zustand store. Mirrors the spec state shape + actions.
// Data access through planApi.js. Role is set from the App bridge
// at mount time via setRole(); components read it via the hook.

import { create } from 'zustand';
import {
  fetchPlanPosts,
  fetchPostMetrics,
  fetchReasonComments,
  fetchCaptionAndImages,
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

const DEFAULT_RANGE = currentMonthRange();

export const usePlanStore = create((set, get) => ({
  posts: [],
  metrics: {},
  reasons: {},
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
    set({ loading: true, loadError: null });
    const { monthStart, monthEnd } = get();
    try {
      const [postsRows, metricsById] = await Promise.all([
        fetchPlanPosts(monthStart, monthEnd),
        fetchPostMetrics()
      ]);
      const reasonCandidates = postsRows
        .filter((p) => p.stage === 'rejected' || p.stage === 'parked')
        .map((p) => p.post_id)
        .filter(Boolean);
      let reasonsById = {};
      if (reasonCandidates.length > 0) {
        try {
          reasonsById = await fetchReasonComments(reasonCandidates);
        } catch (err) {
          reasonsById = {};
        }
      }
      set({ posts: postsRows, metrics: metricsById, reasons: reasonsById, loading: false });
    } catch (err) {
      set({ loading: false, loadError: (err && err.message) || 'Failed to load plan data' });
    }
  },

  async loadCaptionFor(post) {
    if (!post || !post.id) return;
    if (post.caption != null && post.images != null) return;
    try {
      const row = await fetchCaptionAndImages(post.id);
      if (!row) return;
      const posts = get().posts.map((p) =>
        p.id === post.id ? { ...p, caption: row.caption, images: row.images } : p
      );
      const cur = get().currentPost;
      const nextCur = cur && cur.id === post.id ? { ...cur, caption: row.caption, images: row.images } : cur;
      set({ posts, currentPost: nextCur });
    } catch (err) {
      // Silent - card sheet renders without caption if this fails.
    }
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
    const { posts, currentPost } = get();
    const target = posts.find((p) => p.id === postIdUuid);
    if (!target) return;
    const oldDate = target.target_date;
    if (oldDate === newDateISO) return;

    const nextPosts = posts.map((p) =>
      p.id === postIdUuid ? { ...p, target_date: newDateISO } : p
    );
    const nextCur = currentPost && currentPost.id === postIdUuid
      ? { ...currentPost, target_date: newDateISO }
      : currentPost;
    set({ posts: nextPosts, currentPost: nextCur });

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
      // Rollback on failure
      const revertPosts = get().posts.map((p) =>
        p.id === postIdUuid ? { ...p, target_date: oldDate } : p
      );
      const curNow = get().currentPost;
      const revertCur = curNow && curNow.id === postIdUuid
        ? { ...curNow, target_date: oldDate }
        : curNow;
      set({ posts: revertPosts, currentPost: revertCur });
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
  }
}));
