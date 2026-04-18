import React from 'react';
import { ShieldCheck, Check, AlertCircle, RotateCcw } from './icons.js';
import { useCaptionWorkspaceStore } from '../store.js';

// Review result card. Checkbox list of FLAGs (checked by default)
// + locked PASS rows. "Regenerate · fix N flags" primary at the
// bottom; disabled when no flags remain checked.

export function ReviewBlock({ msg }) {
  const toggleReviewFlag = useCaptionWorkspaceStore((s) => s.toggleReviewFlag);
  const regenerateFromFlags = useCaptionWorkspaceStore((s) => s.regenerateFromFlags);
  const isSending = useCaptionWorkspaceStore((s) => s.isSending);

  const items = (msg.meta && msg.meta.items) || [];
  const flagsChecked = (msg.meta && msg.meta.flagsChecked) || {};
  const flagIdxs = items.map((it, i) => (it.mark === 'FLAG' ? i : null)).filter((i) => i !== null);
  const checkedCount = flagIdxs.filter((i) => flagsChecked[i]).length;
  const totalFlags = flagIdxs.length;

  return (
    <div className="rounded-card border border-divider-soft bg-bg-2 p-4 space-y-3">
      <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-widest text-text-soft">
        <ShieldCheck size={11} strokeWidth={1.7} className="text-terracotta" />
        <span>Review — {totalFlags === 0 ? 'all clear' : `${totalFlags} flag${totalFlags === 1 ? '' : 's'}`}</span>
      </div>

      <div className="space-y-1.5">
        {items.map((it, i) => {
          const isFlag = it.mark === 'FLAG';
          const checked = !!flagsChecked[i];
          return (
            <div
              key={i}
              className={
                'flex items-start gap-2.5 rounded-block px-2.5 py-2 ' +
                (isFlag ? 'bg-bg border border-divider-soft' : 'bg-bg')
              }>
              <button
                onClick={() => isFlag && toggleReviewFlag(msg.id, i)}
                disabled={!isFlag}
                aria-label={isFlag ? (checked ? 'Uncheck flag' : 'Check flag') : 'Passed'}
                className={
                  'shrink-0 w-4 h-4 rounded-[3px] mt-0.5 flex items-center justify-center ' +
                  (isFlag
                    ? (checked ? 'bg-red border border-red' : 'border border-border-neutral')
                    : 'bg-green border border-green cursor-default')
                }>
                {(isFlag ? checked : true) && (
                  <Check size={10} strokeWidth={3} className="text-text-loud" />
                )}
              </button>
              <div className="flex-1 min-w-0 leading-snug">
                <div className={
                  'font-mono text-[9px] uppercase tracking-widest ' +
                  (isFlag ? 'text-red' : 'text-green')
                }>
                  {it.mark} · {it.title}
                </div>
                <div className="font-sans text-[12.5px] text-text-mid mt-0.5">
                  {it.text}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {totalFlags > 0 && (
        <div className="flex items-center justify-between gap-3 pt-1 border-t border-divider-soft">
          <div className="font-mono text-[9px] uppercase tracking-widest text-text-soft">
            {checkedCount} of {totalFlags} flag{totalFlags === 1 ? '' : 's'} selected
          </div>
          <button
            onClick={() => regenerateFromFlags(msg.id)}
            disabled={checkedCount === 0 || isSending}
            className={
              'flex items-center gap-1.5 rounded-chip px-3 py-[7px] font-mono text-xs font-semibold uppercase tracking-wide ' +
              (checkedCount === 0 || isSending
                ? 'bg-bg-3 text-text-dim cursor-not-allowed'
                : 'bg-terracotta-grad text-text-loud')
            }>
            <RotateCcw size={12} strokeWidth={2} /> Regenerate · fix {checkedCount}
          </button>
        </div>
      )}
    </div>
  );
}
