import React, { useEffect, useState } from 'react';
import { X, PanelRight } from 'lucide-react';
import { STAGE_LABELS, STAGE_TOKEN } from '../utils/stage.js';
import { pcsFlow } from '../index.js';
import { useIsClient } from '../../../core/stores/appState.js';
import { daysSince } from '../../plan/shared/dateUtils.js';

// Aging threshold: AgeBadge (plan/shared/AgeBadge.jsx) treats days >= 7 as
// the red bucket. For the client-facing overdue capsule we render only when
// N strictly exceeds that threshold (matches "exceeds 7 days" requirement).
const STAGE_AGING_THRESHOLD_DAYS = 7;

export function KickerRow({ post, isAdmin, canMove, onOpenSheet, onOpenStage }) {
  const [compressed, setCompressed] = useState(false);
  const isClient = useIsClient();

  useEffect(() => {
    const onScroll = () => setCompressed(window.scrollY > 60);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const stage = post?.stage || '';
  const stageToken = STAGE_TOKEN[stage] || 'stage-production';
  const stageLabel = (STAGE_LABELS[stage] || stage || '').toUpperCase();

  // Days the post has spent in its current stage. Uses the same
  // status_changed_at field that AgeBadge reads from, so the client and
  // agency surfaces stay in sync.
  const daysInStage = daysSince(post?.status_changed_at);
  const showOverdue = isClient && daysInStage > STAGE_AGING_THRESHOLD_DAYS;

  return (
    <header
      className={`sticky top-0 z-[20] flex items-center justify-between bg-bg border-b border-divider-subtle ${compressed ? 'h-8' : 'h-10'}`}
      style={{
        boxShadow: compressed ? '0 1px 0 var(--c-divider-subtle)' : 'none',
        transition: 'height 0.22s cubic-bezier(0.2, 0, 0.1, 1), box-shadow 0.2s ease',
      }}
    >
      <div className="flex items-center gap-0.5 flex-shrink-0 pl-2">
        <button
          onClick={() => pcsFlow.close()}
          className="w-9 h-9 inline-flex items-center justify-center rounded-sm2 text-text-mid hover:text-text-loud active:bg-bg-2 active:scale-[0.96]"
          style={{ transition: 'background 0.08s ease, color 0.1s ease, transform 0.08s ease' }}
          aria-label="Close"
        >
          <X size={16} strokeWidth={1.75} />
        </button>
      </div>
      <div className="flex-1 min-w-0 flex items-center gap-2 px-1 overflow-hidden">
        {canMove ? (
          <button
            onClick={onOpenStage}
            className="font-mono text-sm tracking-widest uppercase text-text-soft flex items-center gap-2 flex-shrink-0 cursor-pointer"
            style={{ fontFeatureSettings: "'tnum' 1" }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: `var(--c-${stageToken})` }}
            />
            <span>{stageLabel}</span>
          </button>
        ) : (
          <div
            className="font-mono text-sm tracking-widest uppercase text-text-soft flex items-center gap-2 flex-shrink-0"
            style={{ fontFeatureSettings: "'tnum' 1" }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: `var(--c-${stageToken})` }}
            />
            <span>{stageLabel}</span>
          </div>
        )}
        {showOverdue && (
          <span
            className="font-mono tracking-widest uppercase flex-shrink-0 inline-flex items-center"
            style={{
              color: 'var(--c-amber)',
              background: 'color-mix(in srgb, var(--c-amber) 14%, transparent)',
              fontSize: '8.5px',
              letterSpacing: '0.08em',
              padding: '2px 6px',
              borderRadius: '2px',
              whiteSpace: 'nowrap',
            }}
          >
            {`Overdue ${daysInStage} days`}
          </span>
        )}
        <span
          className="text-text-dim"
          style={{ opacity: compressed ? 1 : 0, transition: 'opacity 0.2s ease' }}
        >
          {'·'}
        </span>
        <span
          className="font-sans text-base font-medium text-text-mid whitespace-nowrap overflow-hidden text-ellipsis"
          style={{
            opacity: compressed ? 1 : 0,
            maxWidth: compressed ? 320 : 0,
            transition: 'opacity 0.2s ease, max-width 0.22s cubic-bezier(0.2, 0, 0.1, 1)',
          }}
        >
          {post?.title || 'Untitled'}
        </span>
      </div>
      <div className="flex items-center gap-0.5 flex-shrink-0 pr-2">
        <button
          onClick={onOpenSheet}
          className="w-9 h-9 inline-flex items-center justify-center rounded-sm2 text-text-mid hover:text-text-loud active:bg-bg-2 active:scale-[0.96]"
          style={{ transition: 'background 0.08s ease, color 0.1s ease, transform 0.08s ease' }}
          aria-label="Post details"
        >
          <PanelRight size={17} strokeWidth={1.75} />
        </button>
      </div>
    </header>
  );
}
