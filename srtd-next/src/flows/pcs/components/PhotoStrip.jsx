import React, { useEffect, useRef, useState } from 'react';
import { ImagePlus, ImageOff, ArrowLeft, ArrowRight } from 'lucide-react';
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
      draggable={false}
      onError={() => setFailed(true)}
      onLoad={onLoad}
      onDragStart={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
      className="w-full h-full object-cover block"
      style={{
        pointerEvents: 'none',
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        WebkitUserDrag: 'none',
      }}
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

  const comments = usePcsStore((s) => s.comments);
  const internalNotes = usePcsStore((s) => s.internalNotes);
  const flashCommentId = usePcsStore((s) => s.flashCommentId);
  const flashComment = usePcsStore((s) => s.flashComment);
  const carouselScrollRequested = usePcsStore((s) => s.carouselScrollRequested);
  const carouselScrollTarget = usePcsStore((s) => s.carouselScrollTarget);
  const pendingAnchor = usePcsStore((s) => s.pendingAnchor);
  const lastSeenScroll = useRef(carouselScrollRequested);

  const [lightIdx, setLightIdx] = useState(null);
  const [reorderOpen, setReorderOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [scrollIdx, setScrollIdx] = useState(0);
  const [dotsActive, setDotsActive] = useState(true);
  const fileInputRef = useRef(null);
  const scrollRef = useRef(null);
  const fadeTimer = useRef(null);

  // Photo anchors: non-resolved, non-deleted, with a numeric image_index.
  const photoAnchors = React.useMemo(() => {
    const all = [...(Array.isArray(comments) ? comments : []), ...(Array.isArray(internalNotes) ? internalNotes : [])];
    const list = [];
    for (const c of all) {
      if (!c) continue;
      if (c.resolved) continue;
      if (c.deleted) continue;
      if (c.anchor_type !== 'photo') continue;
      const p = c.anchor_payload || null;
      if (!p) continue;
      const ii = typeof p.image_index === 'number' ? p.image_index : -1;
      const xp = typeof p.x_pct === 'number' ? p.x_pct : null;
      const yp = typeof p.y_pct === 'number' ? p.y_pct : null;
      if (ii < 0 || xp == null || yp == null) continue;
      list.push({ id: c.id, image_index: ii, x_pct: xp, y_pct: yp });
    }
    return list;
  }, [comments, internalNotes]);

  function focusComment(id) {
    flashComment(id);
    try {
      const row = document.querySelector(`[data-comment-row-id="${id}"]`);
      if (row && typeof row.scrollIntoView === 'function') {
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } catch (e) { /* noop */ }
    setTimeout(() => {
      try { flashComment(null); } catch (e) {}
    }, 1600);
  }

  // External carousel scroll trigger (anchor badge in CommentRow).
  useEffect(() => {
    if (carouselScrollRequested === lastSeenScroll.current) return;
    lastSeenScroll.current = carouselScrollRequested;
    const el = scrollRef.current;
    if (!el) return;
    const target = Math.max(0, Math.min(carouselScrollTarget, count - 1));
    const w = el.offsetWidth || 1;
    try { el.scrollTo({ left: target * w, behavior: 'smooth' }); } catch (e) { el.scrollLeft = target * w; }
  }, [carouselScrollRequested, carouselScrollTarget, count]);

  // Capture an anchor at (x_pct, y_pct) on the active image. Used by
  // both the carousel image button (via onTapCapture) and the Lightbox
  // imageOverlay tap-layer.
  function captureAnchorAt(rect, clientX, clientY, imageIndex) {
    if (!rect || rect.width <= 0 || rect.height <= 0) return;
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    const x_pct = Math.max(0, Math.min(100, Math.round(x * 10) / 10));
    const y_pct = Math.max(0, Math.min(100, Math.round(y * 10) / 10));
    try {
      usePcsStore.getState().requestAnchor({
        type: 'photo',
        image_index: imageIndex,
        x_pct,
        y_pct,
      });
      logClick('pcs_react_anchor_photo_capture', {
        image_index: imageIndex,
        x_pct: Math.round(x_pct),
        y_pct: Math.round(y_pct),
      });
    } catch (e) { /* noop */ }
  }

  function pingDots() {
    if (fadeTimer.current) clearTimeout(fadeTimer.current);
    setDotsActive(true);
    fadeTimer.current = setTimeout(() => setDotsActive(false), 4000);
  }

  useEffect(() => {
    pingDots();
    return () => {
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
    };
  }, [scrollIdx, post?.post_id]);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const w = el.offsetWidth || 1;
    const next = Math.round(el.scrollLeft / w);
    if (next !== scrollIdx) setScrollIdx(next);
  }

  function onTouchStart() {
    pingDots();
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

  function dotsForIndex(i) {
    return photoAnchors.filter((a) => a.image_index === i);
  }

  // Tap-to-anchor over the active image, used inside Lightbox via the
  // imageOverlay render prop. The img has pointer-events:none so this
  // overlay div captures every tap; % coords are derived from its rect
  // so they stay correct regardless of objectFit:contain bars. Draft
  // pin is draggable to fine-tune before sending.
  function lightboxImageOverlay(activeIdx) {
    const dots = dotsForIndex(activeIdx);
    const draft = pendingAnchor && pendingAnchor.type === 'photo' && pendingAnchor.image_index === activeIdx
      ? pendingAnchor : null;

    function onOverlayClick(e) {
      if (e.target !== e.currentTarget) return;
      const rect = e.currentTarget.getBoundingClientRect();
      captureAnchorAt(rect, e.clientX, e.clientY, activeIdx);
    }

    function onDraftPointerDown(e) {
      e.stopPropagation();
      e.preventDefault();
      const pin = e.currentTarget;
      const overlay = pin.parentElement;
      if (!overlay) return;
      const rect = overlay.getBoundingClientRect();
      try { pin.setPointerCapture(e.pointerId); } catch (_) {}
      function clamp(v) { return Math.max(0, Math.min(100, Math.round(v * 10) / 10)); }
      function move(ev) {
        ev.preventDefault();
        const x = ((ev.clientX - rect.left) / rect.width) * 100;
        const y = ((ev.clientY - rect.top) / rect.height) * 100;
        try {
          usePcsStore.getState().updatePendingAnchor({ x_pct: clamp(x), y_pct: clamp(y) });
        } catch (_) {}
      }
      function up(ev) {
        try { pin.releasePointerCapture(ev.pointerId); } catch (_) {}
        pin.removeEventListener('pointermove', move);
        pin.removeEventListener('pointerup', up);
        pin.removeEventListener('pointercancel', up);
      }
      pin.addEventListener('pointermove', move);
      pin.addEventListener('pointerup', up);
      pin.addEventListener('pointercancel', up);
    }

    return (
      <div
        className="absolute inset-0"
        style={{ zIndex: 3, pointerEvents: 'none' }}
      >
        <div
          className="absolute inset-0"
          style={{ pointerEvents: 'auto' }}
          onClick={onOverlayClick}
          onContextMenu={(e) => e.preventDefault()}
          onDragStart={(e) => e.preventDefault()}
        >
          {dots.map((d) => {
            const isFlash = flashCommentId === d.id;
            return (
              <button
                key={d.id}
                type="button"
                className={`anchor-photo-dot${isFlash ? ' is-flashing' : ''}`}
                style={{ left: `${d.x_pct}%`, top: `${d.y_pct}%` }}
                onClick={(e) => { e.stopPropagation(); focusComment(d.id); }}
                aria-label="Open anchored comment"
              />
            );
          })}
          {draft ? (
            <div
              className="anchor-photo-dot is-draft"
              style={{ left: `${draft.x_pct}%`, top: `${draft.y_pct}%`, touchAction: 'none' }}
              onPointerDown={onDraftPointerDown}
              onClick={(e) => e.stopPropagation()}
              onContextMenu={(e) => e.preventDefault()}
              aria-label="Draft anchor pin (drag to adjust)"
            >
              <span className="anchor-photo-dot-plus" aria-hidden="true">+</span>
            </div>
          ) : null}
        </div>
      </div>
    );
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
        onTouchStart={onTouchStart}
        className="flex overflow-x-auto scrollbar-none"
        style={{
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {imgs.map((src, i) => {
          const dots = dotsForIndex(i);
          return (
            <div
              key={`${src}-${i}`}
              className={`relative flex-shrink-0 bg-bg-2 ${isClient ? 'aspect-square' : ''}`}
              style={{
                width: '100%',
                ...(isClient ? {} : { aspectRatio: '1 / 1' }),
                scrollSnapAlign: 'start',
              }}
            >
              <button
                onClick={() => openLightbox(i)}
                onContextMenu={(e) => e.preventDefault()}
                onDragStart={(e) => e.preventDefault()}
                className="w-full h-full block"
                style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
                aria-label={`Photo ${i + 1} of ${count}`}
              >
                <ThumbImg src={src} />
              </button>
              {dots.length > 0 ? (
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{ zIndex: 3 }}
                  aria-hidden="true"
                >
                  {dots.map((d) => {
                    const isFlash = flashCommentId === d.id;
                    return (
                      <button
                        key={d.id}
                        type="button"
                        className={`anchor-photo-dot${isFlash ? ' is-flashing' : ''}`}
                        style={{ left: `${d.x_pct}%`, top: `${d.y_pct}%` }}
                        onClick={(e) => { e.stopPropagation(); focusComment(d.id); }}
                        aria-label="Open anchored comment"
                      />
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <CarouselDots count={count} current={current} active={dotsActive} />

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
          imageOverlay={lightboxImageOverlay}
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

/* ---------- CarouselDots (iOS Photos windowing pattern) ---------- */

const DOT_WINDOW = 5;

function CarouselDots({ count, current, active }) {
  if (!count || count <= 1) return null;
  const windowSize = Math.min(DOT_WINDOW, count);
  // Center-shift window: keep active in middle when possible.
  let start = current - Math.floor(windowSize / 2);
  if (start < 0) start = 0;
  if (start + windowSize > count) start = count - windowSize;

  const slots = [];
  for (let i = 0; i < windowSize; i += 1) {
    const dotIndex = start + i;
    const isActive = dotIndex === current;
    // Edge shrink: only when there are more dots beyond the visible window.
    const isEdgeShrink =
      count > DOT_WINDOW &&
      ((i === 0 && start > 0) ||
        (i === windowSize - 1 && start + windowSize < count));
    slots.push({ key: dotIndex, isActive, isEdgeShrink });
  }

  return (
    <div
      className="pointer-events-none absolute left-1/2 flex items-center justify-center"
      style={{
        bottom: 14,
        transform: 'translateX(-50%)',
        gap: 6,
        opacity: active ? 1 : 0.4,
        transition: 'opacity 200ms ease',
        filter: 'drop-shadow(0 1px 2px var(--c-dot-shadow))',
        zIndex: 4,
      }}
      aria-hidden="true"
    >
      {slots.map(({ key, isActive, isEdgeShrink }) => {
        const w = isActive ? 18 : isEdgeShrink ? 4 : 6;
        const h = isActive ? 6 : isEdgeShrink ? 4 : 6;
        const r = isActive ? 3 : '50%';
        return (
          <span
            key={key}
            style={{
              display: 'inline-block',
              width: w,
              height: h,
              borderRadius: r,
              background: isActive
                ? 'var(--c-dot-active)'
                : 'var(--c-dot-idle)',
              transition:
                'width 180ms ease, height 180ms ease, border-radius 180ms ease',
            }}
          />
        );
      })}
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
