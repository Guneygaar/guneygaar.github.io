// Off-screen print-layout clone of the Calendar view, rasterised
// by html-to-image into a PNG. No interactivity, no drag, no drop.
// Resolves CSS var tokens at mount time via getComputedStyle so the
// detached container renders correctly even when outside the Plan
// theme scope. All <img> tags carry crossOrigin="anonymous" so the
// R2 CDN bucket's CORS headers let html-to-image paint them to canvas.

import React, { useMemo } from 'react';
import {
  STAGE_COLOR_VAR, STAGE_LABELS, PILLAR_GRAD_CLASS, PILLAR_LABELS
} from '../shared/constants.js';
import { buildMonthGrid, buildWeekGrid, formatYYYYMMDD, monthAbbr, dowShortMonFirst } from '../shared/dateUtils.js';

const DOW_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Fallback palette for stages when a CSS var is not resolvable.
// Kept in sync with styles/tailwind.css :root stage tokens so the
// export renders close to the live Calendar even when the detached
// container sits outside [data-plan-root].
const STAGE_COLOR_FALLBACK = {
  brief:                '#C8A84B',
  in_production:        '#9b87f5',
  ready:                '#3ECF8E',
  awaiting_brand_input: '#F6A623',
  awaiting_approval:    '#22D3EE',
  scheduled:            '#9b87f5',
  published:            '#3ECF8E',
  rejected:             '#FF4B4B',
  parked:               '#8E8E93'
};

function resolveVar(varName, fallback) {
  if (typeof window === 'undefined' || !document) return fallback;
  try {
    const root = document.querySelector('[data-plan-root]') || document.documentElement;
    const val = getComputedStyle(root).getPropertyValue(varName);
    const trimmed = val && val.trim();
    return trimmed || fallback;
  } catch (e) {
    return fallback;
  }
}

function stageColor(stage) {
  const varName = STAGE_COLOR_VAR[stage];
  const fallback = STAGE_COLOR_FALLBACK[stage] || '#8E8E93';
  if (!varName) return fallback;
  return resolveVar(varName, fallback);
}

function firstImage(images) {
  if (!images) return null;
  try {
    let arr = images;
    if (typeof arr === 'string') arr = JSON.parse(arr);
    if (Array.isArray(arr) && arr.length > 0) return arr[0];
  } catch (e) { /* noop */ }
  return null;
}

function pillarLabelShort(pillar) {
  const label = PILLAR_LABELS[pillar] || '';
  return label ? label.slice(0, 4).toUpperCase() : '';
}

function ThumbBlock({ post }) {
  const img = firstImage(post && post.images);
  const sColor = stageColor(post.stage);
  const stageLabel = STAGE_LABELS[post.stage] || post.stage || '';
  const pillarTag = pillarLabelShort(post && post.content_pillar);
  const title = (post && post.title) ? post.title : '(untitled)';

  return (
    <div style={{
      display: 'flex',
      gap: '6px',
      alignItems: 'flex-start',
      padding: '4px',
      borderRadius: '4px',
      background: resolveVar('--c-bg-2', '#F5F1E8'),
      border: '1px solid ' + resolveVar('--c-divider-subtle', '#E6DFD0'),
      marginBottom: '4px',
      width: '100%',
      boxSizing: 'border-box',
      overflow: 'hidden'
    }}>
      <div style={{
        width: '28px',
        height: '28px',
        flexShrink: 0,
        borderRadius: '3px',
        overflow: 'hidden',
        background: '#E6DFD0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {img ? (
          <img
            src={img}
            alt=""
            crossOrigin="anonymous"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <span style={{
            fontFamily: '"IBM Plex Mono", monospace',
            fontSize: '7px',
            color: '#6A655C',
            letterSpacing: '.06em'
          }}>{pillarTag}</span>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: '"DM Sans", sans-serif',
          fontSize: '9.5px',
          lineHeight: '1.25',
          color: resolveVar('--c-text-loud', '#2A2720'),
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          fontWeight: 500
        }}>{title}</div>
        <span style={{
          display: 'inline-block',
          marginTop: '2px',
          padding: '1px 5px',
          borderRadius: '6px',
          fontFamily: '"IBM Plex Mono", monospace',
          fontSize: '7px',
          letterSpacing: '.08em',
          textTransform: 'uppercase',
          color: '#FFFFFF',
          background: sColor,
          lineHeight: '1.4'
        }}>{stageLabel}</span>
      </div>
    </div>
  );
}

function DayCell({ date, posts, inMonth }) {
  const slots = Math.min(4, posts.length);
  const preview = posts.slice(0, slots);
  const extra = Math.max(0, posts.length - preview.length);

  return (
    <div style={{
      minHeight: '150px',
      background: inMonth
        ? resolveVar('--c-bg', '#FAF7F0')
        : resolveVar('--c-bg-3', '#F0EADD'),
      border: '1px solid ' + resolveVar('--c-divider-soft', '#D9D2C1'),
      borderRadius: '5px',
      padding: '6px',
      opacity: inMonth ? 1 : 0.45,
      display: 'flex',
      flexDirection: 'column',
      boxSizing: 'border-box',
      overflow: 'hidden'
    }}>
      <div style={{
        fontFamily: '"IBM Plex Mono", monospace',
        fontSize: '10px',
        color: resolveVar('--c-text-mid', '#4A4640'),
        marginBottom: '4px',
        fontWeight: 600,
        letterSpacing: '.02em'
      }}>
        {date ? date.getDate() : ''}
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {preview.map((p) => (
          <ThumbBlock key={p.id} post={p} />
        ))}
        {extra > 0 ? (
          <span style={{
            fontFamily: '"IBM Plex Mono", monospace',
            fontSize: '8px',
            color: resolveVar('--c-text-dim', '#6A655C'),
            marginTop: '2px',
            letterSpacing: '.08em'
          }}>
            +{extra} more
          </span>
        ) : null}
      </div>
    </div>
  );
}

function WeekRowExport({ date, posts }) {
  const dow = dowShortMonFirst(date).toUpperCase();
  const dayNum = date ? date.getDate() : '';
  const monthLabel = monthAbbr(date).toUpperCase();

  return (
    <div style={{
      background: resolveVar('--c-bg', '#FAF7F0'),
      border: '1px solid ' + resolveVar('--c-divider-soft', '#D9D2C1'),
      borderRadius: '6px',
      padding: '10px 12px',
      boxSizing: 'border-box'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        marginBottom: posts.length > 0 ? '8px' : '4px'
      }}>
        <span style={{
          fontFamily: '"IBM Plex Mono", monospace',
          fontSize: '11px',
          letterSpacing: '.14em',
          textTransform: 'uppercase',
          color: resolveVar('--c-text-mid', '#4A4640'),
          fontWeight: 600
        }}>{dow}  {dayNum} {monthLabel}</span>
        {posts.length > 0 ? (
          <span style={{
            fontFamily: '"IBM Plex Mono", monospace',
            fontSize: '9px',
            letterSpacing: '.1em',
            textTransform: 'uppercase',
            color: resolveVar('--c-text-dim', '#6A655C')
          }}>{posts.length} {posts.length === 1 ? 'post' : 'posts'}</span>
        ) : null}
      </div>
      {posts.length === 0 ? (
        <div style={{
          fontFamily: '"DM Sans", sans-serif',
          fontStyle: 'italic',
          fontSize: '10px',
          color: resolveVar('--c-text-soft', '#8A857A')
        }}>(empty)</div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {posts.map((p) => (
            <div key={p.id} style={{ width: 'calc(50% - 3px)', minWidth: 0 }}>
              <ThumbBlock post={p} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WeekExportBody({ weekPosts, weekStart }) {
  const grid = useMemo(() => buildWeekGrid(weekStart), [weekStart]);
  const postsByDay = useMemo(() => {
    const map = {};
    const arr = Array.isArray(weekPosts) ? weekPosts : [];
    for (const p of arr) {
      if (!p || !p.target_date) continue;
      const key = String(p.target_date).slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(p);
    }
    return map;
  }, [weekPosts]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {grid.days.map((d) => {
        const key = formatYYYYMMDD(d);
        return (
          <WeekRowExport key={key} date={d} posts={postsByDay[key] || []} />
        );
      })}
    </div>
  );
}

export function CalendarExport({ monthPosts, monthDate, mode, rangeEnd }) {
  const effectiveMode = mode === 'week' ? 'week' : 'month';
  const grid = useMemo(() => buildMonthGrid(monthDate), [monthDate]);

  const postsByDay = useMemo(() => {
    const map = {};
    const arr = Array.isArray(monthPosts) ? monthPosts : [];
    for (const p of arr) {
      if (!p || !p.target_date) continue;
      const key = String(p.target_date).slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(p);
    }
    return map;
  }, [monthPosts]);

  const monthName = monthDate ? MONTH_NAMES[monthDate.getMonth()] : '';
  const year = monthDate ? monthDate.getFullYear() : '';
  const weekHeaderTitle = (() => {
    if (effectiveMode !== 'week' || !monthDate) return '';
    const startMonth = monthAbbr(monthDate);
    const endMonth = rangeEnd ? monthAbbr(rangeEnd) : startMonth;
    if (startMonth === endMonth) {
      return `Sorted ${startMonth} ${monthDate.getDate()} - ${rangeEnd ? rangeEnd.getDate() : monthDate.getDate() + 6}`;
    }
    return `Sorted ${startMonth} ${monthDate.getDate()} - ${endMonth} ${rangeEnd ? rangeEnd.getDate() : ''}`;
  })();
  const headerTitle = effectiveMode === 'week'
    ? weekHeaderTitle
    : ('Sorted ' + monthName + ' ' + year);

  // Build leading empty cells for days before month-start.
  const leadingCells = [];
  for (let i = 0; i < grid.leading; i++) {
    leadingCells.push(
      <DayCell key={'lead-' + i} date={null} posts={[]} inMonth={false} />
    );
  }

  // Build trailing empty cells so final row stays a full 7 columns.
  const totalSlots = grid.leading + grid.days.length;
  const trailing = (7 - (totalSlots % 7)) % 7;
  const trailingCells = [];
  for (let i = 0; i < trailing; i++) {
    trailingCells.push(
      <DayCell key={'trail-' + i} date={null} posts={[]} inMonth={false} />
    );
  }

  return (
    <div
      data-calendar-export-root=""
      style={{
        position: 'fixed',
        left: '-9999px',
        top: '0',
        width: '1200px',
        padding: '28px 32px 32px',
        background: resolveVar('--c-bg', '#FAF7F0'),
        color: resolveVar('--c-text-loud', '#2A2720'),
        fontFamily: '"DM Sans", sans-serif',
        boxSizing: 'border-box'
      }}>
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        marginBottom: '16px',
        borderBottom: '1px solid ' + resolveVar('--c-divider-soft', '#D9D2C1'),
        paddingBottom: '12px'
      }}>
        <div style={{
          fontFamily: 'Fraunces, serif',
          fontSize: '28px',
          fontWeight: 600,
          letterSpacing: '-.01em',
          color: resolveVar('--c-text-loud', '#2A2720')
        }}>
          {headerTitle}
        </div>
        <div style={{
          fontFamily: '"IBM Plex Mono", monospace',
          fontSize: '10px',
          letterSpacing: '.14em',
          textTransform: 'uppercase',
          color: resolveVar('--c-text-dim', '#6A655C')
        }}>
          Content Calendar
        </div>
      </div>

      {effectiveMode === 'week' ? (
        <WeekExportBody weekPosts={monthPosts} weekStart={monthDate} />
      ) : (
        <>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: '6px',
            marginBottom: '6px'
          }}>
            {DOW_HEADERS.map((d, i) => (
              <div key={i} style={{
                textAlign: 'left',
                fontFamily: '"IBM Plex Mono", monospace',
                fontSize: '9.5px',
                letterSpacing: '.14em',
                textTransform: 'uppercase',
                color: resolveVar('--c-text-dim', '#6A655C'),
                padding: '4px 2px'
              }}>{d}</div>
            ))}
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: '6px'
          }}>
            {leadingCells}
            {grid.days.map((d) => {
              const key = formatYYYYMMDD(d);
              return (
                <DayCell
                  key={key}
                  date={d}
                  posts={postsByDay[key] || []}
                  inMonth={true}
                />
              );
            })}
            {trailingCells}
          </div>
        </>
      )}

      <div style={{
        marginTop: '18px',
        paddingTop: '10px',
        borderTop: '1px solid ' + resolveVar('--c-divider-soft', '#D9D2C1'),
        display: 'flex',
        justifyContent: 'flex-end',
        fontFamily: '"IBM Plex Mono", monospace',
        fontSize: '10px',
        letterSpacing: '.14em',
        textTransform: 'uppercase',
        color: resolveVar('--c-text-dim', '#6A655C')
      }}>
        srtd.io
      </div>
    </div>
  );
}
