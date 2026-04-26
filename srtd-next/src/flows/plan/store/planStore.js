// Plan flow Zustand store. Mirrors the spec state shape + actions.
// Data access through planApi.js. Role is set from the App bridge
// at mount time via setRole(); components read it via the hook.

import { create } from 'zustand';
import {
  fetchPlanPosts,
  fetchPostMetrics,
  fetchReasonComments,
  fetchPlanRequests,
  rescheduleTarget as apiReschedule
} from '../api/planApi.js';
import {
  fetchPlanByWorkspace,
  fetchAnyPlan,
  fetchPlanById,
  fetchPlansForWorkspace,
  fetchPlanCells,
  fetchPlanVersions,
  fetchPlanComments,
  fetchWorkspaceChannels,
  insertPlanCell,
  patchPlanCell,
  patchPlan,
  insertPlanVersion,
  insertPlanComment,
  insertNotification,
  callAlignPlan,
  callSendPlanAlignment,
  generateShareToken,
  callCreatePlan
} from '../api/planTablesApi.js';

function _resolveWorkspaceId() {
  const user = (typeof window !== 'undefined' && window.AppState && window.AppState.user) || null;
  const ws = (typeof window !== 'undefined' && window.AppState && window.AppState.workspace) || null;
  return (user && (user.workspace_id || user.workspaceId)) || (ws && ws.id) || null;
}

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

function currentWeekStartISO() {
  const now = new Date();
  const day = now.getDay();
  const offsetFromMon = (day + 6) % 7;
  const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offsetFromMon);
  const pad = (n) => String(n).padStart(2, '0');
  return `${mon.getFullYear()}-${pad(mon.getMonth() + 1)}-${pad(mon.getDate())}`;
}

function shiftDateISO(iso, deltaDays) {
  const parts = (iso || '').split('-');
  if (parts.length !== 3) return iso;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!y || !m || !d) return iso;
  const next = new Date(y, m - 1, d + deltaDays);
  const pad = (n) => String(n).padStart(2, '0');
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`;
}

const DEFAULT_RANGE = currentMonthRange();
const DEFAULT_WEEK_START = currentWeekStartISO();

export const usePlanStore = create((set, get) => ({
  posts: [],
  loadedMonths: [],
  metrics: {},
  reasons: {},
  requests: [],
  requestsLoading: false,
  requestsError: null,
  notifications: [],
  unreadCount: 0,
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
  calendarMode: 'week',
  currentWeekStart: DEFAULT_WEEK_START,

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

  getPostsForDate(dateISO) {
    if (!dateISO) return [];
    const key = String(dateISO).slice(0, 10);
    const { posts } = get();
    return posts.filter((p) => (p.target_date || '').slice(0, 10) === key);
  },

  setView(v) { set({ currentView: v }); },
  setFilter(f) { set({ currentFilter: f || { stage: 'all' } }); },
  clearFilter() { set({ currentFilter: { stage: 'all' } }); },

  openDay(d) { set({ currentDay: d, activeSheet: 'day' }); },
  closeDay() { set({ currentDay: null, activeSheet: null }); },

  openMenu() { set({ activeSheet: 'menu' }); },
  closeMenu() { set({ activeSheet: null }); },

  openFab() { set({ activeSheet: 'fab' }); },
  closeFab() { set({ activeSheet: null }); },

  closeSheet() { set({ activeSheet: null, currentDay: null }); },

  async rescheduleTarget(postIdUuid, newDateISO) {
    const { loadedMonths, posts } = get();

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

    set({ loadedMonths: newLoadedMonths, posts: nextFlatPosts });

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

      set({ loadedMonths: revertedMonths, posts: revertFlat });
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
    // PR-C1: keep creative + servicing distinct from the umbrella 'agency'
    // bucket so usePosts can apply vanilla pipeline.js role-scoped filters
    // (creative own-only briefs, servicing brief gating). 'agency' stays
    // as the unrecognised-role fallback.
    const allowed = new Set(['admin', 'agency', 'client', 'creative', 'servicing']);
    set({ role: allowed.has(norm) ? norm : 'agency' });
  },

  setMonthRange(monthStart, monthEnd) {
    set({ monthStart, monthEnd });
  },

  // PR-A: thin setState wrappers used by realtimeBridge.js to push
  // window-event snapshots (sorted:posts-updated /
  // sorted:notifications-updated) into the store. Vanilla owns the
  // Supabase channels; React only consumes the resulting AppState
  // snapshots.
  //
  // PR-C1: for agency roles (admin/creative/servicing/agency) we KEEP
  // _isRequest:true rows because vanilla mergePosts already converts
  // pending+assigned requests into brief-stage cards inside
  // AppState.posts.all (see 07-post-load.js loadPosts agency branch);
  // dropping them here would hide every brief from the agency Board.
  // Client role still strips them — clients render briefs through the
  // dedicated BriefsAssignedSection / BriefsCompletedSection that read
  // the separate `requests` slot via loadRequests(). Dedup is provided
  // by vanilla mergePosts, which keys on getPostId(); the snapshot we
  // receive is already deduplicated.
  applyPostsSnapshot(detail) {
    if (!detail) return;
    const incoming = Array.isArray(detail.posts) ? detail.posts : [];
    const role = get().role;
    const isClient = role === 'client';
    const nextPosts = isClient
      ? incoming.filter((p) => !p._isRequest)
      : incoming;
    const next = { posts: nextPosts };
    if (Array.isArray(detail.requests) && detail.requests.length > 0) {
      next.requests = detail.requests;
    }
    set(next);
  },

  applyNotificationsSnapshot(detail) {
    if (!detail) return;
    const next = {};
    if (Array.isArray(detail.notifications)) {
      next.notifications = detail.notifications;
    }
    if (typeof detail.unreadCount === 'number') {
      next.unreadCount = detail.unreadCount;
    } else if (Array.isArray(detail.notifications)) {
      next.unreadCount = detail.notifications.filter((n) => !n.read).length;
    }
    if (Object.keys(next).length === 0) return;
    set(next);
  },

  setInsightsPeriod(p) {
    const allowed = p === 'week' || p === 'month' || p === 'quarter';
    set({ insightsPeriod: allowed ? p : 'month' });
  },

  initializeDefaultView(role) {
    const defaults = {
      client: 'calendar',
      admin: 'board',
      agency: 'calendar',
      creative: 'calendar',
      servicing: 'calendar'
    };
    set({ currentView: defaults[role] || 'board' });
  },

  setCalendarMode(mode) {
    const next = mode === 'month' ? 'month' : 'week';
    set({ calendarMode: next });
  },

  setCurrentWeekStart(iso) {
    if (typeof iso !== 'string') return;
    set({ currentWeekStart: iso });
  },

  async loadWeekMonths(weekStartISO) {
    if (!weekStartISO) return;
    const firstMonth = monthStartISOForDate(weekStartISO);
    const lastDay = shiftDateISO(weekStartISO, 6);
    const lastMonth = monthStartISOForDate(lastDay);
    const fn = get().loadMonthIfMissing;
    if (!fn) return;
    await fn(firstMonth);
    if (lastMonth && lastMonth !== firstMonth) {
      await fn(lastMonth);
    }
  },

  // PR-2 Plan view state slice. Holds the active plan + related rows
  // (plan_cells, plan_versions, plan_comments) and active workspace
  // channels. All writes are optimistic with rollback on error.
  plan: null,
  planCells: [],
  planVersions: [],
  planComments: [],
  workspaceChannels: [],
  showWeekends: false,
  planLoading: false,
  planError: null,
  planSheet: null,           // null | 'history' | 'comments' | 'send' | 'align' | 'changes' | 'cell'
  activeCell: null,          // { id?, cell_date, channel, position, concept?, cell_status? }
  activeCellPostId: null,    // when cell_status spawned/linked: post.post_id

  // PR-4: plan creation wizard state.
  wizardOpen: false,
  wizardPresetMonth: null,
  creatingPlan: false,

  setShowWeekends(b) { set({ showWeekends: !!b }); },
  openPlanSheet(name) { set({ planSheet: name || null }); },
  closePlanSheet() { set({ planSheet: null, activeCell: null, activeCellPostId: null }); },
  setActiveCell(cell, postId) { set({ activeCell: cell || null, activeCellPostId: postId || null }); },

  openWizard(presetMonth = null) {
    set({ wizardOpen: true, wizardPresetMonth: presetMonth || null });
  },
  closeWizard() {
    set({ wizardOpen: false, wizardPresetMonth: null });
  },

  // PR-4: create_plan_with_carryovers RPC wrapper. On success, refetch
  // plans + load the new plan into the active slot, fire a toast, and
  // resolve the result so the wizard can close itself.
  async createPlan({ title, period_start, period_end, carryovers }) {
    const wsId = _resolveWorkspaceId();
    if (!wsId) {
      throw new Error('No workspace assigned to profile');
    }
    set({ creatingPlan: true });
    try {
      const res = await callCreatePlan({
        workspace_id: wsId,
        title,
        period_start,
        period_end,
        carryovers: Array.isArray(carryovers) ? carryovers : []
      });
      const planId = res && (res.plan_id || res.planId);
      const cellCount = (res && (res.cell_count || res.cellCount)) || 0;
      const linkedPostCount = (res && (res.linked_post_count || res.linkedPostCount)) || 0;
      if (planId) {
        const full = await fetchPlanById(planId);
        if (full) {
          const [cells, versions, comments, channels] = await Promise.all([
            fetchPlanCells(full.id),
            fetchPlanVersions(full.id),
            fetchPlanComments(full.id),
            fetchWorkspaceChannels(full.workspace_id)
          ]);
          set({
            plan: full,
            planCells: cells,
            planVersions: versions,
            planComments: comments,
            workspaceChannels: channels
          });
        }
      }
      const linkSuffix = linkedPostCount === 1 ? '1 post linked' : `${linkedPostCount} posts linked`;
      get().showToast({
        msg: `${title || 'Plan'} created : ${linkSuffix}`,
        duration: 3000
      });
      set({ creatingPlan: false, wizardOpen: false, wizardPresetMonth: null });
      return { plan_id: planId, cell_count: cellCount, linked_post_count: linkedPostCount };
    } catch (err) {
      set({ creatingPlan: false });
      throw err;
    }
  },

  async loadPlan() {
    set({ planLoading: true, planError: null });
    try {
      const user = (typeof window !== 'undefined' && window.AppState && window.AppState.user) || null;
      const wsId = (user && (user.workspace_id || user.workspaceId)) || null;
      const plan = wsId ? await fetchPlanByWorkspace(wsId) : await fetchAnyPlan();
      if (!plan) {
        set({ plan: null, planCells: [], planVersions: [], planComments: [], workspaceChannels: [], planLoading: false });
        return;
      }
      const [cells, versions, comments, channels] = await Promise.all([
        fetchPlanCells(plan.id),
        fetchPlanVersions(plan.id),
        fetchPlanComments(plan.id),
        fetchWorkspaceChannels(plan.workspace_id)
      ]);
      set({
        plan,
        planCells: cells,
        planVersions: versions,
        planComments: comments,
        workspaceChannels: channels,
        planLoading: false
      });
    } catch (err) {
      set({ planLoading: false, planError: (err && err.message) || 'Failed to load plan' });
    }
  },

  async refreshPlanCells() {
    const cur = get().plan;
    if (!cur) return;
    try {
      const cells = await fetchPlanCells(cur.id);
      set({ planCells: cells });
    } catch (e) { /* swallow; bridge will retry */ }
  },

  async loadAdjacentPlan(direction) {
    const cur = get().plan;
    if (!cur) {
      get().showToast({ msg: 'No plan loaded', duration: 2000 });
      return;
    }
    try {
      const all = await fetchPlansForWorkspace(cur.workspace_id);
      if (!Array.isArray(all) || all.length === 0) return;
      const idx = all.findIndex((p) => p.id === cur.id);
      const target = direction === 'prev' ? all[idx - 1] : all[idx + 1];
      if (!target) {
        if (direction === 'prev') {
          get().showToast({ msg: 'No earlier plan', duration: 2000 });
        } else {
          get().showToast({ msg: 'No later plan. Create plan? (PR-3)', duration: 2500 });
        }
        return;
      }
      const full = await fetchPlanById(target.id);
      if (!full) return;
      const [cells, versions, comments] = await Promise.all([
        fetchPlanCells(full.id),
        fetchPlanVersions(full.id),
        fetchPlanComments(full.id)
      ]);
      set({ plan: full, planCells: cells, planVersions: versions, planComments: comments });
    } catch (err) {
      get().showToast({ msg: 'Could not load adjacent plan', duration: 2500 });
    }
  },

  async addPlanCell({ cell_date, channel, concept, position }) {
    const plan = get().plan;
    if (!plan) return;
    const tempId = `temp-${Date.now()}`;
    const optimistic = {
      id: tempId,
      plan_id: plan.id,
      workspace_id: plan.workspace_id,
      cell_date,
      channel,
      concept: concept || '',
      cell_status: 'draft',
      position: typeof position === 'number' ? position : 0,
      reference_image_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    set({ planCells: [...get().planCells, optimistic] });
    try {
      const row = await insertPlanCell({
        plan_id: plan.id,
        workspace_id: plan.workspace_id,
        cell_date,
        channel,
        concept: concept || '',
        cell_status: 'draft',
        position: optimistic.position
      });
      set({
        planCells: get().planCells.map((c) => c.id === tempId ? row : c)
      });
    } catch (err) {
      set({ planCells: get().planCells.filter((c) => c.id !== tempId) });
      get().showToast({ msg: 'Failed to add cell', duration: 2500 });
    }
  },

  async updatePlanCell(cellId, patch) {
    if (!cellId) return;
    const prev = get().planCells.find((c) => c.id === cellId);
    if (!prev) return;
    const next = { ...prev, ...patch, updated_at: new Date().toISOString() };
    set({ planCells: get().planCells.map((c) => c.id === cellId ? next : c) });
    try {
      const row = await patchPlanCell(cellId, patch);
      if (row && row.id) {
        set({ planCells: get().planCells.map((c) => c.id === cellId ? { ...c, ...row } : c) });
      }
    } catch (err) {
      set({ planCells: get().planCells.map((c) => c.id === cellId ? prev : c) });
      get().showToast({ msg: 'Failed to save cell', duration: 2500 });
    }
  },

  async sendPlanForAlignment() {
    const plan = get().plan;
    if (!plan) return;
    const user = (typeof window !== 'undefined' && window.AppState && window.AppState.user) || {};
    try {
      const res = await callSendPlanAlignment({
        plan_id: plan.id,
        user_id: user.id || null,
        user_name: user.name || 'Servicing',
        user_role: user.role || 'Servicing',
        workspace_id: plan.workspace_id
      });
      const newVersion = (res && res.version) || ((plan.current_version || 1) + 1);
      const refreshedPlan = await fetchPlanById(plan.id);
      const refreshedVersions = await fetchPlanVersions(plan.id);
      set({
        plan: refreshedPlan || { ...plan, plan_status: 'awaiting_alignment', current_version: newVersion },
        planVersions: refreshedVersions
      });
      get().showToast({ msg: 'Sent for alignment.', duration: 2500 });
      get().closePlanSheet();
    } catch (err) {
      get().showToast({ msg: 'Send failed', duration: 2500 });
    }
  },

  async alignPlan() {
    const plan = get().plan;
    if (!plan) return;
    const user = (typeof window !== 'undefined' && window.AppState && window.AppState.user) || {};
    try {
      const res = await callAlignPlan({
        plan_id: plan.id,
        client_user_id: user.id,
        client_name: user.name || 'Client',
        workspace_id: plan.workspace_id
      });
      const spawned = (res && res.spawned_count) || 0;
      const [refreshedPlan, refreshedCells, refreshedVersions] = await Promise.all([
        fetchPlanById(plan.id),
        fetchPlanCells(plan.id),
        fetchPlanVersions(plan.id)
      ]);
      set({
        plan: refreshedPlan || { ...plan, plan_status: 'aligned' },
        planCells: refreshedCells,
        planVersions: refreshedVersions
      });
      get().showToast({
        msg: `Plan aligned. ${spawned} post${spawned === 1 ? '' : 's'} created in Brief stage.`,
        duration: 3000
      });
      get().closePlanSheet();
    } catch (err) {
      get().showToast({ msg: 'Align failed', duration: 2500 });
    }
  },

  async sharePlan() {
    const plan = get().plan;
    if (!plan) return;
    try {
      let token = plan.share_token || null;
      if (!token) {
        token = await generateShareToken(plan.id);
        if (token) {
          set({ plan: { ...get().plan, share_token: token } });
        }
      }
      if (!token) {
        get().showToast({ msg: 'Could not create share link', duration: 2500 });
        return;
      }
      const url = `https://app.srtd.io/p/${token}`;
      try {
        if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(url);
        }
      } catch { /* clipboard write best-effort */ }
      get().showToast({
        msg: 'Share link copied. Anyone with link can view + comment.',
        duration: 3000
      });
    } catch (err) {
      get().showToast({ msg: 'Share failed', duration: 2500 });
    }
  },

  async requestChanges(cellIds, message) {
    const plan = get().plan;
    if (!plan) return;
    const ids = Array.isArray(cellIds) ? cellIds : [];
    const user = (typeof window !== 'undefined' && window.AppState && window.AppState.user) || {};
    const nextVersion = (plan.current_version || 1) + 1;
    try {
      const patches = ids.map((id) => patchPlanCell(id, { cell_status: 'changes_requested' }).catch(() => null));
      await Promise.all(patches);
      const updated = await patchPlan(plan.id, {
        plan_status: 'changes_requested',
        current_version: nextVersion,
        updated_at: new Date().toISOString()
      });
      await insertPlanVersion({
        plan_id: plan.id,
        version_number: nextVersion,
        snapshot_jsonb: { cell_ids: ids, message: message || '' },
        trigger_event: 'changes_requested',
        triggered_by: user.id || null,
        triggered_by_name: user.name || null,
        triggered_by_role: user.role || null,
        notes: message || null
      });
      if (message) {
        await insertPlanComment({
          plan_id: plan.id,
          plan_cell_id: null,
          version_number: nextVersion,
          author: user.name || null,
          author_role: user.role || null,
          author_email: user.email || null,
          author_user_id: user.id || null,
          is_external: true,
          message
        });
      }
      const refreshed = await fetchPlanCells(plan.id);
      const refreshedComments = await fetchPlanComments(plan.id);
      const refreshedVersions = await fetchPlanVersions(plan.id);
      set({
        plan: { ...plan, ...updated, plan_status: 'changes_requested', current_version: nextVersion },
        planCells: refreshed,
        planComments: refreshedComments,
        planVersions: refreshedVersions
      });
      await insertNotification({
        user_role: 'Servicing',
        post_id: null,
        type: 'plan_changes_requested',
        message: `Client requested changes on ${ids.length} concept${ids.length === 1 ? '' : 's'}`,
        actor: user.name || 'Client'
      });
      get().showToast({ msg: 'Changes requested', duration: 2500 });
      get().closePlanSheet();
    } catch (err) {
      get().showToast({ msg: 'Could not submit changes', duration: 2500 });
    }
  },

  async addPlanComment({ planCellId, message }) {
    const plan = get().plan;
    if (!plan || !message) return;
    const user = (typeof window !== 'undefined' && window.AppState && window.AppState.user) || {};
    const tempId = `temp-${Date.now()}`;
    const role = (user.role || '').toLowerCase();
    const isExternal = role === 'client';
    const optimistic = {
      id: tempId,
      plan_id: plan.id,
      plan_cell_id: planCellId || null,
      version_number: plan.current_version || 1,
      author: user.name || null,
      author_role: user.role || null,
      author_email: user.email || null,
      author_user_id: user.id || null,
      is_external: isExternal,
      message,
      resolved: false,
      created_at: new Date().toISOString()
    };
    set({ planComments: [...get().planComments, optimistic] });
    try {
      const row = await insertPlanComment({
        plan_id: plan.id,
        plan_cell_id: planCellId || null,
        version_number: plan.current_version || 1,
        author: user.name || null,
        author_role: user.role || null,
        author_email: user.email || null,
        author_user_id: user.id || null,
        is_external: isExternal,
        message
      });
      if (row && row.id) {
        set({ planComments: get().planComments.map((c) => c.id === tempId ? row : c) });
      }
    } catch (err) {
      set({ planComments: get().planComments.filter((c) => c.id !== tempId) });
      get().showToast({ msg: 'Comment failed', duration: 2500 });
    }
  }
}));
