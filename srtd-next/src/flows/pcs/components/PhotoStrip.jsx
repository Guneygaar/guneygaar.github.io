import React, { useEffect, useRef, useState } from 'react';
import { Upload, ImageOff, X, Trash2, Download, ImagePlus, ChevronLeft, ChevronRight } from 'lucide-react';
import { patchPost } from '../../../core/api/posts.js';
import { writeAudit } from '../../../core/api/audit.js';
import { useAppState } from '../../../core/stores/appState.js';
import { usePcsStore } from '../pcsStore.js';
import { uploadToR2 } from '../../../core/bridges/r2.js';
import { compressImage, generateFilename } from '../../../core/utils/imageCompress.js';
import { reseedOgPreview } from '../../../core/bridges/ogPreview.js';
import { toast } from '../../../core/bridges/toast.js';
import { logClick, logError } from '../../../core/bridges/logging.js';

const TILE_SIZE = 'min(72vw, 320px)';
const SINGLE_SIZE = 'min(100vw, 390px)';
const ADD_TILE_WIDTH = '64px';

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
  return <img src={src} alt="" onError={() => setFailed(true)} className="w-full h-full object-cover block" />;
}

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

export function PhotoStrip({ post, canEdit }) {
  const imgs = normalizeImages(post?.images);
  const count = imgs.length;
  const [lightIdx, setLightIdx] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef(null);
  const touchStartX = useRef(null);
  const actor = useAppState((s) => s.user?.email || '');

  useEffect(() => {
    if (lightIdx === null) return;
    function onKey(e) {
      if (e.key === 'Escape') { setLightIdx(null); return; }
      if (e.key === 'ArrowLeft') { setLightIdx((i) => (i > 0 ? i - 1 : imgs.length - 1)); return; }
      if (e.key === 'ArrowRight') { setLightIdx((i) => (i < imgs.length - 1 ? i + 1 : 0)); return; }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightIdx, imgs.length]);

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
    if (Math.abs(dx) < 50 || imgs.length < 2) return;
    if (dx < 0) setLightIdx((i) => (i < imgs.length - 1 ? i + 1 : 0));
    else setLightIdx((i) => (i > 0 ? i - 1 : imgs.length - 1));
  }

  async function onPickFiles(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length || !post?.post_id) return;
    setBusy(true);
    try {
      const urls = [];
      for (const f of files) {
        const blob = await compressImage(f, { maxDim: 1200, quality: 0.82 });
        const url = await uploadToR2(generateFilename('jpg'), blob);
        urls.push(url);
      }
      const next = [...imgs, ...urls];
      const updated = await patchPost(post.post_id, { images: next, updated_by: actor });
      writeAudit({ postId: post.post_id, field: 'images', oldValue: count, newValue: next.length, actor }).catch(() => {});
      if (updated) usePcsStore.setState({ post: updated });
      reseedOgPreview(post.post_id);
      logClick('pcs_react_photo_upload', { postId: post.post_id, added: urls.length });
      toast(`Uploaded ${urls.length} photo${urls.length === 1 ? '' : 's'}`, 'success');
    } catch (err) {
      logError(err, { context: 'pcs_react_photo_upload', postId: post.post_id });
      toast('Photo upload failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function removeAt(idx) {
    if (!post?.post_id || busy) return;
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      if (!window.confirm('Remove this photo?')) return;
    }
    setBusy(true);
    try {
      const next = imgs.slice(0, idx).concat(imgs.slice(idx + 1));
      const updated = await patchPost(post.post_id, { images: next, updated_by: actor });
      writeAudit({ postId: post.post_id, field: 'images', oldValue: count, newValue: next.length, actor }).catch(() => {});
      if (updated) usePcsStore.setState({ post: updated });
      reseedOgPreview(post.post_id);
      logClick('pcs_react_photo_remove', { postId: post.post_id });
      toast('Photo removed', 'success');
      setLightIdx((cur) => (cur != null && cur >= next.length ? null : cur));
    } catch (err) {
      logError(err, { context: 'pcs_react_photo_remove', postId: post.post_id });
      toast('Remove failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  if (count === 0 && !canEdit) return null;

  const CompactAddTile = canEdit ? (
    <button
      onClick={() => fileInputRef.current?.click()}
      disabled={busy}
      className="flex-shrink-0 bg-bg-3 border border-dashed border-border-neutral flex flex-col items-center justify-center gap-1.5 text-text-dim cursor-pointer hover:bg-bg-2 disabled:opacity-50 self-stretch"
      style={{ width: ADD_TILE_WIDTH }}
      aria-label="Upload photo"
    >
      <Upload size={14} />
      <span className="font-mono text-2xs tracking-widest uppercase">Add</span>
    </button>
  ) : null;

  const StripAddTile = canEdit ? (
    <button
      onClick={() => fileInputRef.current?.click()}
      disabled={busy}
      className="flex-shrink-0 bg-bg-3 border border-dashed border-border-neutral flex flex-col items-center justify-center gap-1.5 text-text-dim cursor-pointer hover:bg-bg-2 disabled:opacity-50"
      style={{ width: TILE_SIZE, aspectRatio: '1 / 1' }}
      aria-label="Upload photo"
    >
      <Upload size={16} />
      <span className="font-mono text-2xs tracking-widest uppercase">Add</span>
    </button>
  ) : null;

  return (
    <div>
      <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={onPickFiles} className="hidden" />
      {count === 0 ? (
        canEdit ? (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            className="flex items-center gap-2 px-4 py-3 text-text-dim hover:text-text-mid w-full disabled:opacity-50 border-b border-divider-warm"
          >
            <ImagePlus size={15} />
            <span className="font-mono text-xs tracking-widest uppercase">Add photos</span>
          </button>
        ) : null
      ) : count === 1 ? (
        canEdit ? (
          <div className="flex gap-px overflow-x-auto scrollbar-none border-b border-divider-warm items-stretch">
            <button
              onClick={() => setLightIdx(0)}
              className="flex-shrink-0 bg-bg-2 overflow-hidden cursor-pointer block mx-auto"
              style={{ width: SINGLE_SIZE, aspectRatio: '1 / 1' }}
              aria-label="Photo 1"
            >
              <ThumbImg src={imgs[0]} />
            </button>
            {CompactAddTile}
          </div>
        ) : (
          <div className="border-b border-divider-warm">
            <button
              onClick={() => setLightIdx(0)}
              className="block mx-auto bg-bg-2 overflow-hidden cursor-pointer"
              style={{ width: SINGLE_SIZE, aspectRatio: '1 / 1' }}
              aria-label="Photo 1"
            >
              <ThumbImg src={imgs[0]} />
            </button>
          </div>
        )
      ) : (
        <>
          <div className="flex gap-px overflow-x-auto scrollbar-none">
            {imgs.map((src, i) => (
              <button
                key={i}
                onClick={() => setLightIdx(i)}
                className="flex-shrink-0 bg-bg-2 overflow-hidden cursor-pointer block"
                style={{ width: TILE_SIZE, aspectRatio: '1 / 1' }}
                aria-label={`Photo ${i + 1}`}
              >
                <ThumbImg src={src} />
              </button>
            ))}
            {StripAddTile}
          </div>
          <div className="flex items-center justify-between px-3 py-2 font-mono text-sm text-text-dim tracking-wide border-b border-divider-warm">
            <span>{count} IMAGES {'\u00B7'} HERO + {count - 1}</span>
          </div>
        </>
      )}

      {lightIdx !== null && (
        <div
          className="fixed inset-0 z-[1600] bg-black/95 flex items-center justify-center"
          onClick={() => setLightIdx(null)}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <img src={imgs[lightIdx]} alt="" className="max-w-full max-h-full object-contain" onClick={(e) => e.stopPropagation()} />
          <button onClick={(e) => { e.stopPropagation(); setLightIdx(null); }} className="absolute top-4 right-4 w-10 h-10 rounded-pill bg-black/60 text-text-loud flex items-center justify-center" aria-label="Close">
            <X size={20} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); downloadUrl(imgs[lightIdx]); }} className="absolute top-4 right-16 w-10 h-10 rounded-pill bg-black/60 text-text-loud flex items-center justify-center" aria-label="Download photo">
            <Download size={18} />
          </button>
          {imgs.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setLightIdx((i) => (i > 0 ? i - 1 : imgs.length - 1)); }}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-pill bg-black/60 text-text-loud flex items-center justify-center"
                aria-label="Previous photo"
              >
                <ChevronLeft size={24} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setLightIdx((i) => (i < imgs.length - 1 ? i + 1 : 0)); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-pill bg-black/60 text-text-loud flex items-center justify-center"
                aria-label="Next photo"
              >
                <ChevronRight size={24} />
              </button>
            </>
          )}
          {canEdit && (
            <button onClick={(e) => { e.stopPropagation(); removeAt(lightIdx); }} disabled={busy} className="absolute bottom-16 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 px-3 py-2 rounded-sm2 bg-black/60 text-red text-sm disabled:opacity-50" aria-label="Remove photo">
              <Trash2 size={14} />
              <span>Remove</span>
            </button>
          )}
          {imgs.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
              {imgs.map((_, i) => (
                <button key={i} onClick={(e) => { e.stopPropagation(); setLightIdx(i); }} className={`w-2 h-2 rounded-pill ${i === lightIdx ? 'bg-text-loud' : 'bg-white/30'}`} aria-label={`Go to photo ${i + 1}`} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
