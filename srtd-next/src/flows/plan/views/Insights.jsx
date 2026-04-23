// Insights dashboard. All stats client-computed from posts +
// metrics arrays. No new RPC endpoints in PR 1. Claude Spend is
// admin-only and shows a placeholder dash (real number requires
// ai_usage fetch - deferred to PR 2 or 3).

import React, { useMemo } from 'react';
import { ChevronDown, ArrowUpRight } from 'lucide-react';
import { useAllPosts } from '../hooks/usePosts.js';
import { useMetrics } from '../hooks/useMetrics.js';
import { usePlanStore } from '../store/planStore.js';
import {
  STAGE_LABELS, STAGE_COLOR_VAR, OWNER_COLOR_VAR,
  OWNER_LABELS, PILLAR_LABELS, PILLAR_COLOR_VAR
} from '../shared/constants.js';
import { parseISODate, daysBetween, formatTime12, monthAbbr, dayNumber } from '../shared/dateUtils.js';

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
  const posts = useAllPosts();
  const metrics = useMetrics();
  const role = usePlanStore((s) => s.role);
  const openCard = usePlanStore((s) => s.openCard);
  const showToast = usePlanStore((s) => s.showToast);

  const stats = useMemo(() => {
    const published = posts.filter((p) => p.stage === 'published');
    const rejected = posts.filter((p) => p.stage === 'rejected');
    const parked = posts.filter((p) => p.stage === 'parked');
    const scheduled = posts.filter((p) => p.stage === 'scheduled');
    const total = posts.length;

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

    const rework = total > 0
      ? Math.round((rejected.length / total) * 100)
      : 0;
    const rejection = total > 0
      ? Math.round((rejected.length / total) * 100)
      : 0;

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

    // Top post
    const withMetrics = published
      .map((p) => ({ post: p, m: metrics[p.id] }))
      .filter((x) => x.m);
    const sorted = withMetrics.sort((a, b) => {
      const er = (b.m.engagement_rate || 0) - (a.m.engagement_rate || 0);
      if (er !== 0) return er;
      const ba = (b.m.likes || 0) + (b.m.comments || 0) + (b.m.reposts || 0);
      const aa = (a.m.likes || 0) + (a.m.comments || 0) + (a.m.reposts || 0);
      return ba - aa;
    });
    const topPost = sorted[0] || null;

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
      topPost
    };
  }, [posts, metrics]);

  return (
    <div style={{ padding: '14px 12px 80px' }}>
      {/* Header */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '4px 4px 14px' }}>
        <button
          type="button"
          onClick={() => showToast({ msg: 'Period switcher coming in PR 2', duration: 2500 })}
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
          April 2026 <ChevronDown size={12} />
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
          vs Mar
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <Card title="Publish reliability">
          <BigStat
            value={stats.reliability == null ? '-' : stats.reliability}
            suffix={stats.reliability == null ? '' : '%'}
            sub={stats.reliability != null ? `${stats.published} of ${stats.published + stats.rejected}` : null}
          />
        </Card>

        <Card title="Avg cycle">
          <BigStat
            value={stats.avgCycle == null ? '-' : stats.avgCycle}
            suffix={stats.avgCycle == null ? '' : 'd'}
            sub={stats.avgCycle != null ? 'brief to published' : null}
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
          <BigStat value={stats.rework} suffix="%" sub={`${stats.rejected} rejected`} />
        </Card>

        <Card title="Rejection rate">
          <BigStat
            value={stats.rejection}
            suffix="%"
            sub={stats.dominantFormat ? `Most: ${stats.dominantFormat}` : null}
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

        <Card title="Top post" span={2} onClick={stats.topPost ? () => openCard(stats.topPost.post) : undefined}>
          {!stats.topPost ? (
            <div style={{
              fontFamily: '"DM Sans", sans-serif',
              fontSize: '12px',
              fontStyle: 'italic',
              color: 'var(--c-text-dim)'
            }}>No published posts in this period.</div>
          ) : (
            <>
              <div style={{
                fontFamily: 'Fraunces, serif',
                fontSize: '20px',
                fontWeight: 500,
                color: 'var(--c-text-loud)',
                lineHeight: 1.2,
                marginBottom: '10px'
              }}>{stats.topPost.post.title || 'Untitled'}</div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                {stats.topPost.post.content_pillar ? (
                  <span style={{
                    padding: '3px 7px',
                    background: 'var(--c-bg-2)',
                    borderRadius: '2px',
                    fontFamily: '"IBM Plex Mono", monospace',
                    fontSize: '8.5px',
                    textTransform: 'uppercase',
                    letterSpacing: '.1em',
                    color: 'var(--c-text-mid)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}>
                    <span style={{
                      width: '6px', height: '6px', borderRadius: '6px',
                      background: `var(${PILLAR_COLOR_VAR[stats.topPost.post.content_pillar] || '--c-text-dim'})`
                    }} />
                    {PILLAR_LABELS[stats.topPost.post.content_pillar] || stats.topPost.post.content_pillar}
                  </span>
                ) : null}
                {stats.topPost.post.owner ? (
                  <span style={{
                    padding: '3px 7px',
                    background: 'var(--c-bg-2)',
                    borderRadius: '2px',
                    fontFamily: '"IBM Plex Mono", monospace',
                    fontSize: '8.5px',
                    textTransform: 'uppercase',
                    letterSpacing: '.1em',
                    color: 'var(--c-text-mid)'
                  }}>{stats.topPost.post.owner}</span>
                ) : null}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                <div>
                  <div style={{ fontFamily: 'Fraunces, serif', fontSize: '20px', fontWeight: 500, color: 'var(--c-text-loud)' }}>
                    {stats.topPost.m.impressions || 0}
                  </div>
                  <div style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '.12em', color: 'var(--c-text-dim)' }}>
                    Views
                  </div>
                </div>
                <div>
                  <div style={{ fontFamily: 'Fraunces, serif', fontSize: '20px', fontWeight: 500, color: 'var(--c-text-loud)' }}>
                    {stats.topPost.m.likes || 0}
                  </div>
                  <div style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '.12em', color: 'var(--c-text-dim)' }}>
                    Likes
                  </div>
                </div>
                <div>
                  <div style={{ fontFamily: 'Fraunces, serif', fontSize: '20px', fontWeight: 500, color: 'var(--c-text-loud)' }}>
                    {((stats.topPost.m.engagement_rate || 0) * 100).toFixed(1)}%
                  </div>
                  <div style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '.12em', color: 'var(--c-text-dim)' }}>
                    ER
                  </div>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
