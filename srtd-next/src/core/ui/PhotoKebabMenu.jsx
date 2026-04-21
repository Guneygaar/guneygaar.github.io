import React, { useEffect, useRef, useState } from 'react';
import {
  MoreVertical, Eye, ImagePlus, Star, ArrowUpDown,
  Download, Trash2,
} from 'lucide-react';

/**
 * PhotoKebabMenu
 *
 * Props:
 *   onViewFull   : () => void          optional (card only; lightbox omits)
 *   onAdd        : () => void
 *   onSetHero    : () => void
 *   onReorder    : () => void
 *   onDownload   : () => void
 *   onRemove     : () => void
 *   canSetHero   : bool                disabled when current is already hero
 *   canReorder   : bool                disabled when only 1 image
 *   context      : 'card' | 'lightbox' default 'card'
 */
export function PhotoKebabMenu({
  onViewFull,
  onAdd,
  onSetHero,
  onReorder,
  onDownload,
  onRemove,
  canSetHero = true,
  canReorder = true,
  context = 'card',
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const popRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e) {
      if (!popRef.current || !btnRef.current) return;
      if (popRef.current.contains(e.target)) return;
      if (btnRef.current.contains(e.target)) return;
      setOpen(false);
    }
    document.addEventListener('pointerdown', onDoc, true);
    return () => document.removeEventListener('pointerdown', onDoc, true);
  }, [open]);

  function wrap(fn) {
    return (e) => {
      e.stopPropagation();
      setOpen(false);
      fn && fn();
    };
  }

  const showViewFull = context === 'card' && onViewFull;

  return (
    <div className="relative inline-block" onClick={(e) => e.stopPropagation()}>
      <button
        ref={btnRef}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="w-9 h-9 rounded-pill inline-flex items-center
                   justify-center active:scale-[0.96]"
        style={{
          background: 'rgba(0,0,0,0.55)',
          color: '#F4F3EE',
          transition: 'transform 0.08s ease',
        }}
        aria-label="Photo actions"
        aria-expanded={open}
      >
        <MoreVertical size={16} strokeWidth={1.75} />
      </button>

      {open ? (
        <div
          ref={popRef}
          className="absolute right-0 bg-bg border border-divider-subtle
                     rounded-card overflow-hidden"
          style={{
            top: 44,
            minWidth: 200,
            zIndex: 1650,
            boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
          }}
        >
          {showViewFull ? (
            <MenuRow onClick={wrap(onViewFull)} icon={<Eye size={15} />}>
              View full
            </MenuRow>
          ) : null}
          <MenuRow onClick={wrap(onAdd)} icon={<ImagePlus size={15} />}>
            Add photos
          </MenuRow>
          <MenuRow
            onClick={wrap(onSetHero)}
            icon={<Star size={15} />}
            disabled={!canSetHero}
          >
            Set as hero
          </MenuRow>
          <MenuRow
            onClick={wrap(onReorder)}
            icon={<ArrowUpDown size={15} />}
            disabled={!canReorder}
          >
            Reorder
          </MenuRow>
          <MenuRow onClick={wrap(onDownload)} icon={<Download size={15} />}>
            Download
          </MenuRow>
          <MenuRow
            onClick={wrap(onRemove)}
            icon={<Trash2 size={15} />}
            danger
          >
            Remove
          </MenuRow>
        </div>
      ) : null}
    </div>
  );
}

function MenuRow({ onClick, icon, children, disabled = false, danger = false }) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-3 px-3.5 py-2.5
                  font-sans text-lg text-left
                  border-b border-divider-subtle last:border-b-0
                  ${disabled ? 'opacity-40 cursor-not-allowed' : 'active:bg-bg-2'}
                  ${danger ? 'text-red' : 'text-text-loud'}`}
      style={{ transition: 'background 0.1s ease' }}
    >
      <span className={danger ? 'text-red' : 'text-text-mid'}>{icon}</span>
      <span className="flex-1">{children}</span>
    </button>
  );
}
