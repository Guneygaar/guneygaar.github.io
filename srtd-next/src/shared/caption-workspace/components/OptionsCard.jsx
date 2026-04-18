import React from 'react';
import { useCaptionWorkspaceStore } from '../store.js';

export function OptionsCard({ msg }) {
  const useThis = useCaptionWorkspaceStore((s) => s.useThis);
  const options = (msg && msg.meta && Array.isArray(msg.meta.options)) ? msg.meta.options : [];
  if (options.length === 0) return null;
  return (
    <div className="space-y-2">
      {options.map((opt, i) => (
        <div key={i} className="rounded-card bg-bg-2 border border-divider-soft p-3">
          <div className="font-mono text-2xs text-text-dim tracking-widest uppercase mb-1.5">Option {i + 1}</div>
          <div className="font-serif text-base leading-[1.5] text-text-loud whitespace-pre-wrap">{opt}</div>
          <button onClick={() => useThis(msg.id, opt)} className="mt-2 px-3 py-1.5 rounded-sm2 bg-terracotta text-text-loud text-sm font-semibold">
            Use this
          </button>
        </div>
      ))}
    </div>
  );
}
