// Month grid view. Monday-first. Cells show up to 2 thumb previews.
// Cell tap opens DaySheet. Thumb tap bypasses DaySheet and opens
// MiniCardSheet directly. Thumbs are draggable between cells to
// reschedule target_date via planStore.rescheduleTarget.

import React, { useMemo, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable
} from '@dnd-kit/core';
import { Download, Loader2 } from 'lucide-react';
import { useCalendarPosts } from '../hooks/useCalendarPosts.js';
import { usePlanStore } from '../store/planStore.js';
import {
  parseISODate, buildMonthGrid, sameDay, formatYYYYMMDD
} from '../shared/dateUtils.js';
import {
  STAGE_COLOR_VAR, PILLAR_LABELS
} from '../shared/constants.js';
import { PillarThumb } from '../shared/PillarThumb.jsx';
import { exportCalendarAsPng } from '../hooks/useCalendarExport.js';

const MONTH_NAMES_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DOW_HEADERS = ['M','T','W','T','F','S','S'];

function ThumbMini({ post }) {
  const openMiniCard = usePlanStore((s) => s.openMiniCard);
  const stageColor = STAGE_COLOR_VAR[post.stage]
    ? `var(${STAGE_COLOR_VAR[post.stage]})`
    : 'var(--c-text-dim)';
  const dim = post.stage === 'rejected' || post.stage === 'parked';
  const approvalInset = post.stage === 'awaiting_approval'
    ? `inset 0 0 0 1.5px ${stageColor}`
    : 'none';

  const { attributes, listeners, setNodeRef, isDragging, transform } = useDraggable({
    id: 'thumb-' + post.id,
    data: { uuid: post.id, target_date: post.target_date }
  });

  const dragStyle = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 50
      }
    : {};

  return (
    <button
      ref={setNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      onClick={(e) => {
        if (window.__planDragActive) return;
        e.stopPropagation();
        openMiniCard(post);
      }}
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '16 / 10',
        border: 'none',
        padding: 0,
        cursor: isDragging ? 'grabbing' : 'pointer',
        borderRadius: '3px',
        overflow: 'hidden',
        opacity: isDragging ? 0.4 : (dim ? 0.5 : 1),
        background: 'transparent',
        boxShadow: approvalInset,
        marginBottom: '2px',
        touchAction: 'none',
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

function Cell({ date, posts, isToday, isOffMonth, dateKey }) {
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
        transition: 'background 120ms ease, border-color 120ms ease'
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
              <ThumbMini key={p.id} post={p} />
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

export function Calendar() {
  const posts = useCalendarPosts();
  const monthStart = usePlanStore((s) => s.monthStart);
  const rescheduleTarget = usePlanStore((s) => s.rescheduleTarget);
  const [isExporting, setIsExporting] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const startDate = useMemo(() => parseISODate(monthStart), [monthStart]);
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

  const monthLabel = useMemo(() => {
    if (!startDate) return '';
    return MONTH_NAMES_FULL[startDate.getMonth()] + ' ' + startDate.getFullYear();
  }, [startDate]);

  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      await exportCalendarAsPng(posts, startDate);
    } finally {
      setIsExporting(false);
    }
  };

  const today = new Date();

  const handleDragStart = () => {
    window.__planDragActive = true;
  };

  const handleDragEnd = (event) => {
    window.__planDragActive = false;
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
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}>
      <div style={{ padding: '12px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '8px',
          padding: '0 2px'
        }}>
          <div style={{
            fontFamily: '"IBM Plex Mono", monospace',
            fontSize: '10px',
            letterSpacing: '.14em',
            textTransform: 'uppercase',
            color: 'var(--c-text-dim)'
          }}>{monthLabel}</div>
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
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '4px',
          marginBottom: '6px'
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
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '4px'
        }}>
          {Array.from({ length: grid.leading }).map((_, i) => (
            <Cell key={`lead-${i}`} date={null} posts={[]} isToday={false} isOffMonth={true} dateKey={null} />
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
              />
            );
          })}
        </div>
      </div>
    </DndContext>
  );
}
