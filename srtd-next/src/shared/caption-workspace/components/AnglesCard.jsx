import React from 'react';
import { Sparkles } from './icons.js';
import { useCaptionWorkspaceStore } from '../store.js';

export function AnglesCard({ msg }) {
  const requestDraftFromAngle = useCaptionWorkspaceStore((s) => s.requestDraftFromAngle);
  const angles = (msg.meta && msg.meta.angles) || [];

  return (
    <div className="rounded-card border border-divider-soft bg-bg-2 p-4 space-y-3">
      <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-widest text-text-soft">
        <Sparkles size={11} strokeWidth={1.7} className="text-terracotta" />
        <span>3 angles — tap one to expand</span>
      </div>
      <div className="space-y-2">
        {angles.map((a, i) => (
          <button
            key={i}
            onClick={() => requestDraftFromAngle(msg.id, i)}
            className="block w-full text-left rounded-block border border-divider-soft bg-bg px-3 py-2.5 hover:border-border-warm hover:bg-bg-3 transition-colors">
            <div className="font-mono text-[9px] uppercase tracking-widest text-terracotta mb-1">
              Angle {i + 1} · {a.title}
            </div>
            <div className="font-serif text-[14px] text-text-loud leading-snug">
              {a.hook}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
