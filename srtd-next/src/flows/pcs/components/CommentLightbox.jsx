import React, { useEffect, useRef, useState } from 'react';
import { X, Download, ChevronLeft, ChevronRight } from 'lucide-react';

async function downloadUrl(url) {
  try {
    const res = await fetch(url, { mode: 'cors' });
    const blob = await res.blob();
    const a = document.createElement('a');
    const obj = URL.createObjectURL(blob);
    a.href = obj;
    a.download = url.split('/').pop() || 'photo.jpg';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(obj);
  } catch (err) {
    window.open(url, '_blank');
  }
}

export function CommentLightbox({ urls, startIndex = 0, onClose }) {
  const safeUrls = Array.isArray(urls) ? urls.filter(Boolean) : [];
  const [idx, setIdx] = useState(startIndex || 0);
  const touchStartX = useRef(null);

  useEffect(() => {
    if (!safeUrls.length) return;
    function onKey(e) {
      if (e.key === 'Escape') { onClose && onClose(); return; }
      if (e.key === 'ArrowLeft') { setIdx((i) => (i > 0 ? i - 1 : safeUrls.length - 1)); return; }
      if (e.key === 'ArrowRight') { setIdx((i) => (i < safeUrls.length - 1 ? i + 1 : 0)); return; }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [safeUrls.length, onClose]);

  if (!safeUrls.length) return null;

  function onTouchStart(e) {
    const t = e.touches && e.touches[0];
    touchStartX.current = t ? t.clientX : null;
  }
  function onTouchEnd(e) {
    if (touchStartX.current == null) return;
    const t = e.changedTouches && e.changedTouches[0];
    if (!t) { touchStartX.current = null; return; }
    const dx = t.clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 50 || safeUrls.length < 2) return;
    if (dx < 0) setIdx((i) => (i < safeUrls.length - 1 ? i + 1 : 0));
    else setIdx((i) => (i > 0 ? i - 1 : safeUrls.length - 1));
  }

  return (
    <div
      className="fixed inset-0 z-[1600] bg-black/95 flex items-center justify-center"
      onClick={() => onClose && onClose()}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <img src={safeUrls[idx]} alt="" className="max-w-full max-h-full object-contain" onClick={(e) => e.stopPropagation()} />
      <button onClick={(e) => { e.stopPropagation(); onClose && onClose(); }} className="absolute top-4 right-4 w-10 h-10 rounded-pill bg-black/60 text-text-loud flex items-center justify-center" aria-label="Close">
        <X size={20} />
      </button>
      <button onClick={(e) => { e.stopPropagation(); downloadUrl(safeUrls[idx]); }} className="absolute top-4 right-16 w-10 h-10 rounded-pill bg-black/60 text-text-loud flex items-center justify-center" aria-label="Download photo">
        <Download size={18} />
      </button>
      {safeUrls.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); setIdx((i) => (i > 0 ? i - 1 : safeUrls.length - 1)); }}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-pill bg-black/60 text-text-loud flex items-center justify-center"
            aria-label="Previous photo"
          >
            <ChevronLeft size={24} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setIdx((i) => (i < safeUrls.length - 1 ? i + 1 : 0)); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-pill bg-black/60 text-text-loud flex items-center justify-center"
            aria-label="Next photo"
          >
            <ChevronRight size={24} />
          </button>
        </>
      )}
      {safeUrls.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
          {safeUrls.map((_, i) => (
            <button key={i} onClick={(e) => { e.stopPropagation(); setIdx(i); }} className={`w-2 h-2 rounded-pill ${i === idx ? 'bg-text-loud' : 'bg-white/30'}`} aria-label={`Go to photo ${i + 1}`} />
          ))}
        </div>
      )}
    </div>
  );
}
