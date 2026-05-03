// Plan flow entry. Double-gated on ?plan_react=1. Mounts into the
// existing #react-root-new-post slot alongside PCS / CreatePost, but
// renders a full-screen overlay. Wraps tokens scope with
// [data-plan-root] + [data-plan-theme] so Plan palette never leaks.

import React, { useEffect, useMemo, useState } from 'react';
import {
  Search, Bell, MoreVertical, Plus,
  BookOpen, LayoutGrid, List as ListIcon, CalendarDays, BarChart3
} from 'lucide-react';
import { usePlanStore } from './store/planStore.js';
import { isAuthed } from '../../lib/auth';
import {
  startRealtimeBridge, pauseRealtime, resumeRealtime,
  startPlanCellsBridge, stopPlanCellsBridge
} from './store/realtimeBridge.js';
import { usePcsFlowState } from '../pcs/flowStore.js';
import { useAppState } from '../../core/stores/appState';
import { useDatePicker } from './hooks/useDatePicker.js';
import { List } from './views/List.jsx';
import { Board } from './views/Board.jsx';
import { Calendar } from './views/Calendar.jsx';
import { Insights } from './views/Insights.jsx';
import { PlanView, CHANNEL_LABELS } from './views/PlanView.jsx';
import { FilterBanner } from './shared/FilterBanner.jsx';
import { Toast } from './shared/Toast.jsx';
import { DaySheet } from './sheets/DaySheet.jsx';
import { FabSheet } from './sheets/FabSheet.jsx';
import { Menu } from './sheets/Menu.tsx';
import {
  HistoryPanel, CommentsPanel, ConfirmSendSheet,
  ConfirmAlignSheet, ChangesSheet, PlanCellSheet,
  AddConceptOptionsSheet, AttachPostSheet,
  RemoveCellConfirm, DeletePlanConfirm
} from './sheets/PlanSheets.jsx';
import './tokens.css';

function resolveRole(user) {
  if (!user) return 'agency';
  const raw = (user.effectiveRole || user.role || '').toLowerCase();
  if (raw === 'admin') return 'admin';
  if (raw === 'client') return 'client';
  if (raw === 'creative') return 'creative';
  if (raw === 'servicing') return 'servicing';
  return 'agency';
}

function resolveTheme() {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch (e) {
    return 'light';
  }
}

function TopBar() {
  const openMenu = usePlanStore((s) => s.openMenu);
  const currentView = usePlanStore((s) => s.currentView);
  const unreadCount = usePlanStore((s) => s.unreadCount);
  const planCells = usePlanStore((s) => s.planCells);
  const VIEW_TITLES = {
    plan:     'Plan',
    list:     'List',
    board:    'Board',
    calendar: 'Calendar',
    insights: 'Insights'
  };
  const eyebrow = currentView === 'plan' ? '' : (VIEW_TITLES[currentView] || '');
  const planChannelSuffix = useMemo(() => {
    if (currentView !== 'plan') return '';
    if (!Array.isArray(planCells) || planCells.length === 0) return '';
    const seen = new Set();
    const out = [];
    for (const c of planCells) {
      const ch = c && c.channel;
      if (ch && !seen.has(ch)) { seen.add(ch); out.push(ch); }
    }
    if (out.length === 0) return '';
    return out.map((ch) => CHANNEL_LABELS[ch] || ch).join(', ');
  }, [currentView, planCells]);
  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 15,
      background: 'var(--bg)',
      borderBottom: '1px solid var(--border-1)',
      display: 'flex',
      alignItems: 'center',
      padding: '18px 16px',
      gap: '10px'
    }}>
      <div style={{
        flex: 1,
        minWidth: 0,
        fontFamily: '"DM Sans", sans-serif',
        fontSize: '20px',
        fontWeight: 600,
        letterSpacing: '-.01em',
        color: 'var(--text-1)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }}>
        Plan{planChannelSuffix ? (
          <span style={{
            fontWeight: 400,
            fontSize: '16px',
            color: 'var(--text-2)'
          }}> · {planChannelSuffix}</span>
        ) : null}
        {eyebrow ? (
          <span style={{
            fontFamily: '"IBM Plex Mono", monospace',
            fontSize: '9px',
            letterSpacing: '.12em',
            textTransform: 'uppercase',
            color: 'var(--text-3)',
            marginLeft: '8px'
          }}>{eyebrow}</span>
        ) : null}
      </div>
      <button
        type="button"
        aria-label="Search"
        onClick={() => { if (typeof window.openPipelineSearch === 'function') window.openPipelineSearch(); }}
        style={{ background: 'transparent', border: 'none', padding: '6px', cursor: 'pointer', color: 'var(--text-2)' }}>
        <Search size={18} />
      </button>
      <button
        type="button"
        aria-label="Notifications"
        onClick={() => { if (typeof window.openNotifications === 'function') window.openNotifications(); }}
        style={{ position: 'relative', background: 'transparent', border: 'none', padding: '6px', cursor: 'pointer', color: 'var(--text-2)' }}>
        <Bell size={18} />
        {unreadCount > 0 ? (
          <span
            aria-label={`${unreadCount} unread`}
            style={{
              position: 'absolute',
              top: '4px',
              right: '4px',
              width: '8px',
              height: '8px',
              borderRadius: '8px',
              background: 'var(--accent)',
              border: '1.5px solid var(--bg)',
              pointerEvents: 'none'
            }}
          />
        ) : null}
      </button>
      <button
        type="button"
        aria-label="Menu"
        onClick={openMenu}
        style={{ background: 'transparent', border: 'none', padding: '6px', cursor: 'pointer', color: 'var(--text-2)' }}>
        <MoreVertical size={18} />
      </button>
    </header>
  );
}

function TabBar() {
  const currentView = usePlanStore((s) => s.currentView);
  const setView = usePlanStore((s) => s.setView);
  const role = usePlanStore((s) => s.role);
  const ALL_TABS = [
    { key: 'plan',     label: 'Plan',     Icon: BookOpen },
    { key: 'board',    label: 'Board',    Icon: LayoutGrid },
    { key: 'list',     label: 'List',     Icon: ListIcon },
    { key: 'calendar', label: 'Calendar', Icon: CalendarDays },
    { key: 'insights', label: 'Insights', Icon: BarChart3 }
  ];
  // Client is read-only and only sees the Plan tab. Other roles see all five.
  const TABS = role === 'client' ? ALL_TABS.filter((t) => t.key === 'plan') : ALL_TABS;
  const TAB_STYLE = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '3px',
    background: 'transparent',
    border: 'none',
    padding: '8px 0 calc(8px + env(safe-area-inset-bottom, 0px))',
    cursor: 'pointer'
  };
  const LABEL_STYLE = {
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: '8px',
    letterSpacing: '.14em',
    textTransform: 'uppercase'
  };
  return (
    <nav style={{
      position: 'sticky',
      bottom: 0,
      zIndex: 12,
      background: 'var(--c-bg)',
      borderTop: '1px solid var(--c-divider-soft)',
      display: 'flex'
    }}>
      {TABS.map(({ key, label, Icon }) => {
        const active = currentView === key;
        const color = active ? 'var(--c-terracotta-1)' : 'var(--c-text-dim)';
        return (
          <button
            key={key}
            type="button"
            aria-label={label}
            aria-current={active ? 'page' : undefined}
            onClick={() => setView(key)}
            style={TAB_STYLE}>
            <Icon size={16} style={{ color }} />
            <span style={{ ...LABEL_STYLE, color, fontWeight: active ? 600 : 500 }}>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function Fab() {
  const openFab = usePlanStore((s) => s.openFab);
  const role = usePlanStore((s) => s.role);
  const wizardOpen = usePlanStore((s) => s.wizardOpen);
  if (role === 'client') return null;
  if (wizardOpen) return null;
  return (
    <button
      type="button"
      aria-label="Create"
      onClick={openFab}
      style={{
        position: 'fixed',
        right: '18px',
        bottom: 'calc(72px + env(safe-area-inset-bottom, 0px))',
        width: '48px',
        height: '48px',
        borderRadius: '48px',
        background: 'linear-gradient(180deg, var(--c-terracotta-1), var(--c-terracotta-2))',
        color: '#fff',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: 'var(--shadow-fab, 0 12px 32px -8px rgba(0,0,0,.35))',
        zIndex: 14
      }}>
      <Plus size={22} />
    </button>
  );
}

function ViewContainer() {
  const currentView = usePlanStore((s) => s.currentView);
  const loading = usePlanStore((s) => s.loading);
  const loadError = usePlanStore((s) => s.loadError);
  const loadData = usePlanStore((s) => s.loadData);
  if (loading) {
    return (
      <div style={{
        padding: '80px 24px',
        textAlign: 'center',
        fontFamily: '"IBM Plex Mono", monospace',
        fontSize: '10px',
        letterSpacing: '.14em',
        textTransform: 'uppercase',
        color: 'var(--c-text-dim)'
      }}>Loading...</div>
    );
  }
  if (loadError) {
    return (
      <div style={{
        padding: '80px 24px',
        textAlign: 'center',
        fontFamily: '"DM Sans", sans-serif'
      }}>
        <div style={{ fontSize: '13px', color: 'var(--c-red)' }}>{loadError}</div>
        <button
          type="button"
          onClick={() => { usePlanStore.setState({ loadError: null }); loadData(); }}
          style={{
            marginTop: '14px',
            padding: '8px 14px',
            background: 'transparent',
            border: '1px solid var(--c-divider-warm)',
            color: 'var(--c-text-loud)',
            fontFamily: '"IBM Plex Mono", monospace',
            fontSize: '9px',
            letterSpacing: '.14em',
            textTransform: 'uppercase',
            cursor: 'pointer'
          }}>Retry</button>
      </div>
    );
  }
  if (currentView === 'plan') return <PlanView />;
  if (currentView === 'board') return <Board />;
  if (currentView === 'calendar') return <Calendar />;
  if (currentView === 'insights') return <Insights />;
  return <List />;
}

export default function Plan() {
  const planEnabled = useMemo(() => {
    if (typeof window === 'undefined') return false;
    try {
      return new URLSearchParams(window.location.search).get('plan_react') !== '0';
    } catch (e) {
      return false;
    }
  }, []);

  const [authed, setAuthed] = useState(isAuthed());

  useEffect(() => {
    const refresh = () => setAuthed(isAuthed());
    window.addEventListener('sorted:signin', refresh);
    window.addEventListener('sorted:signout', refresh);
    return () => {
      window.removeEventListener('sorted:signin', refresh);
      window.removeEventListener('sorted:signout', refresh);
    };
  }, []);

  const user = useAppState((s) => s.user);
  const loadData = usePlanStore((s) => s.loadData);
  const loadRequests = usePlanStore((s) => s.loadRequests);
  const setRole = usePlanStore((s) => s.setRole);
  const setTheme = usePlanStore((s) => s.setTheme);
  const initializeDefaultView = usePlanStore((s) => s.initializeDefaultView);
  const theme = usePlanStore((s) => s.theme);
  const role = usePlanStore((s) => s.role);
  const activeSheet = usePlanStore((s) => s.activeSheet);
  const planSheet = usePlanStore((s) => s.planSheet);
  const pcsOpen = usePcsFlowState((s) => s.isOpen);

  // Mount the hidden native date input once.
  useDatePicker();

  useEffect(() => {
    if (!planEnabled) return;
    setRole(resolveRole(user));
  }, [planEnabled, user, setRole]);

  useEffect(() => {
    if (!planEnabled || !role) return;
    initializeDefaultView(role);
  }, [planEnabled, role, initializeDefaultView]);

  useEffect(() => {
    if (!planEnabled) return;
    setTheme(resolveTheme());
  }, [planEnabled, setTheme]);

  useEffect(() => {
    if (!planEnabled) return;
    loadData();
  }, [planEnabled, loadData]);

  useEffect(() => {
    if (!planEnabled) return;
    if (role !== 'client') return;
    loadRequests();
  }, [planEnabled, role, loadRequests]);

  // PR-A: subscribe the planStore to vanilla's realtime stream via window
  // events. Bridge is idempotent — a second start returns the same stopFn.
  useEffect(() => {
    if (!planEnabled) return undefined;
    const stop = startRealtimeBridge(usePlanStore);
    return () => { if (typeof stop === 'function') stop(); };
  }, [planEnabled]);

  // PR-2: subscribe to plan_cells changes so SheetGrid stays in sync
  // with concurrent edits. Mirrors realtimeBridge's pause/resume gate.
  useEffect(() => {
    if (!planEnabled) return undefined;
    startPlanCellsBridge(usePlanStore);
    return () => { stopPlanCellsBridge(); };
  }, [planEnabled]);

  // Pause snapshot application while a Plan sheet is open. useEffect
  // cleanup fires even if a render inside the sheet throws, providing
  // try/finally semantics for the resume path.
  useEffect(() => {
    if (!planEnabled || (!activeSheet && !planSheet)) return undefined;
    pauseRealtime();
    return () => resumeRealtime();
  }, [planEnabled, activeSheet, planSheet]);

  // Pause snapshot application while React PCS is open over the Plan tree.
  useEffect(() => {
    if (!planEnabled || !pcsOpen) return undefined;
    pauseRealtime();
    return () => resumeRealtime();
  }, [planEnabled, pcsOpen]);

  // Hard unmount on signout. _clearSessionAndLogin has already wiped storage
  // by the time this fires, so a reload boots straight into the login overlay
  // and nukes any lingering React state from the Plan tree.
  useEffect(() => {
    const handler = () => window.location.reload();
    window.addEventListener('sorted:signout', handler);
    return () => window.removeEventListener('sorted:signout', handler);
  }, []);

  if (!planEnabled || !authed) return null;

  return (
    <div
      data-plan-root=""
      data-plan-theme={theme}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--c-bg)',
        zIndex: 1400,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: '"DM Sans", sans-serif',
        color: 'var(--c-text-loud)',
        overflow: 'hidden'
      }}>
      <TopBar />
      <FilterBanner />
      <main style={{
        flex: 1,
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        scrollPaddingTop: '40px'
      }}>
        <ViewContainer />
      </main>
      <TabBar />
      <Fab />

      {activeSheet === 'menu' ? <Menu /> : null}
      {activeSheet === 'day' ? <DaySheet /> : null}
      {activeSheet === 'fab' ? <FabSheet /> : null}

      {planSheet === 'history' ? <HistoryPanel /> : null}
      {planSheet === 'comments' ? <CommentsPanel /> : null}
      {planSheet === 'send' ? <ConfirmSendSheet /> : null}
      {planSheet === 'align' ? <ConfirmAlignSheet /> : null}
      {planSheet === 'changes' ? <ChangesSheet /> : null}
      {planSheet === 'cell' ? <PlanCellSheet /> : null}
      {planSheet === 'addConcept' ? <AddConceptOptionsSheet /> : null}
      {planSheet === 'attachPicker' ? <AttachPostSheet /> : null}
      {planSheet === 'removeCell' ? <RemoveCellConfirm /> : null}
      {planSheet === 'deletePlan' ? <DeletePlanConfirm /> : null}

      <Toast />
    </div>
  );
}
