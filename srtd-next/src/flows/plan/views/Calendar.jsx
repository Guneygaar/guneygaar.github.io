// Infinite vertical stack of month grids. Monday-first. Cells show up
// to 2 thumb previews. Cell tap opens DaySheet. Thumb tap bypasses
// DaySheet and opens PCS directly via the sorted-react bridge. Thumbs
// are draggable across months to reschedule target_date via
// planStore.rescheduleTarget. IntersectionObserver sentinels at the
// top and bottom of the stack lazy-load the previous or next month
// when the user scrolls near the edge of the loaded range.

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable
} from '@dnd-kit/core';
import {
  Download, Loader2, ArrowDown,
  CalendarDays, CalendarRange, ChevronLeft, ChevronRight
} from 'lucide-react';
import { useCalendarPosts } from '../hooks/useCalendarPosts.js';
import { usePlanStore } from '../store/planStore.js';
import { useIsClient } from '../../../core/stores/appState.js';
import {
  parseISODate, buildMonthGrid, buildWeekGrid, sameDay, formatYYYYMMDD,
  dowShortMonFirst, monthAbbr
} from '../shared/dateUtils.js';
import {
  STAGE_COLOR_VAR, PILLAR_LABELS
} from '../shared/constants.js';
import { PillarThumb } from '../shared/PillarThumb.jsx';
import { openInPcs } from '../shared/openInPcs.js';
import { exportCalendarAsPng } from '../hooks/useCalendarExport.js';

const MONTH_NAMES_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DOW_HEADERS = ['M','T','W','T','F','S','S'];

const CURRENT_YEAR = new Date().getFullYear();

function pad2(n) { return String(n).padStart(2, '0'); }

function todayMonthStartISO() {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-01`;
}

function shiftMonthStartISO(monthStartISO, delta) {
  const parts = (monthStartISO || '').split('-');
  if (parts.length !== 3) return monthStartISO;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  if (!y || !m) return monthStartISO;
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-01`;
}

function isMonthInCurrentYear(monthStartISO) {
  const parts = (monthStartISO || '').split('-');
  if (parts.length !== 3) return false;
  return Number(parts[0]) === CURRENT_YEAR;
}

function currentWeekMondayISO() {
  const now = new Date();
  const day = now.getDay();
  const offsetFromMon = (day + 6) % 7;
  const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offsetFromMon);
  return `${mon.getFullYear()}-${pad2(mon.getMonth() + 1)}-${pad2(mon.getDate())}`;
}

function shiftDateISO(iso, deltaDays) {
  const parts = (iso || '').split('-');
  if (parts.length !== 3) return iso;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!y || !m || !d) return iso;
  const next = new Date(y, m - 1, d + deltaDays);
  return `${next.getFullYear()}-${pad2(next.getMonth() + 1)}-${pad2(next.getDate())}`;
}

function formatWeekRangeLabel(startDate) {
  if (!startDate) return '';
  const endDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 6);
  const startMonth = monthAbbr(startDate);
  const endMonth = monthAbbr(endDate);
  if (startMonth === endMonth) {
    return `${startMonth} ${startDate.getDate()} - ${endDate.getDate()}`;
  }
  return `${startMonth} ${startDate.getDate()} - ${endMonth} ${endDate.getDate()}`;
}

function ThumbMini({ post, isOverlay, contextPosts, isClient }) {
  const stageColor = STAGE_COLOR_VAR[post.stage]
    ? `var(${STAGE_COLOR_VAR[post.stage]})`
    : 'var(--c-text-dim)';
  const dim = post.stage === 'rejected' || post.stage === 'parked';
  const approvalInset = post.stage === 'awaiting_approval'
    ? `inset 0 0 0 1.5px ${stageColor}`
    : 'none';

  const draggable = useDraggable({
    id: 'thumb-' + post.id,
    data: { uuid: post.id, target_date: post.target_date, post },
    disabled: !!isOverlay || isClient
  });
  const { attributes, listeners, setNodeRef, isDragging, transform } = draggable;

  const dragStyle = transform && !isOverlay
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 50
      }
    : {};

  return (
    <button
      ref={isOverlay ? undefined : setNodeRef}
      type="button"
      draggable={false}
      onContextMenu={(e) => e.preventDefault()}
      {...(isOverlay ? {} : attributes)}
      {...(isOverlay ? {} : listeners)}
      onClick={(e) => {
        if (isOverlay) return;
        if (window.__planDragActive) return;
        e.stopPropagation();
        openInPcs(post, contextPosts);
      }}
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '16 / 10',
        border: 'none',
        padding: 0,
        cursor: isOverlay ? 'grabbing' : (isDragging ? 'grabbing' : 'pointer'),
        borderRadius: '3px',
        overflow: 'hidden',
        opacity: !isOverlay && isDragging ? 0.3 : (dim ? 0.5 : 1),
        background: 'transparent',
        boxShadow: approvalInset,
        marginBottom: '2px',
        touchAction: 'none',
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        ...dragStyle
      }}>
      <PillarThumb post={post} size="100%" radius={0} labelSize="6px" showLabel={true} />
      <span style={{
        position: 'absolute',
        top: '3px',
        right: '3px',
        width: '4px',
        height: '4px',
        borderRadius: '4px',
        background: stageColor,
        boxShadow: '0 0 0 1px rgba(0,0,0,.4)'
      }} />
      <span style={{
        position: 'absolute',
        bottom: '2px',
        left: '3px',
        color: '#fff',
        fontFamily: '"IBM Plex Mono", monospace',
        fontSize: '6.5px',
        textTransform: 'uppercase',
        letterSpacing: '.06em',
        textShadow: '0 1px 2px rgba(0,0,0,.9)',
        pointerEvents: 'none'
      }}>{PILLAR_LABELS[post.content_pillar] || ''}</span>
    </button>
  );
}

function Cell({ date, posts, isToday, isOffMonth, dateKey, contextPosts, isClient }) {
  const openDay = usePlanStore((s) => s.openDay);
  const preview = posts.slice(0, 2);
  const extra = Math.max(0, posts.length - preview.length);

  const droppableId = dateKey ? 'cell-' + dateKey : null;
  const { setNodeRef, isOver } = useDroppable({
    id: droppableId || 'cell-empty-' + Math.random(),
    disabled: !droppableId
  });

  return (
    <button
      ref={droppableId ? setNodeRef : undefined}
      data-cell-id={droppableId || undefined}
      type="button"
      onClick={() => date && openDay(date)}
      style={{
        position: 'relative',
        minHeight: '98px',
        background: isOver ? 'var(--c-bg-2, var(--c-bg))' : 'var(--c-bg)',
        border: isOver
          ? '1px solid var(--c-terracotta, var(--c-text-mid))'
          : '1px solid var(--c-divider-subtle)',
        borderRadius: '6px',
        padding: '6px 5px 5px',
        cursor: date ? 'pointer' : 'default',
        display: 'flex',
        flexDirection: 'column',
        opacity: isOffMonth ? 0.25 : 1,
        textAlign: 'left',
        transform: isOver ? 'scale(1.02)' : 'scale(1)',
        transformOrigin: 'center',
        transition: 'background 120ms ease, border-color 120ms ease, transform 100ms ease'
      }}>
      {date ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
            <span style={{
              fontFamily: '"IBM Plex Mono", monospace',
              fontSize: '9.5px',
              color: 'var(--c-text-mid)'
            }}>{date.getDate()}</span>
            {posts.length > 1 ? (
              <span style={{
                fontFamily: '"IBM Plex Mono", monospace',
                fontSize: '8px',
                color: 'var(--c-text-dim)'
              }}>{posts.length}</span>
            ) : null}
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {preview.map((p) => (
              <ThumbMini key={p.id} post={p} contextPosts={contextPosts} isClient={isClient} />
            ))}
            {extra > 0 ? (
              <span style={{
                fontFamily: '"IBM Plex Mono", monospace',
                fontSize: '8px',
                fontWeight: 600,
                color: 'var(--c-text-soft)',
                marginTop: '2px'
              }}>+{extra}</span>
            ) : null}
          </div>
          {isToday ? (
            <span style={{
              position: 'absolute',
              top: '-3px',
              right: '-3px',
              width: '6px',
              height: '6px',
              borderRadius: '6px',
              background: 'var(--c-amber)',
              boxShadow: '0 0 0 2px var(--c-bg)'
            }} />
          ) : null}
        </>
      ) : null}
    </button>
  );
}

function MonthBlock({ monthStartISO, posts, headerRef, today, contextPosts, isClient }) {
  const startDate = useMemo(() => parseISODate(monthStartISO), [monthStartISO]);
  const grid = useMemo(() => buildMonthGrid(startDate), [startDate]);

  const postsByDay = useMemo(() => {
    const map = {};
    for (const p of posts) {
      if (!p.target_date) continue;
      const key = p.target_date.slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(p);
    }
    return map;
  }, [posts]);

  const label = useMemo(() => {
    if (!startDate) return '';
    return MONTH_NAMES_FULL[startDate.getMonth()] + ' ' + startDate.getFullYear();
  }, [startDate]);

  return (
    <section data-month-block={monthStartISO} style={{ marginBottom: '24px' }}>
      <h2
        ref={headerRef || undefined}
        data-month-header={monthStartISO}
        style={{
          fontFamily: 'Fraunces, serif',
          fontSize: '18px',
          fontWeight: 600,
          letterSpacing: '-.01em',
          color: 'var(--c-text-loud)',
          margin: 0,
          padding: '12px 2px 10px',
          scrollMarginTop: '88px'
        }}>
        {label}
      </h2>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: '4px'
      }}>
        {Array.from({ length: grid.leading }).map((_, i) => (
          <Cell
            key={`${monthStartISO}-lead-${i}`}
            date={null}
            posts={[]}
            isToday={false}
            isOffMonth={true}
            dateKey={null}
          />
        ))}
        {grid.days.map((d) => {
          const key = formatYYYYMMDD(d);
          return (
            <Cell
              key={key}
              date={d}
              dateKey={key}
              posts={postsByDay[key] || []}
              isToday={sameDay(d, today)}
              isOffMonth={false}
              contextPosts={contextPosts}
              isClient={isClient}
            />
          );
        })}
      </div>
    </section>
  );
}

function WeekDayRow({ date, posts, isToday, contextPosts, isClient }) {
  const openDay = usePlanStore((s) => s.openDay);
  const dateKey = formatYYYYMMDD(date);
  const droppableId = 'cell-' + dateKey;
  const { setNodeRef, isOver } = useDroppable({ id: droppableId });

  const dow = dowShortMonFirst(date).toUpperCase();
  const dayNum = date.getDate();
  const monthLabel = monthAbbr(date).toUpperCase();
  const borderColor = isToday
    ? 'var(--c-terracotta-1)'
    : isOver
      ? 'var(--c-terracotta, var(--c-text-mid))'
      : 'var(--c-divider-subtle)';

  return (
    <div
      ref={setNodeRef}
      data-cell-id={droppableId}
      style={{
        background: isOver ? 'var(--c-bg-2, var(--c-bg))' : 'var(--c-bg)',
        border: '1px solid ' + borderColor,
        borderRadius: '8px',
        padding: '10px 12px',
        transition: 'background 120ms ease, border-color 120ms ease, transform 100ms ease',
        transform: isOver ? 'scale(1.01)' : 'scale(1)'
      }}>
      <button
        type="button"
        onClick={() => openDay(date)}
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          width: '100%',
          marginBottom: posts.length > 0 ? '8px' : '6px',
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          textAlign: 'left'
        }}>
        <span style={{
          fontFamily: '"IBM Plex Mono", monospace',
          fontSize: '10px',
          letterSpacing: '.14em',
          textTransform: 'uppercase',
          color: isToday ? 'var(--c-terracotta-1)' : 'var(--c-text-mid)',
          fontWeight: isToday ? 600 : 500
        }}>{dow}  {dayNum} {monthLabel}</span>
        {posts.length > 0 ? (
          <span style={{
            fontFamily: '"IBM Plex Mono", monospace',
            fontSize: '9px',
            letterSpacing: '.1em',
            textTransform: 'uppercase',
            color: 'var(--c-text-dim)'
          }}>{posts.length} {posts.length === 1 ? 'post' : 'posts'}</span>
        ) : null}
      </button>
      {posts.length === 0 ? (
        <div style={{
          fontFamily: '"DM Sans", sans-serif',
          fontStyle: 'italic',
          fontSize: '11px',
          color: 'var(--c-text-soft)',
          paddingLeft: '2px'
        }}>(empty)</div>
      ) : (
        <div style={{
          display: 'flex',
          gap: '6px',
          overflowX: 'auto',
          paddingBottom: '2px',
          WebkitOverflowScrolling: 'touch'
        }}>
          {posts.map((p) => (
            <div key={p.id} style={{ width: '88px', flexShrink: 0 }}>
              <ThumbMini post={p} contextPosts={contextPosts} isClient={isClient} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WeekBlock({ weekStartISO, posts, headerRef, today, contextPosts, isClient }) {
  const startDate = useMemo(() => parseISODate(weekStartISO), [weekStartISO]);
  const grid = useMemo(() => buildWeekGrid(startDate), [startDate]);

  const postsByDay = useMemo(() => {
    const map = {};
    for (const p of posts) {
      if (!p.target_date) continue;
      const key = String(p.target_date).slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(p);
    }
    return map;
  }, [posts]);

  return (
    <section
      ref={headerRef || undefined}
      data-week-block={weekStartISO}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
      {grid.days.map((d) => {
        const key = formatYYYYMMDD(d);
        return (
          <WeekDayRow
            key={key}
            date={d}
            posts={postsByDay[key] || []}
            isToday={sameDay(d, today)}
            contextPosts={contextPosts}
            isClient={isClient}
          />
        );
      })}
    </section>
  );
}

export function Calendar() {
  const posts = useCalendarPosts();
  const isClient = useIsClient();
  const loadedMonths = usePlanStore((s) => s.loadedMonths) || [];
  const loadMonthIfMissing = usePlanStore((s) => s.loadMonthIfMissing);
  const storeLoading = usePlanStore((s) => s.loading);
  const rescheduleTarget = usePlanStore((s) => s.rescheduleTarget);
  const calendarMode = usePlanStore((s) => s.calendarMode) || 'week';
  const setCalendarMode = usePlanStore((s) => s.setCalendarMode);
  const currentWeekStart = usePlanStore((s) => s.currentWeekStart);
  const setCurrentWeekStart = usePlanStore((s) => s.setCurrentWeekStart);
  const loadWeekMonths = usePlanStore((s) => s.loadWeekMonths);
  const [isExporting, setIsExporting] = useState(false);
  const [activeDragPost, setActiveDragPost] = useState(null);
  const [showJumpPill, setShowJumpPill] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const today = useMemo(() => new Date(), []);
  const todayMonthISO = useMemo(() => todayMonthStartISO(), []);

  const topSentinelRef = useRef(null);
  const bottomSentinelRef = useRef(null);
  const todayHeaderRef = useRef(null);
  const didInitialScrollRef = useRef(false);
  const loadDebounceRef = useRef({ topTimer: null, bottomTimer: null, pending: new Set() });

  // postsByDayByMonth: each monthStart maps to the posts that belong to it.
  // We group by target_date YYYY-MM and filter into each month's pool. This
  // keeps optimistic reschedules visible even when a post's month hasn't
  // been reloaded yet.
  const postsByMonth = useMemo(() => {
    const map = {};
    for (const m of loadedMonths) map[m.start] = [];
    for (const p of posts) {
      if (!p.target_date) continue;
      const mk = String(p.target_date).slice(0, 7) + '-01';
      if (map[mk]) map[mk].push(p);
    }
    return map;
  }, [posts, loadedMonths]);

  const scheduleLoad = useCallback((monthISO, edge) => {
    if (!monthISO) return;
    if (!loadMonthIfMissing) return;
    const state = loadDebounceRef.current;
    if (state.pending.has(monthISO)) return;
    state.pending.add(monthISO);
    const timerKey = edge === 'top' ? 'topTimer' : 'bottomTimer';
    if (state[timerKey]) clearTimeout(state[timerKey]);
    state[timerKey] = setTimeout(() => {
      Promise.resolve(loadMonthIfMissing(monthISO)).finally(() => {
        state.pending.delete(monthISO);
      });
    }, 200);
  }, [loadMonthIfMissing]);

  // Top + bottom sentinel IntersectionObservers. Each enters viewport -> load
  // the month just outside the current range.
  useEffect(() => {
    if (loadedMonths.length === 0) return;
    const earliestStart = loadedMonths[0].start;
    const latestStart = loadedMonths[loadedMonths.length - 1].start;

    const topNode = topSentinelRef.current;
    const bottomNode = bottomSentinelRef.current;

    const topObs = topNode ? new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          // Year cap: if earliest loaded is already January of CURRENT_YEAR,
          // do not load December of previous year.
          if (earliestStart === `${CURRENT_YEAR}-01-01`) continue;
          const prevISO = shiftMonthStartISO(earliestStart, -1);
          if (!isMonthInCurrentYear(prevISO)) continue;
          scheduleLoad(prevISO, 'top');
        }
      }
    }, { rootMargin: '200px 0px 0px 0px' }) : null;

    const bottomObs = bottomNode ? new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          // Year cap: if latest loaded is already December of CURRENT_YEAR,
          // do not load January of next year.
          if (latestStart === `${CURRENT_YEAR}-12-01`) continue;
          const nextISO = shiftMonthStartISO(latestStart, 1);
          if (!isMonthInCurrentYear(nextISO)) continue;
          scheduleLoad(nextISO, 'bottom');
        }
      }
    }, { rootMargin: '0px 0px 200px 0px' }) : null;

    if (topObs && topNode) topObs.observe(topNode);
    if (bottomObs && bottomNode) bottomObs.observe(bottomNode);

    return () => {
      if (topObs) topObs.disconnect();
      if (bottomObs) bottomObs.disconnect();
    };
  }, [loadedMonths, scheduleLoad]);

  // Initial scroll to today's month header once it mounts.
  useEffect(() => {
    if (didInitialScrollRef.current) return;
    if (!todayHeaderRef.current) return;
    const hasTodayMonth = loadedMonths.some((m) => m.start === todayMonthISO);
    if (!hasTodayMonth) return;
    didInitialScrollRef.current = true;
    try {
      todayHeaderRef.current.scrollIntoView({ block: 'start', behavior: 'auto' });
    } catch (e) {
      // Safari quirks: ignore.
    }
  }, [loadedMonths, todayMonthISO]);

  // Jump-to-today pill visibility: tracks the today-month header.
  useEffect(() => {
    const node = todayHeaderRef.current;
    if (!node) return;
    const obs = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        setShowJumpPill(!entry.isIntersecting);
      }
    }, { threshold: 0, rootMargin: '-80px 0px -40% 0px' });
    obs.observe(node);
    return () => obs.disconnect();
  }, [loadedMonths]);

  const handleJumpToday = useCallback(() => {
    if (calendarMode === 'week') {
      if (setCurrentWeekStart) setCurrentWeekStart(currentWeekMondayISO());
      return;
    }
    const node = todayHeaderRef.current;
    if (!node) return;
    try {
      node.scrollIntoView({ block: 'start', behavior: 'smooth' });
    } catch (e) {
      node.scrollIntoView();
    }
  }, [calendarMode, setCurrentWeekStart]);

  // Load the month(s) needed for the currently selected week. A week that
  // crosses a month boundary requires both months loaded for postsByMonth
  // to produce the full 7 days.
  useEffect(() => {
    if (calendarMode !== 'week') return;
    if (!currentWeekStart) return;
    if (loadWeekMonths) loadWeekMonths(currentWeekStart);
  }, [calendarMode, currentWeekStart, loadWeekMonths]);

  const weekStartDate = useMemo(() => parseISODate(currentWeekStart), [currentWeekStart]);
  const weekLabel = useMemo(() => formatWeekRangeLabel(weekStartDate), [weekStartDate]);

  const weekPosts = useMemo(() => {
    if (calendarMode !== 'week' || !currentWeekStart) return [];
    const startISO = currentWeekStart;
    const endISO = shiftDateISO(currentWeekStart, 6);
    return posts.filter((p) => {
      if (!p || !p.target_date) return false;
      const k = String(p.target_date).slice(0, 10);
      return k >= startISO && k <= endISO;
    });
  }, [posts, calendarMode, currentWeekStart]);

  const handlePrevWeek = useCallback(() => {
    if (!setCurrentWeekStart || !currentWeekStart) return;
    setCurrentWeekStart(shiftDateISO(currentWeekStart, -7));
  }, [currentWeekStart, setCurrentWeekStart]);

  const handleNextWeek = useCallback(() => {
    if (!setCurrentWeekStart || !currentWeekStart) return;
    setCurrentWeekStart(shiftDateISO(currentWeekStart, 7));
  }, [currentWeekStart, setCurrentWeekStart]);

  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      if (calendarMode === 'week') {
        const startDate = weekStartDate;
        const endDate = startDate
          ? new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 6)
          : null;
        await exportCalendarAsPng(weekPosts, startDate, endDate, 'week');
      } else {
        const startDate = parseISODate(todayMonthISO);
        await exportCalendarAsPng(posts, startDate, null, 'month');
      }
    } finally {
      setIsExporting(false);
    }
  };

  const handleSetMode = (mode) => {
    if (!setCalendarMode) return;
    setCalendarMode(mode);
  };

  const pulseSourceCell = useCallback((post) => {
    if (!post || !post.target_date) return;
    const key = String(post.target_date).slice(0, 10);
    const cell = document.querySelector(`[data-cell-id="cell-${key}"]`);
    if (!cell) return;
    cell.classList.add('drag-source-pulse');
    setTimeout(() => { cell.classList.remove('drag-source-pulse'); }, 400);
  }, []);

  const handleDragStart = (event) => {
    window.__planDragActive = true;
    const data = event && event.active && event.active.data ? event.active.data.current : null;
    const post = data && data.post ? data.post : null;
    setActiveDragPost(post);
    if (post) pulseSourceCell(post);
  };

  const handleDragEnd = (event) => {
    if (isClient) return;
    window.__planDragActive = false;
    setActiveDragPost(null);
    if (!event.over) return;
    const overId = String(event.over.id || '');
    if (!overId.startsWith('cell-')) return;
    const newDateISO = overId.replace('cell-', '');
    const data = event.active && event.active.data ? event.active.data.current : null;
    if (!data) return;
    const oldDateISO = data.target_date ? String(data.target_date).slice(0, 10) : null;
    if (newDateISO === oldDateISO) return;
    rescheduleTarget(data.uuid, newDateISO);
  };

  const handleDragCancel = () => {
    window.__planDragActive = false;
    setActiveDragPost(null);
  };

  return (
    <DndContext
      sensors={sensors}
      autoScroll={{ enabled: true, threshold: { x: 0, y: 0.15 }, acceleration: 10 }}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}>
      <div style={{ padding: '12px', paddingTop: 0 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          padding: '12px 2px 6px',
          gap: '8px'
        }}>
          <div
            role="tablist"
            aria-label="Calendar mode"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              background: 'var(--c-bg-2, var(--c-bg))',
              border: '1px solid var(--c-divider-soft)',
              borderRadius: '100px',
              padding: '3px'
            }}>
            <button
              type="button"
              role="tab"
              aria-selected={calendarMode === 'week'}
              onClick={() => handleSetMode('week')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 10px',
                borderRadius: '100px',
                border: calendarMode === 'week'
                  ? '1px solid var(--c-terracotta-1)'
                  : '1px solid transparent',
                background: calendarMode === 'week'
                  ? 'var(--c-terracotta-1)'
                  : 'transparent',
                cursor: 'pointer',
                color: calendarMode === 'week' ? '#FFFFFF' : 'var(--c-text-mid)',
                fontFamily: '"IBM Plex Mono", monospace',
                fontSize: '9px',
                letterSpacing: '.12em',
                textTransform: 'uppercase'
              }}>
              <CalendarRange size={12} />
              <span>Week</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={calendarMode === 'month'}
              onClick={() => handleSetMode('month')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 10px',
                borderRadius: '100px',
                border: calendarMode === 'month'
                  ? '1px solid var(--c-terracotta-1)'
                  : '1px solid transparent',
                background: calendarMode === 'month'
                  ? 'var(--c-terracotta-1)'
                  : 'transparent',
                cursor: 'pointer',
                color: calendarMode === 'month' ? '#FFFFFF' : 'var(--c-text-mid)',
                fontFamily: '"IBM Plex Mono", monospace',
                fontSize: '9px',
                letterSpacing: '.12em',
                textTransform: 'uppercase'
              }}>
              <CalendarDays size={12} />
              <span>Month</span>
            </button>
          </div>
          <button
            type="button"
            aria-label="Export calendar"
            onClick={handleExport}
            disabled={isExporting}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'transparent',
              border: '1px solid var(--c-divider-soft)',
              borderRadius: '6px',
              padding: '5px 9px',
              cursor: isExporting ? 'default' : 'pointer',
              color: 'var(--c-text-mid)',
              fontFamily: '"IBM Plex Mono", monospace',
              fontSize: '9px',
              letterSpacing: '.12em',
              textTransform: 'uppercase',
              opacity: isExporting ? 0.6 : 1
            }}>
            {isExporting ? (
              <Loader2
                size={13}
                className="animate-spin"
                style={{ animation: 'plan-spin 0.8s linear infinite' }}
              />
            ) : (
              <Download size={13} />
            )}
            <span>{isExporting ? 'Exporting' : 'Export'}</span>
          </button>
        </div>

        {calendarMode === 'week' ? (
          <>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '4px 2px 10px',
              gap: '10px'
            }}>
              <button
                type="button"
                aria-label="Previous week"
                onClick={handlePrevWeek}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                  background: 'transparent',
                  border: '1px solid var(--c-divider-soft)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  color: 'var(--c-text-mid)'
                }}>
                <ChevronLeft size={16} />
              </button>
              <div style={{
                flex: 1,
                textAlign: 'center',
                fontFamily: 'Fraunces, serif',
                fontSize: '18px',
                fontWeight: 600,
                letterSpacing: '-.01em',
                color: 'var(--c-text-loud)'
              }}>
                {weekLabel}
              </div>
              <button
                type="button"
                aria-label="Next week"
                onClick={handleNextWeek}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                  background: 'transparent',
                  border: '1px solid var(--c-divider-soft)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  color: 'var(--c-text-mid)'
                }}>
                <ChevronRight size={16} />
              </button>
            </div>

            {loadedMonths.length === 0 && storeLoading ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '48px 0',
                color: 'var(--c-text-dim)',
                fontFamily: '"IBM Plex Mono", monospace',
                fontSize: '11px',
                letterSpacing: '.06em'
              }}>
                <Loader2
                  size={16}
                  style={{ animation: 'plan-spin 0.8s linear infinite', marginRight: '8px' }}
                />
                Loading
              </div>
            ) : (
              <WeekBlock
                weekStartISO={currentWeekStart}
                posts={weekPosts}
                headerRef={null}
                today={today}
                contextPosts={weekPosts}
                isClient={isClient}
              />
            )}

            {currentWeekStart !== currentWeekMondayISO() ? (
              <button
                type="button"
                aria-label="This week"
                onClick={handleJumpToday}
                style={{
                  position: 'fixed',
                  right: '14px',
                  bottom: '84px',
                  zIndex: 60,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'var(--c-bg-2, var(--c-bg))',
                  border: '1px solid var(--c-divider-soft)',
                  borderRadius: '999px',
                  padding: '8px 14px',
                  cursor: 'pointer',
                  color: 'var(--c-text-loud)',
                  fontFamily: '"IBM Plex Mono", monospace',
                  fontSize: '10px',
                  letterSpacing: '.12em',
                  textTransform: 'uppercase',
                  boxShadow: '0 6px 20px rgba(0,0,0,.28)'
                }}>
                <ArrowDown size={13} />
                <span>Today</span>
              </button>
            ) : null}
          </>
        ) : (
          <>
            <div style={{
              position: 'sticky',
              top: 0,
              zIndex: 20,
              background: 'var(--c-bg)',
              paddingTop: '6px',
              paddingBottom: '6px',
              marginBottom: '2px',
              borderBottom: '1px solid var(--c-divider-subtle)',
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: '4px'
            }}>
              {DOW_HEADERS.map((d, i) => (
                <div key={i} style={{
                  textAlign: 'center',
                  fontFamily: '"IBM Plex Mono", monospace',
                  fontSize: '8.5px',
                  textTransform: 'uppercase',
                  letterSpacing: '.12em',
                  color: 'var(--c-text-dim)',
                  padding: '4px 0'
                }}>{d}</div>
              ))}
            </div>

            <div ref={topSentinelRef} data-sentinel="top" style={{ height: '1px' }} />

            {loadedMonths.length === 0 && storeLoading ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '48px 0',
                color: 'var(--c-text-dim)',
                fontFamily: '"IBM Plex Mono", monospace',
                fontSize: '11px',
                letterSpacing: '.06em'
              }}>
                <Loader2
                  size={16}
                  style={{ animation: 'plan-spin 0.8s linear infinite', marginRight: '8px' }}
                />
                Loading
              </div>
            ) : null}

            {loadedMonths.map((m) => (
              <MonthBlock
                key={m.start}
                monthStartISO={m.start}
                posts={postsByMonth[m.start] || []}
                headerRef={m.start === todayMonthISO ? todayHeaderRef : null}
                today={today}
                contextPosts={posts}
                isClient={isClient}
              />
            ))}

            <div ref={bottomSentinelRef} data-sentinel="bottom" style={{ height: '1px' }} />

            {showJumpPill ? (
              <button
                type="button"
                aria-label="Jump to today"
                onClick={handleJumpToday}
                style={{
                  position: 'fixed',
                  right: '14px',
                  bottom: '84px',
                  zIndex: 60,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'var(--c-bg-2, var(--c-bg))',
                  border: '1px solid var(--c-divider-soft)',
                  borderRadius: '999px',
                  padding: '8px 14px',
                  cursor: 'pointer',
                  color: 'var(--c-text-loud)',
                  fontFamily: '"IBM Plex Mono", monospace',
                  fontSize: '10px',
                  letterSpacing: '.12em',
                  textTransform: 'uppercase',
                  boxShadow: '0 6px 20px rgba(0,0,0,.28)'
                }}>
                <ArrowDown size={13} />
                <span>Today</span>
              </button>
            ) : null}
          </>
        )}
      </div>

      <DragOverlay
        dropAnimation={{ duration: 200, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
        {activeDragPost ? (
          <div style={{
            width: '64px',
            transform: 'scale(1.08)',
            boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
            borderRadius: '6px',
            overflow: 'hidden'
          }}>
            <ThumbMini post={activeDragPost} isOverlay />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
