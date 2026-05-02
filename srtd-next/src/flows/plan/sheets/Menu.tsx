// Settings bottom sheet - view switcher, stage filter chips, custom
// date range (stub), admin-only workspace settings, account actions.

import React, { useMemo } from 'react';
import type { ComponentType } from 'react';
import {
  List as ListIcon, LayoutGrid, CalendarDays, BarChart3, BookOpen,
  Check, Settings, X, Plus, Trash2,
  LogOut, SunMoon, StickyNote, FilePlus
} from 'lucide-react';
import { usePlanStore } from '../store/planStore.js';
import { useAllPosts } from '../hooks/usePosts.js';
import {
  STAGE_LABELS, STAGE_COLOR_VAR, STAGE_ORDER_BOARD
} from '../shared/constants.js';

type IconType = ComponentType<{ size?: number; style?: React.CSSProperties }>;
type ViewMeta = { key: string; label: string; Icon: IconType };

const VIEWS: ViewMeta[] = [
  { key: 'plan',     label: 'Plan',     Icon: BookOpen },
  { key: 'board',    label: 'Board',    Icon: LayoutGrid },
  { key: 'list',     label: 'List',     Icon: ListIcon },
  { key: 'calendar', label: 'Calendar', Icon: CalendarDays },
  { key: 'insights', label: 'Insights', Icon: BarChart3 }
];

type ViewRowProps = { view: ViewMeta; current: string; onSelect: (key: string) => void };

function ViewRow({ view, current, onSelect }: ViewRowProps) {
  const active = view.key === current;
  const Icon = view.Icon;
  return (
    <button
      type="button"
      onClick={() => onSelect(view.key)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        width: '100%',
        padding: '12px 16px',
        background: 'transparent',
        border: 'none',
        borderBottom: '1px solid var(--c-divider-subtle)',
        cursor: 'pointer',
        textAlign: 'left'
      }}>
      <Icon size={18} style={{ color: active ? 'var(--c-terracotta-1)' : 'var(--c-text-mid)', flexShrink: 0 }} />
      <span style={{
        flex: 1,
        fontFamily: '"DM Sans", sans-serif',
        fontSize: '14px',
        fontWeight: active ? 600 : 500,
        color: 'var(--c-text-loud)'
      }}>{view.label}</span>
      {active ? <Check size={16} style={{ color: 'var(--c-terracotta-1)' }} /> : null}
    </button>
  );
}

type StageChipProps = { stage: string; count: number; active: boolean; onClick: () => void };

function StageChip({ stage, count, active, onClick }: StageChipProps) {
  const colorVarMap = STAGE_COLOR_VAR as Record<string, string>;
  const labelMap = STAGE_LABELS as Record<string, string>;
  const color = stage === 'all'
    ? 'var(--c-text-dim)'
    : (colorVarMap[stage] ? `var(${colorVarMap[stage]})` : 'var(--c-text-dim)');
  const label = stage === 'all' ? 'All' : (labelMap[stage] || stage);
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '5px 9px',
        borderRadius: '100px',
        border: active ? `1px solid ${color}` : '1px solid var(--c-divider-soft)',
        background: active ? `color-mix(in srgb, ${color} 12%, transparent)` : 'var(--c-bg)',
        fontFamily: '"IBM Plex Mono", monospace',
        fontSize: '9px',
        letterSpacing: '.1em',
        textTransform: 'uppercase',
        color: active ? 'var(--c-text-loud)' : 'var(--c-text-mid)',
        cursor: 'pointer'
      }}>
      {stage !== 'all' ? (
        <span style={{ width: '5px', height: '5px', borderRadius: '5px', background: color }} />
      ) : null}
      {label}
      <span style={{ color: 'var(--c-text-dim)' }}>({count})</span>
    </button>
  );
}

export function Menu() {
  const role = usePlanStore((s: any) => s.role) as string;
  const currentView = usePlanStore((s: any) => s.currentView) as string;
  const setView = usePlanStore((s: any) => s.setView) as (v: string) => void;
  const closeMenu = usePlanStore((s: any) => s.closeMenu) as () => void;
  const currentFilter = usePlanStore((s: any) => s.currentFilter) as { stage?: string } | null;
  const setFilter = usePlanStore((s: any) => s.setFilter) as (f: { stage: string }) => void;
  const showToast = usePlanStore((s: any) => s.showToast) as (t: { msg: string; duration: number }) => void;
  const allPosts = useAllPosts() as Array<{ stage: string }>;
  const monthStart = usePlanStore((s: any) => s.monthStart) as string;
  const monthEnd = usePlanStore((s: any) => s.monthEnd) as string;
  const openWizard = usePlanStore((s: any) => s.openWizard) as () => void;
  const plan = usePlanStore((s: any) => s.plan) as unknown;
  const openDeletePlanSheet = usePlanStore((s: any) => s.openDeletePlanSheet) as () => void;
  const setTheme = usePlanStore((s: any) => s.setTheme) as (t: 'light' | 'dark') => void;
  const canCreatePlan = role === 'servicing' || role === 'admin';

  const counts = useMemo<Record<string, number>>(() => {
    const map: Record<string, number> = { all: allPosts.length };
    const stages = STAGE_ORDER_BOARD as readonly string[];
    for (const s of stages) map[s] = 0;
    for (const p of allPosts) {
      if (map[p.stage] == null) map[p.stage] = 0;
      map[p.stage]++;
    }
    return map;
  }, [allPosts]);

  function selectView(v: string) {
    setView(v);
    closeMenu();
  }

  function selectFilter(stage: string) {
    setFilter({ stage });
    closeMenu();
  }

  // Role-aware stage set. Client sees fewer stages since they do not
  // touch production/brief flows. Everyone sees All.
  const visibleStages = useMemo<string[]>(() => {
    if (role === 'client') {
      return ['awaiting_approval', 'scheduled', 'published'];
    }
    return STAGE_ORDER_BOARD as readonly string[] as string[];
  }, [role]);

  function handleToggleTheme() {
    const w = window as unknown as { toggleTheme?: () => void };
    if (typeof w.toggleTheme === 'function') w.toggleTheme();
    const next = (document.documentElement.dataset.theme === 'dark') ? 'dark' : 'light';
    setTheme(next);
    closeMenu();
  }

  function handleScratchpad() {
    closeMenu();
    const w = window as unknown as { openScratchpadPanel?: () => void };
    if (typeof w.openScratchpadPanel === 'function') w.openScratchpadPanel();
  }

  function handleNewBrief() {
    closeMenu();
    const w = window as unknown as { openClientRequestForm?: () => void };
    if (typeof w.openClientRequestForm === 'function') w.openClientRequestForm();
  }

  function handleSignOut() {
    closeMenu();
    const w = window as unknown as {
      _clearSessionAndLogin?: () => void;
    };
    if (typeof w._clearSessionAndLogin === 'function') {
      w._clearSessionAndLogin();
    } else {
      window.location.reload();
    }
  }

  return (
    <>
      <div
        onClick={closeMenu}
        style={{
          position: 'fixed', inset: 0,
          background: 'var(--backdrop-tint, rgba(0,0,0,.3))',
          zIndex: 2200
        }} />
      <div
        className="plan-mini-card-sheet-enter"
        style={{
          position: 'fixed',
          left: 0, right: 0, bottom: 0,
          maxHeight: '80vh',
          background: 'var(--c-bg)',
          zIndex: 2250,
          borderTopLeftRadius: '14px',
          borderTopRightRadius: '14px',
          display: 'flex',
          flexDirection: 'column',
          maxWidth: '480px',
          margin: '0 auto',
          boxShadow: '0 -30px 80px -20px rgba(0,0,0,.5)',
          overflow: 'hidden',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)'
        }}>
        <header style={{
          display: 'flex',
          alignItems: 'center',
          padding: '12px 12px 10px',
          borderBottom: '1px solid var(--c-divider-soft)'
        }}>
          <div style={{
            flex: 1,
            fontFamily: 'Fraunces, serif',
            fontSize: '18px',
            fontWeight: 500,
            letterSpacing: '-.01em',
            color: 'var(--c-text-loud)',
            paddingLeft: '6px'
          }}>Menu</div>
          <button type="button" aria-label="Close" onClick={closeMenu}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '6px 10px',
              cursor: 'pointer',
              fontFamily: '"IBM Plex Mono", monospace',
              fontSize: '10px',
              letterSpacing: '.12em',
              textTransform: 'uppercase',
              color: 'var(--c-terracotta-1)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}>
            <X size={13} />
            Close
          </button>
        </header>
        <div style={{ overflowY: 'auto' }}>
          {canCreatePlan ? (
            <section>
              <button
                type="button"
                onClick={() => { openWizard(); closeMenu(); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  width: '100%',
                  padding: '14px 16px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: '1px solid var(--c-divider-subtle)',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}>
                <span style={{
                  width: '32px',
                  height: '32px',
                  background: 'var(--c-terracotta-2)',
                  color: '#fff',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Plus size={16} />
                </span>
                <span style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <span style={{
                    fontFamily: '"DM Sans", sans-serif',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: 'var(--c-text-loud)'
                  }}>New plan</span>
                  <span style={{
                    fontFamily: '"DM Sans", sans-serif',
                    fontSize: '12px',
                    color: 'var(--c-text-mid)',
                    marginTop: '2px'
                  }}>Create a plan for any period</span>
                </span>
              </button>
            </section>
          ) : null}
          {canCreatePlan && plan ? (
            <section>
              <button
                type="button"
                onClick={() => { closeMenu(); openDeletePlanSheet(); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  width: '100%',
                  padding: '14px 16px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: '1px solid var(--c-divider-subtle)',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}>
                <span style={{
                  width: '32px',
                  height: '32px',
                  background: 'transparent',
                  border: '1px solid var(--c-red)',
                  color: 'var(--c-red)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Trash2 size={16} />
                </span>
                <span style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <span style={{
                    fontFamily: '"DM Sans", sans-serif',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: 'var(--c-red)'
                  }}>Delete plan</span>
                  <span style={{
                    fontFamily: '"DM Sans", sans-serif',
                    fontSize: '12px',
                    color: 'var(--c-text-mid)',
                    marginTop: '2px'
                  }}>This cannot be undone. Linked posts stay safe.</span>
                </span>
              </button>
            </section>
          ) : null}
          {role !== 'client' ? (
            <section>
              <div style={{
                fontFamily: '"IBM Plex Mono", monospace',
                fontSize: '9px',
                letterSpacing: '.14em',
                textTransform: 'uppercase',
                color: 'var(--c-text-dim)',
                padding: '14px 16px 6px'
              }}>View</div>
              {VIEWS.map((v) => (
                <ViewRow key={v.key} view={v} current={currentView} onSelect={selectView} />
              ))}
            </section>
          ) : null}

          <section>
            <div style={{
              fontFamily: '"IBM Plex Mono", monospace',
              fontSize: '9px',
              letterSpacing: '.14em',
              textTransform: 'uppercase',
              color: 'var(--c-text-dim)',
              padding: '14px 16px 6px'
            }}>Filter by stage</div>
            <div style={{ padding: '4px 16px 14px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              <StageChip
                stage="all"
                count={counts.all || 0}
                active={!currentFilter || currentFilter.stage === 'all'}
                onClick={() => selectFilter('all')}
              />
              {visibleStages.map((s) => (
                <StageChip
                  key={s}
                  stage={s}
                  count={counts[s] || 0}
                  active={!!(currentFilter && currentFilter.stage === s)}
                  onClick={() => selectFilter(s)}
                />
              ))}
            </div>
          </section>

          <section>
            <div style={{
              fontFamily: '"IBM Plex Mono", monospace',
              fontSize: '9px',
              letterSpacing: '.14em',
              textTransform: 'uppercase',
              color: 'var(--c-text-dim)',
              padding: '14px 16px 6px'
            }}>Custom date range</div>
            <div style={{ padding: '0 16px 16px', display: 'flex', gap: '10px' }}>
              <input
                type="date"
                defaultValue={monthStart}
                onChange={() => showToast({ msg: 'Custom date range coming in PR 2', duration: 2000 })}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  background: 'var(--c-bg-2)',
                  border: '1px solid var(--c-divider-soft)',
                  borderRadius: '8px',
                  fontFamily: '"IBM Plex Mono", monospace',
                  fontSize: '11px',
                  color: 'var(--c-text-mid)',
                  WebkitAppearance: 'none'
                }} />
              <input
                type="date"
                defaultValue={monthEnd}
                onChange={() => showToast({ msg: 'Custom date range coming in PR 2', duration: 2000 })}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  background: 'var(--c-bg-2)',
                  border: '1px solid var(--c-divider-soft)',
                  borderRadius: '8px',
                  fontFamily: '"IBM Plex Mono", monospace',
                  fontSize: '11px',
                  color: 'var(--c-text-mid)',
                  WebkitAppearance: 'none'
                }} />
            </div>
          </section>

          {role === 'admin' ? (
            <section>
              <div style={{
                fontFamily: '"IBM Plex Mono", monospace',
                fontSize: '9px',
                letterSpacing: '.14em',
                textTransform: 'uppercase',
                color: 'var(--c-text-dim)',
                padding: '14px 16px 6px'
              }}>Admin</div>
              <button
                type="button"
                onClick={() => showToast({ msg: 'Workspace settings - Admin only - separate build', duration: 2500 })}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  width: '100%',
                  padding: '12px 16px',
                  background: 'transparent',
                  border: 'none',
                  borderTop: '1px solid var(--c-divider-subtle)',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}>
                <Settings size={18} style={{ color: 'var(--c-text-mid)' }} />
                <span style={{
                  flex: 1,
                  fontFamily: '"DM Sans", sans-serif',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: 'var(--c-text-loud)'
                }}>Workspace settings</span>
              </button>
            </section>
          ) : null}

          {/* Account section. Plan overlay (z-index 1400) covers the
              global app-header, leaving the global #prof-trigger and
              #user-menu unreachable; surface those actions here. My
              Profile is intentionally omitted - #prof-overlay is
              z-index 1300 and would render BEHIND Plan; needs a
              separate z-index bump. */}
          <section>
            <div style={{
              fontFamily: '"IBM Plex Mono", monospace',
              fontSize: '9px',
              letterSpacing: '.14em',
              textTransform: 'uppercase',
              color: 'var(--c-text-dim)',
              padding: '14px 16px 6px',
              borderTop: '1px solid var(--c-divider-soft)'
            }}>Account</div>
            <button
              type="button"
              onClick={handleToggleTheme}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                width: '100%',
                padding: '12px 16px',
                background: 'transparent',
                border: 'none',
                borderTop: '1px solid var(--c-divider-subtle)',
                cursor: 'pointer',
                textAlign: 'left'
              }}>
              <SunMoon size={18} style={{ color: 'var(--c-text-mid)' }} />
              <span style={{
                flex: 1,
                fontFamily: '"DM Sans", sans-serif',
                fontSize: '14px',
                fontWeight: 500,
                color: 'var(--c-text-loud)'
              }}>Toggle theme</span>
            </button>
            <button
              type="button"
              onClick={handleScratchpad}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                width: '100%',
                padding: '12px 16px',
                background: 'transparent',
                border: 'none',
                borderTop: '1px solid var(--c-divider-subtle)',
                cursor: 'pointer',
                textAlign: 'left'
              }}>
              <StickyNote size={18} style={{ color: 'var(--c-text-mid)' }} />
              <span style={{
                flex: 1,
                fontFamily: '"DM Sans", sans-serif',
                fontSize: '14px',
                fontWeight: 500,
                color: 'var(--c-text-loud)'
              }}>Scratchpad</span>
            </button>
            {role === 'client' ? (
              <button
                type="button"
                onClick={handleNewBrief}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  width: '100%',
                  padding: '12px 16px',
                  background: 'transparent',
                  border: 'none',
                  borderTop: '1px solid var(--c-divider-subtle)',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}>
                <FilePlus size={18} style={{ color: 'var(--c-amber)' }} />
                <span style={{
                  flex: 1,
                  fontFamily: '"DM Sans", sans-serif',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: 'var(--c-amber)'
                }}>New brief</span>
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleSignOut}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                width: '100%',
                padding: '12px 16px',
                background: 'transparent',
                border: 'none',
                borderTop: '1px solid var(--c-divider-subtle)',
                cursor: 'pointer',
                textAlign: 'left'
              }}>
              <LogOut size={18} style={{ color: 'var(--c-red)' }} />
              <span style={{
                flex: 1,
                fontFamily: '"DM Sans", sans-serif',
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--c-red)'
              }}>Sign out</span>
            </button>
          </section>
        </div>
      </div>
    </>
  );
}
