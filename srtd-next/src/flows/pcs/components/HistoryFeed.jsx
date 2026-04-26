import React, { useEffect, useState } from 'react';
import { diffWords } from 'diff';
import { listHistoryForPost } from '../../../core/api/history.js';
import { STAGE_LABELS } from '../utils/stage.js';
import { timeSince } from '../utils/time.js';
import { displayNameFromEmail } from '../utils/users.js';
import { logError } from '../../../core/bridges/logging.js';

const COLLAPSE_WINDOW_MS = 15 * 60 * 1000;

function prettyStage(stage) {
  if (!stage) return '';
  return STAGE_LABELS[stage] || String(stage).replace(/_/g, ' ');
}

function collapseCaptionRuns(rows) {
  const out = [];
  let run = null;

  function flushRun() {
    if (!run) return;
    out.push({
      id: run.head.id,
      type: 'caption',
      actor: run.head.actor,
      actorRole: run.head.actorRole,
      displayedAt: run.head.at,
      earliestAt: run.tail.at,
      mergedFromCaption: run.tail.caption || '',
      latestToCaption: run.head.caption || '',
      editCount: run.count,
    });
    run = null;
  }

  for (const r of rows) {
    if (r.type !== 'caption') {
      flushRun();
      out.push(r);
      continue;
    }
    if (!run) {
      run = { head: r, tail: r, count: 1 };
      continue;
    }
    const sameAuthor = (run.head.actor || '') === (r.actor || '');
    const headTs = new Date(run.head.at).getTime();
    const curTs = new Date(r.at).getTime();
    const within = Math.abs(headTs - curTs) <= COLLAPSE_WINDOW_MS;
    if (sameAuthor && within) {
      run.tail = r;
      run.count += 1;
    } else {
      flushRun();
      run = { head: r, tail: r, count: 1 };
    }
  }
  flushRun();
  return out;
}

function Dot({ color }) {
  const cls = color === 'terracotta' ? 'bg-terracotta' : 'bg-text-dim';
  return (
    <span
      className={`mt-2 inline-block w-2 h-2 rounded-full flex-shrink-0 ${cls}`}
    />
  );
}

function CaptionRow({ row, userRoles }) {
  const [open, setOpen] = useState(false);
  const name =
    displayNameFromEmail(row.actor, userRoles) ||
    (row.actor ? String(row.actor).split('@')[0] : 'Unknown');
  const headerLabel =
    row.editCount > 1 ? `Edited caption ${row.editCount} times` : 'Edited caption';
  const range =
    row.editCount > 1
      ? `${timeSince(row.earliestAt)} – ${timeSince(row.displayedAt)}`
      : timeSince(row.displayedAt);

  const parts =
    open
      ? diffWords(row.mergedFromCaption || '', row.latestToCaption || '')
      : null;

  return (
    <div className="flex gap-3 py-3 border-b border-divider-soft px-4">
      <Dot color="terracotta" />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-0.5">
          <span className="font-sans text-lg font-semibold text-text-loud">
            {name}
          </span>
          {row.actorRole && row.actorRole !== 'unknown' ? (
            <span
              className="font-mono text-xs tracking-wide text-text-dim uppercase"
            >
              {row.actorRole}
            </span>
          ) : null}
          <span
            className="font-mono text-xs tracking-wide text-text-dim uppercase ml-auto"
            style={{ fontFeatureSettings: "'tnum' 1" }}
          >
            {range}
          </span>
        </div>
        <div className="font-sans text-lg text-text-mid leading-normal">
          {headerLabel}
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="font-mono text-xs tracking-widest uppercase
                     text-terracotta border border-border-warm
                     px-2 py-1 mt-2 rounded-sm2 bg-transparent active:opacity-70"
        >
          {open ? 'Hide diff' : 'Show diff'}
        </button>
        {open && parts ? (
          <div className="mt-2 font-sans text-base text-text-mid whitespace-pre-wrap leading-normal">
            {parts.map((part, i) => {
              if (part.added) {
                return (
                  <span
                    key={i}
                    className="text-green underline decoration-green decoration-1 underline-offset-2"
                  >
                    {part.value}
                  </span>
                );
              }
              if (part.removed) {
                return (
                  <span key={i} className="text-text-dim line-through">
                    {part.value}
                  </span>
                );
              }
              return <span key={i}>{part.value}</span>;
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function StageRow({ row, userRoles }) {
  const name =
    displayNameFromEmail(row.actor, userRoles) ||
    (row.actor ? String(row.actor).split('@')[0] : 'Unknown');
  return (
    <div className="flex gap-3 py-3 border-b border-divider-soft px-4">
      <Dot color="text-dim" />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-0.5">
          <span className="font-sans text-lg font-semibold text-text-loud">
            {name}
          </span>
          {row.actorRole && row.actorRole !== 'unknown' ? (
            <span className="font-mono text-xs tracking-wide text-text-dim uppercase">
              {row.actorRole}
            </span>
          ) : null}
          <span
            className="font-mono text-xs tracking-wide text-text-dim uppercase ml-auto"
            style={{ fontFeatureSettings: "'tnum' 1" }}
          >
            {timeSince(row.at)}
          </span>
        </div>
        <div className="font-sans text-lg text-text-mid leading-normal">
          {prettyStage(row.oldStage) || '—'} {'→'} {prettyStage(row.newStage) || '—'}
        </div>
      </div>
    </div>
  );
}

function SystemRow({ row, userRoles, suppressCaption }) {
  if (!row.action) return null;
  if (suppressCaption && /caption/i.test(String(row.action))) return null;
  const name =
    displayNameFromEmail(row.actor, userRoles) ||
    (row.actor ? String(row.actor).split('@')[0] : 'Unknown');
  return (
    <div className="flex gap-3 py-3 border-b border-divider-soft px-4">
      <Dot color="text-dim" />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-0.5">
          <span className="font-sans text-lg font-semibold text-text-loud">
            {name}
          </span>
          {row.actorRole && row.actorRole !== 'unknown' ? (
            <span className="font-mono text-xs tracking-wide text-text-dim uppercase">
              {row.actorRole}
            </span>
          ) : null}
          <span
            className="font-mono text-xs tracking-wide text-text-dim uppercase ml-auto"
            style={{ fontFeatureSettings: "'tnum' 1" }}
          >
            {timeSince(row.at)}
          </span>
        </div>
        <div className="font-sans text-lg text-text-mid leading-normal">
          {String(row.action).trim()}
        </div>
      </div>
    </div>
  );
}

export function HistoryFeed({ post, userRoles }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!post || !post.id) {
      setRows([]);
      return;
    }
    let cancelled = false;
    setError(null);
    listHistoryForPost(post.id, userRoles)
      .then((result) => {
        if (cancelled) return;
        setRows(Array.isArray(result) ? result : []);
      })
      .catch((err) => {
        if (cancelled) return;
        logError(err, { context: 'pcs_react_history_load', post_id: post.post_id });
        setError(String(err && err.message ? err.message : err));
        setRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, [post && post.id, userRoles]);

  if (rows === null) {
    return (
      <div className="px-3 py-10 font-mono text-sm text-text-dim tracking-widest uppercase text-center">
        Loading history...
      </div>
    );
  }

  if (error && rows.length === 0) {
    return (
      <div className="px-3 py-10 font-mono text-sm text-red tracking-widest uppercase text-center">
        Could not load history
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="px-3 py-10 font-mono text-sm text-text-dim tracking-widest uppercase text-center">
        No history yet
      </div>
    );
  }

  const collapsed = collapseCaptionRuns(rows);
  const hasCaptionRow = collapsed.some((r) => r.type === 'caption');

  return (
    <div>
      {collapsed.map((row) => {
        if (row.type === 'caption') {
          return <CaptionRow key={row.id} row={row} userRoles={userRoles} />;
        }
        if (row.type === 'stage') {
          return <StageRow key={row.id} row={row} userRoles={userRoles} />;
        }
        return (
          <SystemRow
            key={row.id}
            row={row}
            userRoles={userRoles}
            suppressCaption={hasCaptionRow}
          />
        );
      })}
    </div>
  );
}
