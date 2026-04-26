import React from 'react';

export function Tabs({ activeTab, onChange, commentsCount, internalCount, canSeeInternal }) {
  return (
    <div className="flex items-center gap-4 px-4 pt-2.5 pb-2
                    border-b border-divider-subtle">
      <button
        onClick={() => onChange('comments')}
        className={`font-mono text-sm tracking-widest uppercase
                    flex items-center gap-1.5 py-0.5 border-b border-transparent
                    ${activeTab === 'comments' ? 'text-text-loud border-text-loud' : 'text-text-soft'}`}
        style={{ transition: 'color 0.1s ease, border-color 0.15s ease' }}
      >
        Comments
        <span
          className="font-mono text-sm opacity-55"
          style={{ fontFeatureSettings: "'tnum' 1" }}
        >
          {commentsCount}
        </span>
      </button>

      {canSeeInternal ? (
        <button
          onClick={() => onChange('internal')}
          className={`font-mono text-sm tracking-widest uppercase
                      flex items-center gap-1.5 py-0.5 border-b border-transparent
                      ${activeTab === 'internal' ? 'text-text-loud border-text-loud' : 'text-text-soft'}`}
          style={{ transition: 'color 0.1s ease, border-color 0.15s ease' }}
        >
          Internal
          <span
            className="font-mono text-sm opacity-55"
            style={{ fontFeatureSettings: "'tnum' 1" }}
          >
            {internalCount}
          </span>
        </button>
      ) : null}

      <button
        onClick={() => onChange('history')}
        className={`font-mono text-sm tracking-widest uppercase
                    py-0.5 border-b border-transparent
                    ${activeTab === 'history' ? 'text-text-loud border-text-loud' : 'text-text-soft'}`}
        style={{ transition: 'color 0.1s ease, border-color 0.15s ease' }}
      >
        History
      </button>
    </div>
  );
}
