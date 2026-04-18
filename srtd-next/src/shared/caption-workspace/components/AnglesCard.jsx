import React from 'react';
import { Sparkles, RotateCcw } from './icons.js';
import { useCaptionWorkspaceStore } from '../store.js';
import { stripMarkdown } from '../utils.js';

// 3 strategic angles Claude proposed for the brief. Tapping an
// angle IS the confirmation — it fires requestDraftFromAngle
// immediately. "Regenerate angles" link under the 3 cards calls
// requestAngles() to replace them.

export function AnglesCard({ msg }) {
  const requestDraftFromAngle = useCaptionWorkspaceStore((s) => s.requestDraftFromAngle);
  const requestAngles = useCaptionWorkspaceStore((s) => s.requestAngles);
  const isSending = useCaptionWorkspaceStore((s) => s.isSending);
  const angles = (msg.meta && msg.meta.angles) || [];

  return (
    <div className="rounded-card border border-divider-soft bg-bg-2 p-4 space-y-3">
      <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-widest text-text-soft">
        <Sparkles size={11} strokeWidth={1.7} className="text-terracotta" />
        <span>3 angles — tap one to draft</span>
      </div>
      <div className="space-y-2">
        {angles.map((a, i) => (
          <button
            key={i}
            onClick={() => requestDraftFromAngle(msg.id, i)}
            disabled={isSending}
            className="block w-full text-left rounded-block border border-divider-soft bg-bg px-3 py-2.5 cursor-pointer hover:border-border-warm hover:bg-bg-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            <div className="font-mono text-[9px] uppercase tracking-widest text-terracotta mb-1">
              Angle {i + 1} · {stripMarkdown(a.title)}
            </div>
            <div className="font-serif text-[14px] text-text-loud leading-snug">
              {stripMarkdown(a.hook)}
            </div>
          </button>
        ))}
      </div>
      <div className="flex justify-end pt-1">
        <button
          onClick={() => requestAngles()}
          disabled={isSending}
          className="flex items-center gap-1.5 font-mono text-[12px] text-text-soft hover:text-text-loud transition-colors disabled:opacity-50">
          <RotateCcw size={11} strokeWidth={1.7} /> Regenerate angles
        </button>
      </div>
    </div>
  );
}
