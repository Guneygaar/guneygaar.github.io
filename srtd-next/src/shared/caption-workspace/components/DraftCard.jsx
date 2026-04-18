import React from 'react';
import { Sparkles, Check, ShieldCheck, Lock, RotateCcw } from './icons.js';
import { useCaptionWorkspaceStore } from '../store.js';

// Claude draft card. Contenteditable body (edit-in-place saves to
// store on blur). Chips below: Shorter / Warmer / Sharper / Review
// / Finalise. After review-all-PASS, the primary chip flips to
// green "✓ Use this".

const REFINE_CHIPS = ['Shorter', 'Warmer', 'Sharper'];

export function DraftCard({ msg }) {
  const applyRefineChip = useCaptionWorkspaceStore((s) => s.applyRefineChip);
  const updateDraftContent = useCaptionWorkspaceStore((s) => s.updateDraftContent);
  const finaliseDraft = useCaptionWorkspaceStore((s) => s.finaliseDraft);
  const runReview = useCaptionWorkspaceStore((s) => s.runReview);
  const useThis = useCaptionWorkspaceStore((s) => s.useThis);
  const isSending = useCaptionWorkspaceStore((s) => s.isSending);

  const meta = msg.meta || {};
  const content = meta.content || msg.content || '';
  const isFinalised = meta.finalised;
  const allPass = meta.allPass;
  const draftLabel = meta.fromAngle
    ? `Claude · Draft ${meta.fromAngle}${meta.refineType ? ` (${meta.refineType})` : ''}`
    : 'Claude · Draft';

  return (
    <div
      className={
        'rounded-card border p-4 space-y-3 ' +
        (isFinalised
          ? 'border-amber bg-bg-memo shadow-memo'
          : 'border-divider-soft bg-bg-2')
      }>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-widest text-text-soft">
          <Sparkles size={11} strokeWidth={1.7} className="text-terracotta" />
          <span>{draftLabel}</span>
          {isFinalised && (
            <span className="flex items-center gap-1 text-amber">
              <Lock size={10} strokeWidth={2} /> Finalised
            </span>
          )}
        </div>
      </div>

      <div
        contentEditable={!isFinalised}
        suppressContentEditableWarning
        onBlur={(e) => updateDraftContent(msg.id, e.currentTarget.textContent || '')}
        className={
          'font-serif text-[15px] leading-relaxed whitespace-pre-wrap outline-none ' +
          (isFinalised ? 'text-text-loud' : 'text-text-loud border border-transparent hover:border-border-neutral focus:border-border-warm rounded-block px-2 py-1.5 -mx-2 -my-1.5 cursor-text')
        }>
        {content}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        {!isFinalised && REFINE_CHIPS.map((type) => (
          <button
            key={type}
            onClick={() => applyRefineChip(msg.id, type)}
            disabled={isSending}
            className="btn-chip disabled:opacity-50">
            {type}
          </button>
        ))}
        <button
          onClick={() => runReview(msg.id)}
          disabled={isSending}
          className="btn-chip flex items-center gap-1 disabled:opacity-50">
          <ShieldCheck size={11} strokeWidth={1.7} /> Review
        </button>
        {allPass ? (
          <button
            onClick={() => useThis(msg.id)}
            className="ml-auto flex items-center gap-1.5 rounded-chip px-3 py-[7px] font-mono text-xs font-semibold uppercase tracking-wide text-text-loud bg-green-grad">
            <Check size={12} strokeWidth={2.5} /> Use this
          </button>
        ) : isFinalised ? (
          <>
            <button
              onClick={() => useThis(msg.id)}
              className="ml-auto flex items-center gap-1.5 rounded-chip px-3 py-[7px] font-mono text-xs font-semibold uppercase tracking-wide text-text-loud bg-terracotta-grad">
              <Check size={12} strokeWidth={2.5} /> Use this
            </button>
          </>
        ) : (
          <button
            onClick={() => finaliseDraft(msg.id)}
            className="ml-auto flex items-center gap-1.5 btn-chip">
            Finalise
          </button>
        )}
      </div>
    </div>
  );
}
