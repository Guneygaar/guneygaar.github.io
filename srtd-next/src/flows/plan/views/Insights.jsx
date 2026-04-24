// Insights dashboard. All stats client-computed from posts +
// metrics arrays. No new RPC endpoints in PR 1. Claude Spend is
// admin-only and shows a placeholder dash (real number requires
// ai_usage fetch - deferred to PR 2 or 3).

import React, { useMemo, useState } from 'react';
import { ChevronDown, ArrowUpRight } from 'lucide-react';
import { useAllPosts } from '../hooks/usePosts.js';
import { useMetrics } from '../hooks/useMetrics.js';
import { usePlanStore } from '../store/planStore.js';
import { PeriodSheet } from '../sheets/PeriodSheet.jsx';
import {
  STAGE_LABELS, STAGE_COLOR_VAR, OWNER_COLOR_VAR,
  OWNER_LABELS, PILLAR_LABELS, PILLAR_COLOR_VAR,
  FORMAT_LABELS, FORMAT_COLOR_VAR
} from '../shared/constants.js';
import { daysBetween } from '../shared/dateUtils.js';

const PERIOD_DAYS = { week: 7, month: 30, quarter: 90 };
const PERIOD_LABELS = {
  week:    'Last 7 days',
  month:   'Last 30 days',
  quarter: 'Last 90 days'
};
const PERIOD_COMPARE_LABELS = {
  week:    'vs prior week',
  month:   'vs prior month',
  quarter: 'vs prior quarter'
};

function periodBounds(period) {
  const days = PERIOD_DAYS[period] || PERIOD_DAYS.month;
  const now = new Date();
  const since = new Date(now.getTime() - days * 86400000);
  const prior = new Date(now.getTime() - 2 * days * 86400000);
  return { since, prior, now };
}

function inRange(iso, from, to) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (isNaN(t)) return false;
  return t >= from.getTime() && t < to.getTime();
}

function deltaLabel(current, prior, opts) {
  if (current == null || prior == null) return null;
  const diff = current - prior;
  if (diff === 0) return 'no change';
  const suffix = opts && opts.suffix ? opts.suffix : '';
  const rounded = Math.round(diff * 10) / 10;
  const arrow = diff > 0 ? '+' : '';
  return `${arrow}${rounded}${suffix} ${opts && opts.compareLabel ? opts.compareLabel : ''}`.trim();
}

function deltaColor(current, prior, higherIsBetter) {
  if (current == null || prior == null) return 'var(--c-text-dim)';
  if (current === prior) return 'var(--c-text-dim)';
  const up = current > prior;
  const good = higherIsBetter ? up : !up;
  return good ? 'var(--c-green-deep)' : 'var(--c-terracotta-2)';
}

function Card({ title, children, onClick, span = 1 }) {
  return (
    <div
      onClick={onClick}
      style={{
        gridColumn: span === 2 ? 'span 2' : undefined,
        background: 'var(--c-bg)',
        border: '1px solid var(--c-divider-soft)',
        borderRadius: '10px',
        padding: '14px 16px',
        cursor: onClick ? 'pointer' : 'default'
      }}>
      <div style={{
        fontFamily: '"IBM Plex Mono", monospace',
        fontSize: '8.5px',
        textTransform: 'uppercase',
        letterSpacing: '.14em',
        color: 'var(--c-text-dim)',
        marginBottom: '10px'
      }}>{title}</div>
      {children}
    </div>
  );
}

function BigStat({ value, suffix, sub, subColor }) {
  return (
    <>
      <div style={{
        fontFamily: 'Fraunces, serif',
        fontSize: '28px',
        fontWeight: 500,
        color: 'var(--c-text-loud)',
        letterSpacing: '-.02em',
        lineHeight: 1.1
      }}>{value}<span style={{ fontSize: '16px', marginLeft: '3px', color: 'var(--c-text-mid)' }}>{suffix || ''}</span></div>
      {sub ? (
        <div style={{
          fontFamily: '"IBM Plex Mono", monospace',
          fontSize: '9px',
          color: subColor || 'var(--c-text-dim)',
          marginTop: '6px',
          letterSpacing: '.08em',
          textTransform: 'uppercase'
        }}>{sub}</div>
      ) : null}
    </>
  );
}

function Bar({ label, value, max, color }) {
  const pct = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
      <span style={{
        width: '84px',
        fontFamily: '"IBM Plex Mono", monospace',
        fontSize: '9px',
        textTransform: 'uppercase',
        letterSpacing: '.08em',
        color: 'var(--c-text-mid)',
        flexShrink: 0
      }}>{label}</span>
      <div style={{
        flex: 1,
        height: '6px',
        background: 'var(--c-bg-2)',
        borderRadius: '6px',
        overflow: 'hidden'
      }}>
        <div style={{
          width: `${pct}%`,
          height: '100%',
          background: color
        }} />
      </div>
      <span style={{
        fontFamily: '"IBM Plex Mono", monospace',
        fontSize: '9px',
        color: 'var(--c-text-dim)',
        width: '30px',
        textAlign: 'right'
      }}>{value}</span>
    </div>
  );
}

export function Insights() {
  const allPosts = useAllPosts();
  const metrics = useMetrics();
  const role = usePlanStore((s) => s.role);
  const insightsPeriod = usePlanStore((s) => s.insightsPeriod);
  const setInsightsPeriod = usePlanStore((s) => s.setInsightsPeriod);

  const [sheetOpen, setSheetOpen] = useState(false);

  const bounds = useMemo(() => periodBounds(insightsPeriod), [insightsPeriod]);

  const posts = useMemo(() => {
    return allPosts.filter((p) => {
      const ref = p.updated_at || p.status_changed_at || p.created_at;
      return inRange(ref, bounds.since, bounds.now);
    });
  }, [allPosts, bounds.since.getTime(), bounds.now.getTime()]);

  const priorPosts = useMemo(() => {
    return allPosts.filter((p) => {
      const ref = p.updated_at || p.status_changed_at || p.created_at;
      return inRange(ref, bounds.prior, bounds.since);
    });
  }, [allPosts, bounds.prior.getTime(), bounds.since.getTime()]);

  const computeCore = (pool) => {
    const published = pool.filter((p) => p.stage === 'published');
    const rejected = pool.filter((p) => p.stage === 'rejected');
    const total = pool.length;
    const reliabilityDenom = published.length + rejected.length;
    const reliability = reliabilityDenom > 0
      ? Math.round((published.length / reliabilityDenom) * 100)
      : null;
    const cycles = published
      .map((p) => daysBetween(p.created_at, p.status_changed_at))
      .filter((d) => d > 0);
    const avgCycle = cycles.length > 0
      ? Math.round((cycles.reduce((a, b) => a + b, 0) / cycles.length) * 10) / 10
      : null;
    const rework = total > 0
      ? Math.round((rejected.length / total) * 100)
      : 0;
    const rejection = total > 0
      ? Math.round((rejected.length / total) * 100)
      : 0;
    return { published, rejected, total, reliability, avgCycle, rework, rejection };
  };

  const stats = useMemo(() => {
    const core = computeCore(posts);
    const prior = computeCore(priorPosts);
    const published = core.published;
    const rejected = core.rejected;
    const parked = posts.filter((p) => p.stage === 'parked');
    const scheduled = posts.filter((p) => p.stage === 'scheduled');
    const total = core.total;
    const reliability = core.reliability;
    const avgCycle = core.avgCycle;

    // Bottleneck - average dwell time per stage (among posts currently
    // in that stage, days since status_changed_at).
    const stageDwells = {};
    for (const p of posts) {
      if (!p.stage) continue;
      if (!stageDwells[p.stage]) stageDwells[p.stage] = [];
      stageDwells[p.stage].push(daysBetween(p.status_changed_at, null));
    }
    const dwellPairs = Object.entries(stageDwells)
      .map(([s, arr]) => [s, arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const maxDwell = dwellPairs.reduce((m, p) => Math.max(m, p[1]), 0);

    const rework = core.rework;
    const rejection = core.rejection;

    // Owner workload
    const byOwner = {};
    for (const p of posts) {
      const key = p.owner || 'Unassigned';
      byOwner[key] = (byOwner[key] || 0) + 1;
    }
    const ownerBars = Object.entries(byOwner).sort((a, b) => b[1] - a[1]);
    const maxOwner = ownerBars.reduce((m, p) => Math.max(m, p[1]), 0);

    // Pillar mix
    const byPillar = {};
    for (const p of posts) {
      if (!p.content_pillar) continue;
      byPillar[p.content_pillar] = (byPillar[p.content_pillar] || 0) + 1;
    }
    const pillarBars = Object.entries(byPillar).sort((a, b) => b[1] - a[1]);
    const maxPillar = pillarBars.reduce((m, p) => Math.max(m, p[1]), 0);

    // Format mix
    const byFormat = {};
    for (const p of posts) {
      if (!p.format) continue;
      byFormat[p.format] = (byFormat[p.format] || 0) + 1;
    }
    const formatBars = Object.entries(byFormat).sort((a, b) => b[1] - a[1]);
    const maxFormat = formatBars.reduce((m, p) => Math.max(m, p[1]), 0);

    // Format mix for rejection note
    const rejectedFormats = {};
    for (const p of rejected) {
      const f = p.format || '(no format)';
      rejectedFormats[f] = (rejectedFormats[f] || 0) + 1;
    }
    const dominantFormat = Object.entries(rejectedFormats).sort((a, b) => b[1] - a[1])[0];

    return {
      total,
      published: published.length,
      scheduled: scheduled.length,
      parked: parked.length,
      rejected: rejected.length,
      reliability,
      avgCycle,
      dwellPairs,
      maxDwell,
      rework,
      rejection,
      dominantFormat: dominantFormat ? dominantFormat[0] : null,
      ownerBars,
      maxOwner,
      pillarBars,
      maxPillar,
      formatBars,
      maxFormat,
      prior
    };
  }, [posts, priorPosts, metrics]);

  return (
    <div style={{ padding: '14px 12px 80px' }}>
      {/* Header */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '4px 4px 14px' }}>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            background: 'var(--c-bg-2)',
            border: '1px solid var(--c-divider-soft)',
            padding: '6px 10px',
            borderRadius: '100px',
            fontFamily: '"IBM Plex Mono", monospace',
            fontSize: '10px',
            color: 'var(--c-text-mid)',
            letterSpacing: '.08em',
            textTransform: 'uppercase',
            cursor: 'pointer'
          }}>
          {PERIOD_LABELS[insightsPeriod] || PERIOD_LABELS.month} <ChevronDown size={12} />
        </button>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '6px 10px',
          fontFamily: '"IBM Plex Mono", monospace',
          fontSize: '10px',
          letterSpacing: '.08em',
          textTransform: 'uppercase',
          color: 'var(--c-green-deep)'
        }}>
          <ArrowUpRight size={11} />
          {PERIOD_COMPARE_LABELS[insightsPeriod] || PERIOD_COMPARE_LABELS.month}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <Card title="Publish reliability">
          <BigStat
            value={stats.reliability == null ? '-' : stats.reliability}
            suffix={stats.reliability == null ? '' : '%'}
            sub={deltaLabel(stats.reliability, stats.prior.reliability, { suffix: 'pp', compareLabel: PERIOD_COMPARE_LABELS[insightsPeriod] || '' })}
            subColor={deltaColor(stats.reliability, stats.prior.reliability, true)}
          />
        </Card>

        <Card title="Avg cycle">
          <BigStat
            value={stats.avgCycle == null ? '-' : stats.avgCycle}
            suffix={stats.avgCycle == null ? '' : 'd'}
            sub={deltaLabel(stats.avgCycle, stats.prior.avgCycle, { suffix: 'd', compareLabel: PERIOD_COMPARE_LABELS[insightsPeriod] || '' })}
            subColor={deltaColor(stats.avgCycle, stats.prior.avgCycle, false)}
          />
        </Card>

        <Card title="Bottleneck - where work sits longest" span={2}>
          {stats.dwellPairs.length === 0 ? (
            <div style={{
              fontFamily: '"DM Sans", sans-serif',
              fontSize: '12px',
              fontStyle: 'italic',
              color: 'var(--c-text-dim)'
            }}>No data</div>
          ) : stats.dwellPairs.map(([stage, days]) => (
            <Bar
              key={stage}
              label={STAGE_LABELS[stage] || stage}
              value={Math.round(days * 10) / 10}
              max={stats.maxDwell}
              color={`var(${STAGE_COLOR_VAR[stage] || '--c-text-dim'})`}
            />
          ))}
        </Card>

        <Card title="Rework rate">
          <BigStat
            value={stats.rework}
            suffix="%"
            sub={deltaLabel(stats.rework, stats.prior.rework, { suffix: 'pp', compareLabel: PERIOD_COMPARE_LABELS[insightsPeriod] || '' })}
            subColor={deltaColor(stats.rework, stats.prior.rework, false)}
          />
        </Card>

        <Card title="Rejection rate">
          <BigStat
            value={stats.rejection}
            suffix="%"
            sub={deltaLabel(stats.rejection, stats.prior.rejection, { suffix: 'pp', compareLabel: PERIOD_COMPARE_LABELS[insightsPeriod] || '' })}
            subColor={deltaColor(stats.rejection, stats.prior.rejection, false)}
          />
        </Card>

        {role === 'admin' ? (
          <Card title="Claude spend" span={2}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <BigStat value="-" suffix="" sub="Month to date" />
              <div style={{
                fontFamily: '"IBM Plex Mono", monospace',
                fontSize: '9px',
                color: 'var(--c-text-dim)',
                letterSpacing: '.08em',
                textTransform: 'uppercase'
              }}>Admin only</div>
            </div>
            <div style={{
              height: '6px',
              background: 'var(--c-bg-2)',
              borderRadius: '6px',
              overflow: 'hidden',
              marginTop: '12px'
            }}>
              <div style={{ width: '0%', height: '100%', background: 'var(--c-amber)' }} />
            </div>
            {/* TODO PR 2 or 3: wire to /ai_usage aggregate endpoint */}
          </Card>
        ) : null}

        <Card title="Owner workload" span={2}>
          {stats.ownerBars.length === 0 ? (
            <div style={{
              fontFamily: '"DM Sans", sans-serif',
              fontSize: '12px',
              fontStyle: 'italic',
              color: 'var(--c-text-dim)'
            }}>No data</div>
          ) : stats.ownerBars.map(([owner, count]) => (
            <Bar
              key={owner}
              label={OWNER_LABELS[owner] || owner}
              value={count}
              max={stats.maxOwner}
              color={`var(${OWNER_COLOR_VAR[owner] || '--c-text-dim'})`}
            />
          ))}
        </Card>

        <Card title="Pillar mix" span={2}>
          {stats.pillarBars.length === 0 ? (
            <div style={{
              fontFamily: '"DM Sans", sans-serif',
              fontSize: '12px',
              fontStyle: 'italic',
              color: 'var(--c-text-dim)'
            }}>No data</div>
          ) : stats.pillarBars.map(([pillar, count]) => (
            <Bar
              key={pillar}
              label={PILLAR_LABELS[pillar] || pillar}
              value={count}
              max={stats.maxPillar}
              color={`var(${PILLAR_COLOR_VAR[pillar] || '--c-text-dim'})`}
            />
          ))}
        </Card>

        <Card title="Format mix" span={2}>
          {stats.formatBars.length === 0 ? (
            <div style={{
              fontFamily: '"DM Sans", sans-serif',
              fontSize: '12px',
              fontStyle: 'italic',
              color: 'var(--c-text-dim)'
            }}>No data</div>
          ) : stats.formatBars.map(([fmt, count]) => (
            <Bar
              key={fmt}
              label={FORMAT_LABELS[fmt] || fmt}
              value={count}
              max={stats.maxFormat}
              color={`var(${FORMAT_COLOR_VAR[fmt] || '--c-text-dim'})`}
            />
          ))}
        </Card>
      </div>
      {sheetOpen ? (
        <PeriodSheet
          current={insightsPeriod}
          onPick={(p) => { setInsightsPeriod(p); setSheetOpen(false); }}
          onClose={() => setSheetOpen(false)}
        />
      ) : null}
    </div>
  );
}
