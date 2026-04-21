import React, { useState, useRef, useLayoutEffect, useEffect } from 'react';
import { ChevronDown, Sparkles, ShieldCheck } from 'lucide-react';
import { EditIcon } from '../../../core/ui/index.js';
import { wordCount, renderRichText } from '../utils/mentions.jsx';
import { usePcsStore } from '../pcsStore.js';
import { patchPost } from '../../../core/api/posts.js';
import { writeAudit } from '../../../core/api/audit.js';
import { toast } from '../../../core/bridges/toast.js';
import { logClick, logError } from '../../../core/bridges/logging.js';
import { openCaptionWorkspace } from '../../../core/bridges/captionWorkspace.js';

const OVER_WORD_THRESHOLD = 125;
const LONG_PRESS_MS = 500;

export function CaptionBlock({ post, canEdit, isAdmin }) {
  const caption = post?.caption || '';
  const wc = wordCount(caption);
  const over = wc > OVER_WORD_THRESHOLD;
  const isEmpty = !caption.trim();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(caption);
  const [showFull, setShowFull] = useState(false);
  const [overflows, setOverflows] = useState(false);

  const bodyRef = useRef(null);
  const textareaRef = useRef(null);
  const lpTimer = useRef(null);

  // Measure caption overflow after render.
  useLayoutEffect(() => {
    if (editing || isEmpty) { setOverflows(false); return; }
    const el = bodyRef.current;
    if (!el) return;
    if (!showFull) {
      setOverflows(el.scrollHeight > el.clientHeight + 1);
    } else {
      // Keep chevron visible when expanded so user can re-collapse.
      setOverflows(true);
    }
  }, [caption, showFull, editing, isEmpty]);

  // Reset draft + clamp when post changes.
  useEffect(() => {
    setDraft(caption);
    setShowFull(false);
  }, [post?.post_id]);

  function startEdit() {
    if (!canEdit) return;
    setDraft(caption);
    setEditing(true);
    setTimeout(() => textareaRef.current && textareaRef.current.focus(), 50);
  }

  function cancelEdit() {
    setEditing(false);
    setDraft(caption);
  }

  async function applyCaption(next) {
    const isTransientNetworkError = (err) => {
      const msg = (err && err.message) || '';
      return /^Load failed$/i.test(msg)
          || /^NetworkError/i.test(msg)
          || /^Failed to fetch/i.test(msg);
    };
    try {
      let updated;
      try {
        updated = await patchPost(post.post_id, {
          caption: next, updated_by: post?.updated_by || null,
        });
      } catch (err) {
        if (!isTransientNetworkError(err)) throw err;
        await new Promise((r) => setTimeout(r, 800));
        updated = await patchPost(post.post_id, {
          caption: next, updated_by: post?.updated_by || null,
        });
      }
      writeAudit({
        postId: post.post_id, field: 'caption',
        oldValue: caption, newValue: next,
        actor: post?.updated_by || null,
      }).catch(() => {});
      if (updated) usePcsStore.setState({ post: updated });
      logClick('pcs_react_caption_save', { len: (next || '').length });
      toast('Caption saved', 'success');
    } catch (err) {
      logError(err, { context: 'pcs_react_caption_save' });
      toast(
        isTransientNetworkError(err) ? 'Network blip, please try again' : 'Save failed',
        'error'
      );
    }
  }

  async function handleSave() {
    const next = draft.trim();
    setEditing(false);
    if (next === caption) return;
    await applyCaption(next);
  }

  function onClaude() {
    if (!isAdmin) return;
    logClick('pcs_react_caption_claude', {});
    const syntheticContext = {
      caption, title: post?.title, pillar: post?.content_pillar,
      location: post?.location, format: post?.format, source: 'pcs',
    };
    openCaptionWorkspace('write', {
      postId: post.post_id,
      initialCaption: caption,
      syntheticContext,
      onUse: (next) => applyCaption(next),
    });
  }

  function onQc() {
    if (!isAdmin) return;
    logClick('pcs_react_caption_qc', {});
    const syntheticContext = {
      caption, title: post?.title, pillar: post?.content_pillar,
      location: post?.location, format: post?.format, source: 'pcs',
    };
    openCaptionWorkspace('qc', {
      postId: post.post_id,
      initialCaption: caption,
      syntheticContext,
      onUse: (next) => applyCaption(next),
    });
  }

  // Long-press body to enter edit mode.
  function startLP(e) {
    if (!canEdit) return;
    if (e.target.closest('button, a, input, textarea')) return;
    lpTimer.current = setTimeout(() => {
      try { if (navigator.vibrate) navigator.vibrate(12); } catch (err) {}
      startEdit();
    }, LONG_PRESS_MS);
  }
  function cancelLP() {
    if (lpTimer.current) { clearTimeout(lpTimer.current); lpTimer.current = null; }
  }

  // Empty state
  if (isEmpty && !editing) {
    return (
      <div className="px-4 py-3 border-b border-divider-subtle">
        <button
          onClick={startEdit}
          disabled={!canEdit}
          className="font-sans text-lg text-text-dim italic text-left disabled:cursor-default"
        >
          {canEdit ? 'Add caption…' : 'No caption yet'}
        </button>
      </div>
    );
  }

  // Edit mode
  if (editing) {
    return (
      <div className="px-4 pt-2 pb-3 border-b border-divider-subtle">
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="w-full min-h-[140px] bg-bg-draft border border-border-warm rounded-card p-3 font-sans text-lg leading-relaxed text-text-loud outline-none resize-none"
          style={{ lineHeight: '1.6' }}
        />
        <div className="flex items-center justify-between pt-2">
          <div
            className="font-mono text-sm tracking-widest uppercase"
            style={{ fontFeatureSettings: "'tnum' 1" }}
          >
            <span className={wordCount(draft) > OVER_WORD_THRESHOLD ? 'text-red' : 'text-text-dim'}>
              {wordCount(draft)} WORDS
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={cancelEdit}
              className="font-sans text-base text-text-soft px-2 py-1 hover:text-text-loud"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="font-sans text-base font-medium bg-terracotta-grad text-text-loud px-3 py-1 rounded-sm2"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Display mode
  return (
    <div className="px-4">
      <div
        ref={bodyRef}
        onTouchStart={startLP}
        onTouchEnd={cancelLP}
        onTouchMove={cancelLP}
        onMouseDown={startLP}
        onMouseUp={cancelLP}
        onMouseLeave={cancelLP}
        onContextMenu={(e) => { e.preventDefault(); }}
        className={`font-sans text-lg text-text-loud whitespace-pre-wrap ${!showFull && overflows ? 'caption-clamp-6 caption-fade-bottom' : ''}`}
        style={{ lineHeight: '1.6' }}
      >
        {renderRichText(caption)}
      </div>

      <div className="flex items-center justify-between py-2.5 mt-2.5 border-t border-b border-divider-subtle">
        <div
          className="font-mono text-sm tracking-widest uppercase"
          style={{ fontFeatureSettings: "'tnum' 1" }}
        >
          <span className={over ? 'text-red' : 'text-text-dim'}>
            {wc} WORDS
          </span>
        </div>

        <div className="flex items-center gap-0">
          {overflows ? (
            <button
              onClick={() => setShowFull((v) => !v)}
              className="w-8 h-8 inline-flex items-center justify-center rounded-sm2 text-text-mid hover:text-text-loud active:bg-bg-2 active:scale-[0.96]"
              style={{ transition: 'background 0.08s ease, color 0.1s ease, transform 0.08s ease' }}
              aria-label={showFull ? 'Show less' : 'Show more'}
            >
              <ChevronDown
                size={14}
                strokeWidth={1.75}
                style={{
                  transform: showFull ? 'rotate(180deg)' : 'rotate(0)',
                  transition: 'transform 0.22s cubic-bezier(0.2, 0, 0.1, 1)',
                }}
              />
            </button>
          ) : null}

          {canEdit ? (
            <button
              onClick={startEdit}
              className="w-8 h-8 inline-flex items-center justify-center rounded-sm2 text-text-mid hover:text-text-loud active:bg-bg-2 active:scale-[0.96]"
              style={{ transition: 'background 0.08s ease, color 0.1s ease, transform 0.08s ease' }}
              aria-label="Edit caption"
            >
              <EditIcon size={14} />
            </button>
          ) : null}

          {isAdmin ? (
            <>
              <button
                onClick={onClaude}
                className="w-8 h-8 inline-flex items-center justify-center rounded-sm2 text-text-mid hover:text-text-loud active:bg-bg-2 active:scale-[0.96]"
                style={{ transition: 'background 0.08s ease, color 0.1s ease, transform 0.08s ease' }}
                aria-label="Rewrite with Claude"
              >
                <Sparkles size={14} strokeWidth={1.75} />
              </button>
              <button
                onClick={onQc}
                className="w-8 h-8 inline-flex items-center justify-center rounded-sm2 text-text-mid hover:text-text-loud active:bg-bg-2 active:scale-[0.96]"
                style={{ transition: 'background 0.08s ease, color 0.1s ease, transform 0.08s ease' }}
                aria-label="Quality check"
              >
                <ShieldCheck size={14} strokeWidth={1.75} />
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
