import React, { useRef, useState } from 'react';
import { Upload, ImageOff, X, Trash2, Download } from 'lucide-react';
import { patchPost } from '../../../core/api/posts.js';
import { writeAudit } from '../../../core/api/audit.js';
import { useAppState } from '../../../core/stores/appState.js';
import { usePcsStore } from '../pcsStore.js';
import { uploadToR2 } from '../../../core/bridges/r2.js';
import { compressImage, generateFilename } from '../../../core/utils/imageCompress.js';
import { reseedOgPreview } from '../../../core/bridges/ogPreview.js';
import { toast } from '../../../core/bridges/toast.js';
import { logClick, logError } from '../../../core/bridges/logging.js';

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
  const actor = useAppState((s) => s.user?.email || '');

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

  return (
    <div className="border-b border-divider-warm">
      <div className="flex items-center justify-between px-3 pt-2.5 pb-1 font-mono text-sm text-text-dim tracking-widest uppercase">
        <span>Photos</span>
        {canEdit && (
          <button onClick={() => fileInputRef.current?.click()} disabled={busy} className="font-sans text-sm text-text-mid inline-flex items-center gap-1.5 hover:text-text-loud disabled:opacity-50">
            <Upload size={12} />
            <span>Upload</span>
            <span className="font-mono text-2xs text-text-dim px-1 py-px border border-border-neutral rounded-sm2 bg-bg">U</span>
          </button>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={onPickFiles} className="hidden" />
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
          <button onClick={(e) => { e.stopPropagation(); setLightIdx(null); }} className="absolute top-4 right-4 w-10 h-10 rounded-pill bg-black/60 text-text-loud flex items-center justify-center" aria-label="Close">
            <X size={20} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); downloadUrl(imgs[lightIdx]); }} className="absolute top-4 right-16 w-10 h-10 rounded-pill bg-black/60 text-text-loud flex items-center justify-center" aria-label="Download photo">
            <Download size={18} />
          </button>
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
