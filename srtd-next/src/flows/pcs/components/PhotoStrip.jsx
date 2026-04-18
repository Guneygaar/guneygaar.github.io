import React, { useState } from 'react';
import { Upload, ImageOff, X } from 'lucide-react';

function normalizeImages(images) {
  if (!images) return [];
  if (Array.isArray(images)) return images.filter(Boolean);
  if (typeof images === 'object' && Array.isArray(images.urls)) return images.urls.filter(Boolean);
  return [];
}

function ThumbImg({ src }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-text-dim font-mono text-sm tracking-wide uppercase border border-dashed border-border-neutral">
        <ImageOff size={18} />
        <span>Failed to load</span>
      </div>
    );
  }
  return <img src={src} alt="" onError={() => setFailed(true)} className="max-w-full max-h-full object-contain" />;
}

function SingleImg({ src, onClick }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="w-full aspect-[16/9] flex flex-col items-center justify-center gap-1.5 text-text-dim font-mono text-sm tracking-wide uppercase border border-dashed border-border-neutral">
        <ImageOff size={18} />
        <span>Failed to load</span>
      </div>
    );
  }
  return (
    <div className="w-full bg-bg-2 flex items-center justify-center overflow-hidden" style={{ maxHeight: 500 }}>
      <img src={src} alt="" onClick={onClick} onError={() => setFailed(true)} className="max-w-full object-contain cursor-pointer" style={{ maxHeight: 500 }} />
    </div>
  );
}

export function PhotoStrip({ post, canEdit }) {
  const imgs = normalizeImages(post?.images);
  const count = imgs.length;
  const [lightIdx, setLightIdx] = useState(null);

  if (count === 0 && !canEdit) return null;

  return (
    <div className="border-b border-divider-warm">
      <div className="flex items-center justify-between px-3 pt-2.5 pb-1 font-mono text-sm text-text-dim tracking-widest uppercase">
        <span>Photos</span>
        {canEdit && (
          <span className="font-sans text-sm text-text-mid inline-flex items-center gap-1.5 opacity-40 cursor-not-allowed" title="Upload ships PR 2">
            <Upload size={12} />
            <span>Upload</span>
            <span className="font-mono text-2xs text-text-dim px-1 py-px border border-border-neutral rounded-sm2 bg-bg">U</span>
          </span>
        )}
      </div>
      {count === 0 ? (
        <div className="px-3 py-8 font-mono text-sm text-text-dim tracking-widest uppercase text-center">No photos yet</div>
      ) : count === 1 ? (
        <SingleImg src={imgs[0]} onClick={() => setLightIdx(0)} />
      ) : (
        <>
          <div className="flex gap-px bg-divider-warm">
            {imgs.slice(0, 4).map((src, i) => (
              <button key={i} onClick={() => setLightIdx(i)} className="flex-1 aspect-square min-w-0 bg-bg-2 flex items-center justify-center overflow-hidden cursor-pointer" aria-label={`Photo ${i + 1}`}>
                <ThumbImg src={src} />
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between px-3 py-2 font-mono text-sm text-text-dim tracking-wide">
            <span>{count} IMAGES {'\u00B7'} HERO + {count - 1}</span>
            {count > 4 && <span>+{count - 4} MORE</span>}
          </div>
        </>
      )}

      {lightIdx !== null && (
        <div className="fixed inset-0 z-[1600] bg-black/95 flex items-center justify-center" onClick={() => setLightIdx(null)}>
          <img src={imgs[lightIdx]} alt="" className="max-w-full max-h-full object-contain" />
          <button onClick={(e) => { e.stopPropagation(); setLightIdx(null); }} className="absolute top-4 right-4 w-10 h-10 rounded-pill bg-black/60 text-white flex items-center justify-center" aria-label="Close">
            <X size={20} />
          </button>
          {imgs.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
              {imgs.map((_, i) => (
                <button key={i} onClick={(e) => { e.stopPropagation(); setLightIdx(i); }} className={`w-2 h-2 rounded-pill ${i === lightIdx ? 'bg-white' : 'bg-white/30'}`} aria-label={`Go to photo ${i + 1}`} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
