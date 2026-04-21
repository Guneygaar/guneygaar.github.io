import React from 'react';
import { ChevronRight } from 'lucide-react';

export function ViewAllLink({ label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-between w-full px-4 py-3
                 border-b border-divider-subtle
                 font-sans text-lg font-medium text-terracotta
                 active:opacity-60"
      style={{ transition: 'opacity 0.12s ease' }}
    >
      <span>{label}</span>
      <ChevronRight size={14} strokeWidth={2} />
    </button>
  );
}
