import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../../core/api/client.js';
import { logError } from '../../../core/bridges/logging.js';

// Formatters kept local so tokens/fonts stay consistent with the rest
// of PCS. Numbers use tabular nums via font-feature-settings 'tnum'.
function formatNumber(n) {
  if (n == null || Number.isNaN(Number(n))) return '0';
  return Number(n).toLocaleString('en-US');
}

function formatEr(rate) {
  if (rate == null || Number.isNaN(Number(rate))) return '0.00% ER';
  const n = Number(rate);
  // engagement_rate is stored as a ratio (0.0008 = 0.08%) OR a direct
  // percentage (0.08 already represents 0.08%). Heuristic: anything
  // below 1 is treated as a ratio and multiplied; anything >= 1 is
  // treated as percentage points.
  const pct = n < 1 ? n * 100 : n;
  return `${pct.toFixed(2)}% ER`;
}

/**
 * StatsStrip
 *
 * Renders the LinkedIn metrics strip for a post. Only renders when the
 * post stage is 'published' AND a linkedin_posts row exists for this
 * post with a non-'unmatched' match_status. Until metrics match, this
 * returns null so PCS looks like any other stage.
 *
 * Schema: linkedin_posts.post_id is a uuid that joins posts.id (uuid),
 * NOT posts.post_id (text).
 *
 * Props: { post }
 */
export function StatsStrip({ post }) {
  const [row, setRow] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!post || post.stage !== 'published' || !post.id) {
      setRow(null);
      return () => { cancelled = true; };
    }
    (async () => {
      try {
        const encoded = encodeURIComponent(post.id);
        const rows = await apiFetch(
          `/linkedin_posts?post_id=eq.${encoded}&select=impressions,clicks,likes,comments,reposts,follows,engagement_rate,ctr,linkedin_url,match_status,posted_date&limit=1`,
          { method: 'GET', headers: { Accept: 'application/json' } },
          { allowLogout: false }
        );
        if (cancelled) return;
        const first = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
        setRow(first);
      } catch (err) {
        if (!cancelled) setRow(null);
        logError(err, { context: 'pcs_react_stats_strip_fetch' });
      }
    })();
    return () => { cancelled = true; };
  }, [post && post.id, post && post.stage]);

  if (!post || post.stage !== 'published') return null;
  if (!row) return null;
  if (row.match_status === 'unmatched') return null;

  const cells = [
    { label: 'CLICKS',   value: row.clicks },
    { label: 'LIKES',    value: row.likes },
    { label: 'COMMENTS', value: row.comments },
    { label: 'REPOSTS',  value: row.reposts },
  ];

  return (
    <div className="px-4 py-4 border-b border-divider-subtle overflow-hidden min-w-0">
      {/* Row 1: impressions headline + ER pill */}
      <div className="flex items-end justify-between gap-3 min-w-0 overflow-hidden">
        <div className="min-w-0 overflow-hidden">
          <div
            className="font-serif text-text-loud leading-none"
            style={{
              fontSize: '36px',
              fontFeatureSettings: "'tnum' 1",
            }}
          >
            {formatNumber(row.impressions)}
          </div>
          <div
            className="font-mono text-xs tracking-widest uppercase text-text-soft mt-1"
            style={{ fontFeatureSettings: "'tnum' 1" }}
          >
            IMPRESSIONS
          </div>
        </div>
        <div
          className="tint-green border rounded-sm2 flex-shrink-0"
          style={{
            color: 'var(--c-green-deep)',
            padding: '4px 8px',
          }}
        >
          <span
            className="font-mono text-xs tracking-widest uppercase"
            style={{ fontFeatureSettings: "'tnum' 1" }}
          >
            {formatEr(row.engagement_rate)}
          </span>
        </div>
      </div>

      {/* Row 2: 4-cell grid with thin vertical dividers */}
      <div
        className="grid grid-cols-4 mt-4 min-w-0"
        style={{ borderTop: '1px solid var(--c-divider-subtle)' }}
      >
        {cells.map((cell, i) => (
          <div
            key={cell.label}
            className={`min-w-0 py-2 ${i === 0 ? 'pr-2' : i === cells.length - 1 ? 'pl-2' : 'px-2'}`}
            style={{
              borderLeft: i === 0 ? 'none' : '1px solid var(--c-divider-subtle)',
            }}
          >
            <div
              className="font-serif text-text-loud leading-none"
              style={{
                fontSize: '20px',
                fontFeatureSettings: "'tnum' 1",
              }}
            >
              {formatNumber(cell.value)}
            </div>
            <div
              className="font-mono text-xs tracking-widest uppercase text-text-soft mt-1"
              style={{ fontFeatureSettings: "'tnum' 1" }}
            >
              {cell.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
