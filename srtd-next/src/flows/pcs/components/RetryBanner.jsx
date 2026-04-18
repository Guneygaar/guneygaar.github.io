import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export function RetryBanner({ message, onRetry }) {
  return (
    <div className="flex items-center gap-2.5 mx-3 my-2.5 px-3 py-2.5 rounded-sm2 tint-amber border">
      <AlertTriangle size={14} className="text-amber flex-shrink-0" />
      <span className="flex-1 font-mono text-sm text-amber tracking-wide uppercase font-semibold">{message}</span>
      <button onClick={onRetry} className="inline-flex items-center gap-1 font-mono text-sm text-amber tracking-wide uppercase font-semibold px-2.5 py-1 border border-amber rounded-sm2 bg-transparent cursor-pointer">
        <RefreshCw size={11} />
        <span>Retry</span>
      </button>
    </div>
  );
}
