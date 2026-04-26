import React, { useMemo } from 'react';
import { formatPeriodTitle } from './helpers.js';

const FONT_BODY = '"DM Sans", sans-serif';
const FONT_MONO = '"IBM Plex Mono", monospace';
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function pad(n) { return String(n).padStart(2, '0'); }

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function lastDayOfMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function monthBoundsFromISO(iso) {
  const base = iso || todayISO();
  const [y, m] = base.split('-').map(Number);
  const last = lastDayOfMonth(y, m);
  return {
    start: `${y}-${pad(m)}-01`,
    end: `${y}-${pad(m)}-${pad(last)}`,
  };
}

function addDaysISO(iso, days) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

function weekBoundsFromISO(iso) {
  const base = iso || todayISO();
  const [y, m, d] = base.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const day = dt.getUTCDay() || 7;
  const offsetFromMon = (day + 6) % 7;
  const monday = addDaysISO(base, -offsetFromMon);
  return { start: monday, end: addDaysISO(monday, 6) };
}

function isoWeek(dateISO) {
  const [y, m, d] = dateISO.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const day = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((dt - yearStart) / 86400000 + 1) / 7);
  return `${dt.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function mondayFromIsoWeek(weekStr) {
  const [yStr, wStr] = weekStr.split('-W');
  const y = Number(yStr); const w = Number(wStr);
  const jan4 = new Date(Date.UTC(y, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const week1Mon = new Date(jan4); week1Mon.setUTCDate(jan4.getUTCDate() - jan4Day + 1);
  const target = new Date(week1Mon); target.setUTCDate(week1Mon.getUTCDate() + (w - 1) * 7);
  return `${target.getUTCFullYear()}-${pad(target.getUTCMonth() + 1)}-${pad(target.getUTCDate())}`;
}

function formatHumanRange(startISO, endISO) {
  if (!startISO || !endISO) return '';
  const [sy, sm, sd] = startISO.split('-').map(Number);
  const [ey, em, ed] = endISO.split('-').map(Number);
  const startMs = Date.UTC(sy, sm - 1, sd);
  const endMs = Date.UTC(ey, em - 1, ed);
  if (endMs < startMs) return '';
  const days = Math.round((endMs - startMs) / 86400000) + 1;
  const sameYear = sy === ey;
  const left = `${MONTHS_SHORT[sm - 1]} ${sd}${sameYear ? '' : `, ${sy}`}`;
  const right = `${MONTHS_SHORT[em - 1]} ${ed}, ${ey}`;
  return `${left} – ${right} (${days} day${days === 1 ? '' : 's'})`;
}

const SECTION_LABEL_STYLE = {
  fontFamily: FONT_MONO,
  fontSize: '9px',
  letterSpacing: '.14em',
  textTransform: 'uppercase',
  color: 'var(--c-text-soft)',
  marginBottom: '8px',
};

const SUB_LABEL_STYLE = {
  fontFamily: FONT_MONO,
  fontSize: '9px',
  letterSpacing: '.14em',
  textTransform: 'uppercase',
  color: 'var(--c-text-soft)',
  marginBottom: '4px',
};

const INPUT_STYLE = {
  width: '100%',
  padding: '12px 14px',
  background: 'var(--c-bg-2)',
  color: 'var(--c-text-loud)',
  border: '1px solid var(--c-divider-soft)',
  borderRadius: 0,
  fontFamily: FONT_BODY,
  fontSize: '14px',
  WebkitAppearance: 'none',
  boxSizing: 'border-box',
};

function segButtonStyle(active) {
  return {
    flex: 1,
    padding: '10px 12px',
    background: active ? 'var(--c-text-loud)' : 'transparent',
    color: active ? 'var(--c-bg)' : 'var(--c-text-mid)',
    border: active ? '1px solid var(--c-text-loud)' : '1px solid var(--c-divider-soft)',
    borderRadius: 0,
    fontFamily: FONT_MONO,
    fontSize: '10px',
    letterSpacing: '.14em',
    textTransform: 'uppercase',
    cursor: 'pointer',
  };
}

export function PeriodStep({
  periodType,
  periodStart,
  periodEnd,
  title,
  onPeriodChange,
  onTitleChange,
}) {
  const invalidRange = useMemo(() => {
    if (!periodStart || !periodEnd) return false;
    return new Date(periodEnd) < new Date(periodStart);
  }, [periodStart, periodEnd]);

  const humanRange = useMemo(
    () => formatHumanRange(periodStart, periodEnd),
    [periodStart, periodEnd]
  );

  function handleSwitchType(nextType) {
    if (nextType === periodType) return;
    if (nextType === 'monthly') {
      const { start, end } = monthBoundsFromISO(periodStart);
      onPeriodChange({ periodType: 'monthly', periodStart: start, periodEnd: end });
    } else if (nextType === 'weekly') {
      const { start, end } = weekBoundsFromISO(periodStart);
      onPeriodChange({ periodType: 'weekly', periodStart: start, periodEnd: end });
    } else {
      onPeriodChange({ periodType: 'custom', periodStart, periodEnd });
    }
  }

  function handleMonthChange(ev) {
    const v = ev.target.value; // "YYYY-MM"
    if (!v) return;
    const [y, m] = v.split('-').map(Number);
    const last = lastDayOfMonth(y, m);
    onPeriodChange({
      periodStart: `${y}-${pad(m)}-01`,
      periodEnd: `${y}-${pad(m)}-${pad(last)}`,
    });
  }

  function handleWeekChange(ev) {
    const v = ev.target.value; // "YYYY-Www"
    if (!v) return;
    const monday = mondayFromIsoWeek(v);
    onPeriodChange({ periodStart: monday, periodEnd: addDaysISO(monday, 6) });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={SECTION_LABEL_STYLE}>Period</div>

      <div style={{ display: 'flex', flexDirection: 'row', gap: '6px' }}>
        {['monthly', 'weekly', 'custom'].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => handleSwitchType(t)}
            style={segButtonStyle(periodType === t)}
          >
            {t}
          </button>
        ))}
      </div>

      <div style={{ marginTop: '14px' }}>
        {periodType === 'monthly' && (
          <input
            type="month"
            value={(periodStart || '').slice(0, 7)}
            onChange={handleMonthChange}
            style={INPUT_STYLE}
          />
        )}

        {periodType === 'weekly' && (
          <input
            type="week"
            value={periodStart ? isoWeek(periodStart) : ''}
            onChange={handleWeekChange}
            style={INPUT_STYLE}
          />
        )}

        {periodType === 'custom' && (
          <div>
            <div style={{ display: 'flex', flexDirection: 'row', gap: '10px' }}>
              <div style={{ flex: 1 }}>
                <div style={SUB_LABEL_STYLE}>Start</div>
                <input
                  type="date"
                  value={periodStart || ''}
                  onChange={(ev) => onPeriodChange({ periodStart: ev.target.value })}
                  style={INPUT_STYLE}
                />
              </div>
              <div style={{ flex: 1 }}>
                <div style={SUB_LABEL_STYLE}>End</div>
                <input
                  type="date"
                  value={periodEnd || ''}
                  onChange={(ev) => onPeriodChange({ periodEnd: ev.target.value })}
                  style={INPUT_STYLE}
                />
              </div>
            </div>
            {invalidRange && (
              <div style={{
                padding: '6px 0',
                fontFamily: FONT_BODY,
                fontSize: '12px',
                color: 'var(--c-red)',
              }}>
                End date must be after start date.
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ ...SECTION_LABEL_STYLE, marginTop: '16px', marginBottom: '6px' }}>
        Plan title
      </div>
      <input
        type="text"
        value={title || ''}
        onChange={(ev) => onTitleChange(ev.target.value)}
        style={INPUT_STYLE}
      />
      <div style={{
        fontFamily: FONT_MONO,
        fontSize: '9px',
        color: 'var(--c-text-dim)',
        marginTop: '4px',
      }}>
        Auto-suggested from period. Edit to override.
      </div>

      <div style={{
        padding: '12px',
        background: 'var(--c-bg-2)',
        border: '1px solid var(--c-divider-soft)',
        marginTop: '16px',
      }}>
        <div style={{
          fontFamily: FONT_MONO,
          fontSize: '9px',
          letterSpacing: '.14em',
          textTransform: 'uppercase',
          color: 'var(--c-text-soft)',
          marginBottom: '4px',
        }}>
          Range
        </div>
        <div style={{
          fontFamily: FONT_BODY,
          fontSize: '13px',
          color: invalidRange ? 'var(--c-red)' : 'var(--c-text-loud)',
        }}>
          {invalidRange ? 'Invalid range' : (humanRange || '—')}
        </div>
      </div>
    </div>
  );
}
