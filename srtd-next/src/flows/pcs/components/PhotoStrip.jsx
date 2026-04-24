import React, { useRef, useState } from 'react';
import { ImagePlus, ImageOff, ArrowLeft, ArrowRight, Maximize2 } from 'lucide-react';
import { Lightbox, PhotoKebabMenu } from '../../../core/ui';
import { patchPost } from '../../../core/api/posts.js';
import { writeAudit } from '../../../core/api/audit.js';
import { useAppState, useIsClient } from '../../../core/stores/appState.js';
import { usePcsStore } from '../pcsStore.js';
import { uploadToR2 } from '../../../core/bridges/r2.js';
import { compressImage, generateFilename } from '../../../core/utils/imageCompress.js';
import { reseedOgPreview } from '../../../core/bridges/ogPreview.js';
import { toast } from '../../../core/bridges/toast.js';
import { logClick, logError } from '../../../core/bridges/logging.js';

const MAX_IMAGES = 20;
const MAX_FILE_MB = 12;

function normalizeImages(images) {
  if (!images) return [];
  if (Array.isArray(images)) return images.filter(Boolean);
  if (typeof images === 'object' && Array.isArray(images.urls)) {
    return images.urls.filter(Boolean);
  }
  return [];
}

function ThumbImg({ src, onLoad }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="w-full h-full flex flex-col items-center
                      justify-center gap-1 text-text-dim font-mono
                      text-sm tracking-wide uppercase border
                      border-dashed border-border-neutral">
        <ImageOff size={18} />
        <span>Failed to load</span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      onError={() => setFailed(true)}
      onLoad={onLoad}
      className="w-full h-full object-cover block"
    />
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
  const actor = useAppState((s) => s.user?.email || '');
  const isClient = useIsClient();

  const [lightIdx, setLightIdx] = useState(null);
  const [reorderOpen, setReorderOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [scrollIdx, setScrollIdx] = useState(0);
  const fileInputRef = useRef(null);
  const scrollRef = useRef(null);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const w = el.offsetWidth || 1;
    const next = Math.round(el.scrollLeft / w);
    if (next !== scrollIdx) setScrollIdx(next);
  }

  async function onPickFiles(e) {
    const rawFiles = Array.from(e.target.files || []);
    e.target.value = '';
    if (!rawFiles.length || !post?.post_id || busy) return;

    // Cap + size guard
    const remaining = MAX_IMAGES - count;
    if (remaining <= 0) {
      toast(`Maximum ${MAX_IMAGES} photos reached`, 'warning');
      return;
    }
    const files = rawFiles.slice(0, remaining);
    if (rawFiles.length > remaining) {
      toast(
        `Only ${remaining} photo${remaining === 1 ? '' : 's'} added; ${MAX_IMAGES}-photo cap`,
        'warning'
      );
    }
    for (const f of files) {
      if (f.size > MAX_FILE_MB * 1024 * 1024) {
        toast(`${f.name} exceeds ${MAX_FILE_MB}MB`, 'error');
        return;
      }
    }

    setBusy(true);
    setUploadProgress({ current: 0, total: files.length });

    try {
      const urls = [];
      let i = 0;
      for (const f of files) {
        i += 1;
        setUploadProgress({ current: i, total: files.length });
        const blob = await compressImage(f, { maxDim: 1200, quality: 0.82 });
        const filename = generateFilename('jpg', post.post_id);
        const url = await uploadToR2(filename, blob);
        urls.push(url);
      }
      const next = [...imgs, ...urls];
      const updated = await patchPost(post.post_id, {
        images: next,
        updated_by: actor,
      });
      try {
        await writeAudit({
          postId: post.post_id,
          field: 'images',
          oldValue: count,
          newValue: next.length,
          actor,
        });
      } catch (err) {
        logError(err, { context: 'pcs_react_photo_audit' });
      }
      if (updated) usePcsStore.setState({ post: updated });
      reseedOgPreview(post.post_id);
      logClick('pcs_react_photo_upload', {
        postId: post.post_id,
        added: urls.length,
      });
      toast(
        `Uploaded ${urls.length} photo${urls.length === 1 ? '' : 's'}`,
        'success'
      );
    } catch (err) {
      logError(err, {
        context: 'pcs_react_photo_upload',
        postId: post.post_id,
      });
      toast('Photo upload failed', 'error');
    } finally {
      setBusy(false);
      setUploadProgress(null);
    }
  }

  async function applyImagesPatch(nextImages, auditField = 'images') {
    try {
      const updated = await patchPost(post.post_id, {
        images: nextImages,
        updated_by: actor,
      });
      try {
        await writeAudit({
          postId: post.post_id,
          field: auditField,
          oldValue: imgs,
          newValue: nextImages,
          actor,
        });
      } catch (err) {
        logError(err, { context: 'pcs_react_photo_audit' });
      }
      if (updated) usePcsStore.setState({ post: updated });
      reseedOgPreview(post.post_id);
      return true;
    } catch (err) {
      logError(err, {
        context: 'pcs_react_photo_patch',
        postId: post.post_id,
        field: auditField,
      });
      toast('Save failed', 'error');
      return false;
    }
  }

  async function removeAt(idx) {
    if (!post?.post_id || busy) return;
    if (!window.confirm('Remove this photo?')) return;
    setBusy(true);
    const next = imgs.slice(0, idx).concat(imgs.slice(idx + 1));
    const ok = await applyImagesPatch(next, 'images');
    if (ok) {
      logClick('pcs_react_photo_remove', { postId: post.post_id });
      toast('Photo removed', 'success');
      setLightIdx((cur) => (cur != null && cur >= next.length ? null : cur));
    }
    setBusy(false);
  }

  async function setAsHero(idx) {
    if (!post?.post_id || busy) return;
    if (idx === 0) return;
    setBusy(true);
    const next = [imgs[idx], ...imgs.slice(0, idx), ...imgs.slice(idx + 1)];
    const ok = await applyImagesPatch(next, 'hero');
    if (ok) {
      logClick('pcs_react_photo_sethero', { postId: post.post_id });
      toast('Hero updated', 'success');
      setLightIdx(0);
    }
    setBusy(false);
  }

  function openLightbox(i) {
    setLightIdx(i);
  }

  // Empty state
  if (count === 0) {
    if (!canEdit) return null;
    return (
      <div className="border-b border-divider-subtle">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={onPickFiles}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
          className="flex items-center gap-2 px-4 py-3 text-text-dim
                     hover:text-text-mid w-full disabled:opacity-50"
        >
          <ImagePlus size={15} />
          <span className="font-mono text-xs tracking-widest uppercase">
            Add photos
          </span>
        </button>
      </div>
    );
  }

  const current = Math.max(0, Math.min(scrollIdx, count - 1));

  return (
    <div className="relative">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={onPickFiles}
        className="hidden"
      />

      {/* Horizontal snap scroll */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex overflow-x-auto scrollbar-none"
        style={{
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {imgs.map((src, i) => (
          <div
            key={`${src}-${i}`}
            className="relative flex-shrink-0 bg-bg-2"
            style={{
              width: '100%',
              aspectRatio: '1 / 1',
              scrollSnapAlign: 'start',
            }}
          >
            <button
              onClick={() => openLightbox(i)}
              className="w-full h-full block"
              aria-label={`Photo ${i + 1} of ${count}`}
            >
              <ThumbImg src={src} />
            </button>

            {/* Top-right cluster: count badge + expand pill + kebab */}
            <div
              className="absolute top-3 right-3 flex items-center gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              {count > 1 ? (
                <div
                  className="font-mono text-xs tracking-widest uppercase
                             px-2.5 py-1 rounded-pill"
                  style={{
                    background: 'rgba(0,0,0,0.55)',
                    color: '#F4F3EE',
                    fontFeatureSettings: "'tnum' 1",
                  }}
                >
                  {i + 1} / {count}
                </div>
              ) : null}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openLightbox(i);
                }}
                className="inline-flex items-center justify-center
                           w-8 h-8 rounded-pill"
                style={{
                  background: 'rgba(0,0,0,0.55)',
                  color: '#F4F3EE',
                }}
                aria-label="Expand photo"
              >
                <Maximize2 size={14} />
              </button>
              {canEdit && !isClient ? (
                <PhotoKebabMenu
                  context="card"
                  canSetHero={i !== 0}
                  canReorder={count > 1}
                  onAdd={() => fileInputRef.current?.click()}
                  onSetHero={() => setAsHero(i)}
                  onReorder={() => {
                    openLightbox(i);
                    setReorderOpen(true);
                  }}
                  onDownload={() => downloadUrl(src)}
                  onRemove={() => removeAt(i)}
                />
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {/* Upload progress overlay */}
      {uploadProgress ? (
        <div
          className="absolute left-0 right-0 top-0 flex items-center
                     justify-center font-mono text-xs tracking-widest
                     uppercase"
          style={{
            bottom: 0,
            background: 'rgba(0,0,0,0.6)',
            color: '#F4F3EE',
            zIndex: 5,
          }}
        >
          Uploading {uploadProgress.current} / {uploadProgress.total}
        </div>
      ) : null}

      {/* Lightbox */}
      {lightIdx !== null && !reorderOpen ? (
        <Lightbox
          urls={imgs}
          startIndex={lightIdx}
          onClose={() => setLightIdx(null)}
          onIndexChange={(i) => setLightIdx(i)}
          topRightSlot={
            canEdit && !isClient ? (
              <PhotoKebabMenu
                context="lightbox"
                canSetHero={lightIdx !== 0}
                canReorder={count > 1}
                onAdd={() => fileInputRef.current?.click()}
                onSetHero={() => setAsHero(lightIdx)}
                onReorder={() => setReorderOpen(true)}
                onDownload={() => downloadUrl(imgs[lightIdx])}
                onRemove={() => removeAt(lightIdx)}
              />
            ) : null
          }
        />
      ) : null}

      {/* Reorder mode */}
      {reorderOpen && canEdit ? (
        <ReorderMode
          imgs={imgs}
          post={post}
          actor={actor}
          onClose={() => {
            setReorderOpen(false);
            setLightIdx(null);
          }}
        />
      ) : null}
    </div>
  );
}

/* ---------- ReorderMode (colocated in PhotoStrip.jsx) ---------- */

function ReorderMode({ imgs, post, actor, onClose }) {
  const [order, setOrder] = useState(imgs);
  const [busy, setBusy] = useState(false);

  function move(idx, direction) {
    const target = idx + direction;
    if (target < 0 || target >= order.length) return;
    const next = order.slice();
    const tmp = next[idx];
    next[idx] = next[target];
    next[target] = tmp;
    setOrder(next);
  }

  function removeTile(idx) {
    if (!window.confirm('Remove this photo?')) return;
    setOrder(order.slice(0, idx).concat(order.slice(idx + 1)));
  }

  async function commit() {
    if (busy) return;
    const changed = order.length !== imgs.length ||
      order.some((u, i) => u !== imgs[i]);
    if (!changed) { onClose(); return; }
    setBusy(true);
    try {
      const updated = await patchPost(post.post_id, {
        images: order,
        updated_by: actor,
      });
      try {
        await writeAudit({
          postId: post.post_id,
          field: 'reorder',
          oldValue: imgs,
          newValue: order,
          actor,
        });
      } catch (err) {
        logError(err, { context: 'pcs_react_photo_reorder_audit' });
      }
      if (updated) usePcsStore.setState({ post: updated });
      reseedOgPreview(post.post_id);
      logClick('pcs_react_photo_reorder', { postId: post.post_id });
      toast('Order saved', 'success');
      onClose();
    } catch (err) {
      logError(err, { context: 'pcs_react_photo_reorder' });
      toast('Save failed', 'error');
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 overflow-y-auto"
      style={{
        zIndex: 1601,
        background: '#1A1816',
        color: '#F4F3EE',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {/* Header */}
      <div
        className="sticky top-0 flex items-center justify-between
                   px-4 border-b"
        style={{
          height: 48,
          background: '#1A1816',
          borderColor: 'rgba(255,255,255,0.1)',
          zIndex: 2,
        }}
      >
        <button
          onClick={onClose}
          className="font-mono text-sm tracking-widest uppercase"
          style={{ color: '#B1ADA1' }}
        >
          Cancel
        </button>
        <div
          className="font-mono text-sm tracking-widest uppercase"
          style={{ color: '#F4F3EE' }}
        >
          Reorder
        </div>
        <button
          onClick={commit}
          disabled={busy}
          className="font-mono text-sm tracking-widest uppercase px-3 py-1
                     rounded-sm2 disabled:opacity-50"
          style={{ background: '#C15F3C', color: '#F4F3EE' }}
        >
          Done
        </button>
      </div>

      {/* Helper copy */}
      <div
        className="px-4 py-3 font-mono text-xs tracking-widest uppercase"
        style={{ color: '#7A7670' }}
      >
        Tap arrows to reorder {'·'} Tap {'×'} to remove
      </div>

      {/* Tile list */}
      <div className="px-4 pb-6 flex flex-col gap-3">
        {order.map((src, i) => (
          <div
            key={`${src}-${i}`}
            className="relative rounded-card overflow-hidden"
            style={{
              background: '#252320',
              aspectRatio: '16 / 9',
            }}
          >
            <img
              src={src}
              alt=""
              className="w-full h-full"
              style={{ objectFit: 'cover' }}
            />

            {/* Hero badge */}
            {i === 0 ? (
              <div
                className="absolute top-2 left-2 font-mono text-xs
                           tracking-widest uppercase px-2 py-0.5
                           rounded-pill inline-flex items-center gap-1"
                style={{
                  background: 'rgba(0,0,0,0.55)',
                  color: '#F4F3EE',
                }}
              >
                {'★'} HERO
              </div>
            ) : null}

            {/* Remove */}
            <button
              onClick={() => removeTile(i)}
              className="absolute top-2 right-2 w-8 h-8 rounded-pill
                         inline-flex items-center justify-center"
              style={{
                background: 'rgba(0,0,0,0.55)',
                color: '#F4F3EE',
              }}
              aria-label="Remove photo"
            >
              {'×'}
            </button>

            {/* Arrows */}
            <div
              className="absolute bottom-2 left-1/2 flex items-center gap-2"
              style={{ transform: 'translateX(-50%)' }}
            >
              <button
                onClick={() => move(i, -1)}
                disabled={i === 0}
                className="w-9 h-9 rounded-pill inline-flex items-center
                           justify-center disabled:opacity-30"
                style={{
                  background: 'rgba(0,0,0,0.55)',
                  color: '#F4F3EE',
                }}
                aria-label="Move up"
              >
                <ArrowLeft size={16} />
              </button>
              <button
                onClick={() => move(i, 1)}
                disabled={i === order.length - 1}
                className="w-9 h-9 rounded-pill inline-flex items-center
                           justify-center disabled:opacity-30"
                style={{
                  background: 'rgba(0,0,0,0.55)',
                  color: '#F4F3EE',
                }}
                aria-label="Move down"
              >
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        ))}

        {order.length === 0 ? (
          <div
            className="text-center py-8 font-sans"
            style={{ color: '#7A7670' }}
          >
            No photos left. Tap Done to save.
          </div>
        ) : null}
      </div>
    </div>
  );
}
