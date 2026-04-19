import React from 'react';
import { ArrowRight } from 'lucide-react';
import { STAGE_LABELS, STAGE_TOKEN } from '../utils/stage.js';
import { timeSince } from '../utils/time.js';

export function StageStrip({ post, canMove, onMove }) {
  const stage = post?.stage || 'in_production';
  const label = STAGE_LABELS[stage] || stage;
  const token = STAGE_TOKEN[stage] || 'text-soft';
  const since = timeSince(post?.status_changed_at || post?.updated_at);
  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-divider-warm">
      <span className="w-2.5 h-2.5 rounded-pill flex-shrink-0" style={{ backgroundColor: `var(--c-${token})` }} />
      <span className="text-base font-medium text-text-loud tracking-tight">{label}</span>
      {since && <span className="font-mono text-sm text-text-soft">{since}</span>}
      <span className="flex-1" />
      {canMove && (
        <button onClick={onMove} className="inline-flex items-center gap-1.5 text-sm font-medium text-text-mid px-2.5 py-1.5 rounded-sm2 hover:bg-bg-2 hover:text-text-loud" title="Move stage">
          <ArrowRight size={12} />
          <span>Move</span>
          <span className="font-mono text-2xs text-text-dim px-1 py-px border border-border-neutral rounded-sm2 bg-bg">S</span>
        </button>
      )}
    </div>
  );
}
