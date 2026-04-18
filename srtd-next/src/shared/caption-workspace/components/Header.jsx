import React from 'react';
import { Sparkles, X, ChevronDown, ChevronUp, Edit3, RotateCcw, Paperclip } from './icons.js';
import { useCaptionWorkspaceStore } from '../store.js';
import { formatINR } from '../utils.js';

// Coupled accordion header.
//   Row 1 (always): X · Sparkles+title · session meter (tap expands)
//   Row 2 (expanded only): brief body (contenteditable) + Edit / Regen angles

export function Header() {
  const headerExpanded = useCaptionWorkspaceStore((s) => s.headerExpanded);
  const title = useCaptionWorkspaceStore((s) => s.syntheticTitle || s.context?.title || 'New post');
  const brief = useCaptionWorkspaceStore((s) => s.brief);
  const briefSource = useCaptionWorkspaceStore((s) => s.briefSource);
  const attachment = useCaptionWorkspaceStore((s) => s.attachment);
  const sessionCost = useCaptionWorkspaceStore((s) => s.sessionCost);
  const todayCost = useCaptionWorkspaceStore((s) => s.todayCost);
  const monthCost = useCaptionWorkspaceStore((s) => s.monthCost);
  const toggleHeader = useCaptionWorkspaceStore((s) => s.toggleHeader);
  const close = useCaptionWorkspaceStore((s) => s.close);
  const updateBrief = useCaptionWorkspaceStore((s) => s.updateBrief);
  const requestAngles = useCaptionWorkspaceStore((s) => s.requestAngles);

  const hasBrief = !!(brief && brief.trim());

  const onHeaderTap = (e) => {
    // Only toggle if tap is on the header row chrome, not inside a control.
    if (e.target.closest('[data-cw-no-toggle]')) return;
    if (!hasBrief) return;
    toggleHeader();
  };

  return (
    <div
      onClick={onHeaderTap}
      className="border-b border-divider-soft bg-bg cursor-pointer select-none">
      {/* Row 1 */}
      <div className="flex flex-nowrap items-center gap-3 px-4 py-3">
        <button
          data-cw-no-toggle
          aria-label="Close workspace"
          onClick={(e) => { e.stopPropagation(); close(); }}
          className="text-text-soft hover:text-text-loud transition-colors">
          <X size={18} strokeWidth={1.7} />
        </button>

        <div className="flex-1 min-w-0 flex items-center gap-2">
          <Sparkles size={13} strokeWidth={1.7} className="text-terracotta shrink-0" />
          <div
            className="font-serif text-[17px] font-medium text-text-loud tracking-tight truncate"
            title={title}>
            {title}
          </div>
        </div>

        {headerExpanded ? (
          <div
            data-cw-no-toggle
            onClick={(e) => { e.stopPropagation(); toggleHeader(); }}
            className="shrink-0 max-w-[160px] flex items-center gap-3 font-mono text-[10px] uppercase tracking-widest cursor-pointer">
            <span className="flex flex-col items-end leading-tight">
              <span className="text-text-dim text-[8px]">Session</span>
              <span className="text-amber">{formatINR(sessionCost)}</span>
            </span>
            <span className="flex flex-col items-end leading-tight">
              <span className="text-text-dim text-[8px]">Today</span>
              <span className="text-text-loud">{formatINR(todayCost)}</span>
            </span>
            <span className="flex flex-col items-end leading-tight">
              <span className="text-text-dim text-[8px]">Month</span>
              <span className="text-text-loud">{formatINR(monthCost)}</span>
            </span>
            <ChevronUp size={12} className="text-text-soft" />
          </div>
        ) : (
          <div
            data-cw-no-toggle
            onClick={(e) => {
              e.stopPropagation();
              if (hasBrief) toggleHeader();
            }}
            className={
              'shrink-0 flex items-center gap-1.5 rounded-pill border border-border-neutral px-2.5 py-1 ' +
              'font-mono text-[10px] uppercase tracking-widest text-amber ' +
              (hasBrief ? 'cursor-pointer' : 'opacity-60 cursor-default')
            }>
            {formatINR(sessionCost)}
            {hasBrief && <ChevronDown size={10} className="text-text-soft" />}
          </div>
        )}
      </div>

      {/* Row 2 — expanded only, only when brief exists */}
      {headerExpanded && hasBrief && (
        <div
          data-cw-no-toggle
          onClick={(e) => e.stopPropagation()}
          className="px-4 pb-4 pt-1 space-y-2 bg-brief-grad">
          <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-widest text-text-soft">
            <Sparkles size={11} strokeWidth={1.7} className="text-terracotta" />
            <span>Brief{briefSource ? ` · from ${briefSource}` : ''}</span>
          </div>
          <div
            contentEditable
            suppressContentEditableWarning
            onBlur={(e) => updateBrief(e.currentTarget.textContent || '')}
            className="font-serif text-[14px] leading-relaxed text-text-loud border border-divider-soft rounded-block px-3 py-2 max-h-40 overflow-y-auto scrollbar-none outline-none focus:border-border-warm whitespace-pre-wrap">
            {brief}
          </div>
          {attachment && (
            <div className="flex items-center gap-2 bg-bg-pill border border-divider-soft rounded-block px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-widest text-text-mid">
              <Paperclip size={12} className="text-terracotta" />
              <span className="truncate flex-1">{attachment.name}</span>
              <span className="text-text-dim">{Math.round((attachment.size || 0) / 1024)} KB</span>
            </div>
          )}
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={() => {
                const el = document.querySelector('[data-cw-no-toggle] [contenteditable]');
                if (el && typeof el.focus === 'function') el.focus();
              }}
              className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-text-soft hover:text-text-loud transition-colors">
              <Edit3 size={11} /> Edit
            </button>
            <button
              onClick={() => requestAngles()}
              className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-terracotta hover:opacity-80 transition-opacity">
              <RotateCcw size={11} /> Regen angles
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
