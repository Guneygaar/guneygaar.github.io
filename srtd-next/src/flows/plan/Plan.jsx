// Plan flow entry. Double-gated on ?plan_react=1. Mounts into the
// existing #react-root-new-post slot alongside PCS / CreatePost, but
// renders a full-screen overlay. Wraps tokens scope with
// [data-plan-root] + [data-plan-theme] so Plan palette never leaks.

import React, { useEffect, useMemo } from 'react';
import { Search, Bell, MoreVertical, Plus, LayoutDashboard, CalendarDays, Inbox } from 'lucide-react';
import { usePlanStore } from './store/planStore.js';
import { useAppState } from '../../core/stores/appState.js';
import { useDatePicker } from './hooks/useDatePicker.js';
import { List } from './views/List.jsx';
import { Board } from './views/Board.jsx';
import { Calendar } from './views/Calendar.jsx';
import { Insights } from './views/Insights.jsx';
import { FilterBanner } from './shared/FilterBanner.jsx';
import { Toast } from './shared/Toast.jsx';
import { CardSheet } from './sheets/CardSheet.jsx';
import { DaySheet } from './sheets/DaySheet.jsx';
import { FabSheet } from './sheets/FabSheet.jsx';
import { Menu } from './sheets/Menu.jsx';
import './tokens.css';

function resolveRole(user) {
  if (!user) return 'agency';
  const raw = (user.effectiveRole || user.role || '').toLowerCase();
  if (raw === 'admin') return 'admin';
  if (raw === 'client') return 'client';
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
  const showToast = usePlanStore((s) => s.showToast);
  const VIEW_TITLES = {
    list:     'List',
    board:    'Board',
    calendar: 'Calendar',
    insights: 'Insights'
  };
  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 15,
      background: 'var(--c-bg)',
      borderBottom: '1px solid var(--c-divider-soft)',
      display: 'flex',
      alignItems: 'center',
      padding: '10px 12px',
      gap: '10px',
      height: '44px'
    }}>
      <div style={{
        fontFamily: 'Fraunces, serif',
        fontSize: '15px',
        fontWeight: 600,
        letterSpacing: '-.01em',
        color: 'var(--c-text-loud)',
        flex: 1
      }}>
        Plan <span style={{
          fontFamily: '"IBM Plex Mono", monospace',
          fontSize: '9px',
          letterSpacing: '.12em',
          textTransform: 'uppercase',
          color: 'var(--c-text-dim)',
          marginLeft: '8px'
        }}>{VIEW_TITLES[currentView] || ''}</span>
      </div>
      <button
        type="button"
        aria-label="Search"
        onClick={() => showToast({ msg: 'Search coming in PR 2', duration: 2000 })}
        style={{ background: 'transparent', border: 'none', padding: '6px', cursor: 'pointer', color: 'var(--c-text-mid)' }}>
        <Search size={18} />
      </button>
      <button
        type="button"
        aria-label="Notifications"
        onClick={() => showToast({ msg: 'Notifications panel coming in PR 2', duration: 2000 })}
        style={{ background: 'transparent', border: 'none', padding: '6px', cursor: 'pointer', color: 'var(--c-text-mid)' }}>
        <Bell size={18} />
      </button>
      <button
        type="button"
        aria-label="Menu"
        onClick={openMenu}
        style={{ background: 'transparent', border: 'none', padding: '6px', cursor: 'pointer', color: 'var(--c-text-mid)' }}>
        <MoreVertical size={18} />
      </button>
    </header>
  );
}

function TabBar() {
  const showToast = usePlanStore((s) => s.showToast);
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
    fontSize: '8.5px',
    letterSpacing: '.12em',
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
      <button type="button" style={TAB_STYLE} onClick={() => showToast({ msg: 'Dashboard tab lives outside Plan', duration: 2000 })}>
        <LayoutDashboard size={18} style={{ color: 'var(--c-text-dim)' }} />
        <span style={{ ...LABEL_STYLE, color: 'var(--c-text-dim)' }}>Dashboard</span>
      </button>
      <button type="button" style={TAB_STYLE}>
        <CalendarDays size={18} style={{ color: 'var(--c-text-loud)' }} />
        <span style={{ ...LABEL_STYLE, color: 'var(--c-text-loud)' }}>Plan</span>
      </button>
      <button type="button" style={TAB_STYLE} onClick={() => showToast({ msg: 'Inbox tab lives outside Plan', duration: 2000 })}>
        <Inbox size={18} style={{ color: 'var(--c-text-dim)' }} />
        <span style={{ ...LABEL_STYLE, color: 'var(--c-text-dim)' }}>Inbox</span>
      </button>
    </nav>
  );
}

function Fab() {
  const openFab = usePlanStore((s) => s.openFab);
  const role = usePlanStore((s) => s.role);
  if (role === 'client') return null;
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
        boxShadow: '0 12px 32px -8px rgba(0,0,0,.35)',
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
        fontFamily: '"DM Sans", sans-serif',
        fontSize: '13px',
        color: 'var(--c-red)'
      }}>{loadError}</div>
    );
  }
  if (currentView === 'board') return <Board />;
  if (currentView === 'calendar') return <Calendar />;
  if (currentView === 'insights') return <Insights />;
  return <List />;
}

export default function Plan() {
  const planEnabled = useMemo(() => {
    if (typeof window === 'undefined') return false;
    try {
      return new URLSearchParams(window.location.search).get('plan_react') === '1';
    } catch (e) {
      return false;
    }
  }, []);

  const user = useAppState((s) => s.user);
  const loadData = usePlanStore((s) => s.loadData);
  const setRole = usePlanStore((s) => s.setRole);
  const setTheme = usePlanStore((s) => s.setTheme);
  const theme = usePlanStore((s) => s.theme);
  const activeSheet = usePlanStore((s) => s.activeSheet);

  // Mount the hidden native date input once.
  useDatePicker();

  useEffect(() => {
    if (!planEnabled) return;
    setRole(resolveRole(user));
  }, [planEnabled, user, setRole]);

  useEffect(() => {
    if (!planEnabled) return;
    setTheme(resolveTheme());
  }, [planEnabled, setTheme]);

  useEffect(() => {
    if (!planEnabled) return;
    loadData();
  }, [planEnabled, loadData]);

  if (!planEnabled) return null;

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
        WebkitOverflowScrolling: 'touch'
      }}>
        <ViewContainer />
      </main>
      <TabBar />
      <Fab />

      {activeSheet === 'menu' ? <Menu /> : null}
      {activeSheet === 'card' ? <CardSheet /> : null}
      {activeSheet === 'day' ? <DaySheet /> : null}
      {activeSheet === 'fab' ? <FabSheet /> : null}

      <Toast />
    </div>
  );
}
