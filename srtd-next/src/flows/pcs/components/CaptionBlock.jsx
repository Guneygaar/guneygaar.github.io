import React, { useState, useRef, useLayoutEffect, useEffect } from 'react';
import { ChevronDown, Sparkles, ShieldCheck, Copy } from 'lucide-react';
import { EditIcon } from '../../../core/ui/index.js';
import { wordCount, renderRichText } from '../utils/mentions.jsx';
import { usePcsStore } from '../pcsStore.js';
import { logClick } from '../../../core/bridges/logging.js';
import { openCaptionWorkspace } from '../../../core/bridges/captionWorkspace.js';
import { useIsClient, useAppState } from '../../../core/stores/appState.js';
import { useOptimisticPatch } from '../../../core/hooks/useOptimisticPatch.js';
import { reseedOgPreview } from '../../../core/bridges/ogPreview.js';
import { useLongPress } from '../../plan/hooks/useLongPress.js';
import { toast } from '../../../core/bridges/toast.js';

const TEXTAREA_MAX_HEIGHT = 400;
const GREEN_TOKEN = '#7DBE8A';

function wordStateOf(n) {
  if (n === 0) return 'default';
  if (n >= 80 && n <= 100) return 'green';
  if (n > 100 && n <= 125) return 'amber';
  if (n > 125) return 'red';
  return 'default';
}

function wordStateClass(state) {
  if (state === 'amber') return 'text-amber';
  if (state === 'red') return 'text-red';
  return 'text-text-dim';
}

export function CaptionBlock({ post, canEdit, isAdmin }) {
  const isClient = useIsClient();
  const userEmail = useAppState((s) => s.user?.email || '');
  const caption = post?.caption || '';
  const wc = wordCount(caption);
  const wcState = wordStateOf(wc);
  const isEmpty = !caption.trim();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(caption);
  const [showFull, setShowFull] = useState(false);
  const [overflows, setOverflows] = useState(false);

  const bodyRef = useRef(null);
  const textareaRef = useRef(null);
  const captionEditRequested = usePcsStore((s) => s.captionEditRequested);
  const lastSeenEditRequest = useRef(captionEditRequested);
  const { commit } = useOptimisticPatch();

  const copyLongPress = useLongPress({
    enabled: !!canEdit,
    threshold: 500,
    onLongPress: () => {
      try { usePcsStore.getState().requestCaptionEdit(); } catch (e) { /* noop */ }
    },
  });

  async function copyCaption() {
    const text = post?.caption || '';
    let ok = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        ok = true;
      }
    } catch (e) { /* fall through */ }
    if (!ok) {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.top = '-1000px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      } catch (e) { /* noop */ }
    }
    try { logClick('pcs_react_caption_copy', { len: text.length }); } catch (e) {}
    toast('Copied', 'success');
  }

  function handleCopyClick(e) {
    if (copyLongPress.onClick) {
      copyLongPress.onClick(e);
      if (e.defaultPrevented) return;
    }
    copyCaption();
  }

  // Measure caption overflow after render.
  useLayoutEffect(() => {
    if (editing || isEmpty) { setOverflows(false); return; }
    const el = bodyRef.current;
    if (!el) return;
    if (!showFull) {
      setOverflows(el.scrollHeight > el.clientHeight + 1);
    } else {
      setOverflows(true);
    }
  }, [caption, showFull, editing, isEmpty]);

  // Auto-grow textarea to content up to 400px, then scroll.
  useLayoutEffect(() => {
    if (!editing) return;
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, TEXTAREA_MAX_HEIGHT) + 'px';
  }, [editing, draft]);

  // Reset draft + clamp when post changes.
  useEffect(() => {
    setDraft(caption);
    setShowFull(false);
  }, [post?.post_id]);

  // External edit trigger from Copy long-press.
  useEffect(() => {
    if (captionEditRequested === lastSeenEditRequest.current) return;
    lastSeenEditRequest.current = captionEditRequested;
    if (!canEdit) return;
    setDraft(post?.caption || '');
    setEditing(true);
    setTimeout(() => {
      try { textareaRef.current && textareaRef.current.focus(); } catch (e) {}
    }, 50);
  }, [captionEditRequested, canEdit, post?.caption]);

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
    await commit('caption', next, {
      auditField: 'caption',
      actor: userEmail || null,
      label: 'Caption',
    });
    if (post?.post_id) reseedOgPreview(post.post_id);
  }

  async function handleSave() {
    const next = (draft || '').trim();
    setEditing(false);
    if (!next) return;
    if (next === caption) return;
    logClick('pcs_react_caption_save', { len: next.length });
    await applyCaption(next);
  }

  function onClaude() {
    if (isClient) return;
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
    if (isClient) return;
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
    const draftWc = wordCount(draft);
    const draftState = wordStateOf(draftWc);
    return (
      <div className="px-4 pt-2 pb-3 border-b border-divider-subtle">
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="w-full bg-bg-draft p-3 font-sans text-lg leading-relaxed text-text-loud resize-none"
          style={{
            border: '1px solid var(--c-terracotta)',
            outline: 'none',
            boxShadow: 'none',
            caretColor: 'currentColor',
            lineHeight: '1.6',
            maxHeight: TEXTAREA_MAX_HEIGHT + 'px',
            overflowY: 'auto',
          }}
        />
        <div className="flex items-center justify-between pt-2">
          <div
            className="font-mono text-sm tracking-widest uppercase"
            style={{ fontFeatureSettings: "'tnum' 1" }}
          >
            <span
              className={draftState === 'green' ? '' : wordStateClass(draftState)}
              style={draftState === 'green' ? { color: GREEN_TOKEN } : undefined}
            >
              {draftWc} WORDS
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
          <span
            className={wcState === 'green' ? '' : wordStateClass(wcState)}
            style={wcState === 'green' ? { color: GREEN_TOKEN } : undefined}
          >
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

          <button
            type="button"
            {...copyLongPress}
            onClick={handleCopyClick}
            onContextMenu={(e) => e.preventDefault()}
            className="w-8 h-8 inline-flex items-center justify-center rounded-sm2 text-text-mid hover:text-text-loud active:bg-bg-2 active:scale-[0.96]"
            style={{ transition: 'background 0.08s ease, color 0.1s ease, transform 0.08s ease' }}
            aria-label="Copy caption"
          >
            <Copy size={14} strokeWidth={1.75} />
          </button>

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

          {!isClient ? (
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
