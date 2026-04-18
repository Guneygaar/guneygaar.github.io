import React from 'react';

export function Tabs({ activeTab, onChange, commentCount, internalCount, canSeeInternal }) {
  const visibility = canSeeInternal
    ? (activeTab === 'internal' ? 'AGENCY ONLY' : 'CLIENT + AGENCY')
    : 'CLIENT + AGENCY';

  return (
    <div className="flex gap-0 border-b border-divider-warm px-3">
      <button onClick={() => onChange('comments')} className={`py-2.5 px-2.5 text-sm font-medium inline-flex items-center gap-1.5 tracking-tight border-b -mb-px ${activeTab === 'comments' ? 'text-text-loud border-terracotta' : 'text-text-soft border-transparent'}`}>
        <span>Comments</span>
        <span className={`font-mono text-sm font-medium ${activeTab === 'comments' ? 'text-terracotta' : 'text-text-dim'}`}>{commentCount}</span>
      </button>
      {canSeeInternal && (
        <button onClick={() => onChange('internal')} className={`py-2.5 px-2.5 text-sm font-medium inline-flex items-center gap-1.5 tracking-tight border-b -mb-px ${activeTab === 'internal' ? 'text-text-loud border-terracotta' : 'text-text-soft border-transparent'}`}>
          <span>Internal</span>
          <span className={`font-mono text-sm font-medium ${activeTab === 'internal' ? 'text-terracotta' : 'text-text-dim'}`}>{internalCount}</span>
        </button>
      )}
      <span className="ml-auto self-center font-mono text-sm text-text-dim tracking-wide">{visibility}</span>
    </div>
  );
}
