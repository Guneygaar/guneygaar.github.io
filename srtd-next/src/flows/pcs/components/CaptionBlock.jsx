import React, { useState, useRef, useLayoutEffect, useEffect } from 'react';
import { ChevronDown, Sparkles, ShieldCheck, Copy } from 'lucide-react';
import { EditIcon } from '../../../core/ui/index.js';
import { wordCount, renderRichText } from '../utils/mentions.jsx';
import { usePcsStore } from '../pcsStore.js';
import { logClick } from '../../../core/bridges/logging.js';
import { openCaptionWorkspace } from '../../../core/bridges/captionWorkspace.js';
import { useIsClient, useAppState } from '../../../core/stores/appState';
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
  const [selectionBar, setSelectionBar] = useState(null); // {text, char_start, char_end}
  const [composerHeight, setComposerHeight] = useState(60);

  const bodyRef = useRef(null);
  const textareaRef = useRef(null);
  const captionEditRequested = usePcsStore((s) => s.captionEditRequested);
  const lastSeenEditRequest = useRef(captionEditRequested);
  const comments = usePcsStore((s) => s.comments);
  const internalNotes = usePcsStore((s) => s.internalNotes);
  const flashCommentId = usePcsStore((s) => s.flashCommentId);
  const flashComment = usePcsStore((s) => s.flashComment);
  const captionExpandRequested = usePcsStore((s) => s.captionExpandRequested);
  const lastSeenExpand = useRef(captionExpandRequested);
  const { commit } = useOptimisticPatch();

  // Build anchors[] for renderRichText. Resolved + soft-deleted comments
  // and notes drop their visual mark — comment row stays in the thread
  // with a greyed badge label. Both tabs feed the same caption surface.
  const captionAnchors = React.useMemo(() => {
    const all = [...(Array.isArray(comments) ? comments : []), ...(Array.isArray(internalNotes) ? internalNotes : [])];
    const list = [];
    for (const c of all) {
      if (!c) continue;
      if (c.resolved) continue;
      if (c.deleted) continue;
      if (c.anchor_type !== 'caption') continue;
      const payload = c.anchor_payload || null;
      if (!payload || typeof payload.text !== 'string' || !payload.text) continue;
      list.push({
        id: c.id,
        payload,
        onClick: () => {
          setShowFull(true);
          flashComment(c.id);
          try {
            const row = document.querySelector(`[data-comment-row-id="${c.id}"]`);
            if (row && typeof row.scrollIntoView === 'function') {
              row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          } catch (e) { /* noop */ }
          setTimeout(() => {
            try { flashComment(null); } catch (e) {}
          }, 1600);
        },
      });
    }
    return list;
  }, [comments, internalNotes, flashComment]);

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

  // External expand trigger from CommentRow caption badge. Clamped
  // caption unfurls before the anchor mark scrolls into view.
  useEffect(() => {
    if (captionExpandRequested === lastSeenExpand.current) return;
    lastSeenExpand.current = captionExpandRequested;
    setShowFull(true);
  }, [captionExpandRequested]);

  // When flashCommentId points at one of the visible captionAnchors,
  // toggle the .is-flashing class on the matching <mark> so the
  // anchor pulse runs in lockstep with the comment-row pulse.
  useEffect(() => {
    if (!flashCommentId) return;
    const root = bodyRef.current;
    if (!root) return;
    const el = root.querySelector(`mark[data-anchor-id="${flashCommentId}"]`);
    if (!el) return;
    el.classList.add('is-flashing');
    const tid = setTimeout(() => {
      try { el.classList.remove('is-flashing'); } catch (e) {}
    }, 1600);
    return () => clearTimeout(tid);
  }, [flashCommentId]);

  // Persistent selection bar above the composer. Replaces the legacy
  // floating pill (PR-3.13.1) — iOS native text-selection callout sits
  // OS-level above any in-page element anchored to the selection rect,
  // so the trigger lives at the bottom instead. selectionchange listener
  // is unchanged: bar visible only when selection non-empty AND fully in
  // caption body AND not in edit mode.
  useEffect(() => {
    if (editing) { setSelectionBar(null); return undefined; }
    function onSelChange() {
      try {
        const sel = window.getSelection && window.getSelection();
        if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
          setSelectionBar(null);
          return;
        }
        const range = sel.getRangeAt(0);
        const root = bodyRef.current;
        if (!root) { setSelectionBar(null); return; }
        const start = range.startContainer;
        const end = range.endContainer;
        if (!root.contains(start) || !root.contains(end)) {
          setSelectionBar(null);
          return;
        }
        const text = sel.toString();
        if (!text || !text.trim()) { setSelectionBar(null); return; }
        const idx = caption.indexOf(text);
        if (idx < 0) { setSelectionBar(null); return; }
        setSelectionBar({ text, char_start: idx, char_end: idx + text.length });
      } catch (e) {
        setSelectionBar(null);
      }
    }
    document.addEventListener('selectionchange', onSelChange);
    return () => document.removeEventListener('selectionchange', onSelChange);
  }, [editing, caption]);

  // Measure live composer height so the selection bar always sits
  // immediately above it (composer height varies with attachments,
  // mention picker, polish preview, anchor chip).
  useEffect(() => {
    const composerEl = document.querySelector('[data-composer]');
    if (!composerEl) return undefined;
    function measure() {
      try { setComposerHeight(composerEl.offsetHeight || 60); } catch (e) {}
    }
    measure();
    let ro = null;
    try {
      if (typeof ResizeObserver !== 'undefined') {
        ro = new ResizeObserver(measure);
        ro.observe(composerEl);
      }
    } catch (e) { /* noop */ }
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('resize', measure);
      if (ro) try { ro.disconnect(); } catch (e) {}
    };
  }, [selectionBar]);

  function onSelectionCommentClick(e) {
    if (!selectionBar) return;
    e.preventDefault();
    e.stopPropagation();
    try {
      usePcsStore.getState().requestAnchor({
        type: 'caption',
        text: selectionBar.text,
        char_start: selectionBar.char_start,
        char_end: selectionBar.char_end,
      });
      logClick('pcs_react_anchor_caption_capture', { len: selectionBar.text.length });
    } catch (err) { /* noop */ }
    try {
      const sel = window.getSelection && window.getSelection();
      if (sel && sel.removeAllRanges) sel.removeAllRanges();
    } catch (err) { /* noop */ }
    setSelectionBar(null);
  }

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
    <div className="px-4 relative">
      <div
        ref={bodyRef}
        data-caption-body
        className={`font-sans text-lg text-text-loud whitespace-pre-wrap ${!showFull && overflows ? 'caption-clamp-6 caption-fade-bottom' : ''}`}
        style={{ lineHeight: '1.6' }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {renderRichText(caption, [], captionAnchors)}
      </div>

      {selectionBar ? (
        <div
          className="anchor-sel-bar"
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: composerHeight,
            zIndex: 2640,
            pointerEvents: 'none',
          }}
        >
          <div
            className="mx-auto bg-bg-2 border border-divider-warm flex items-center gap-3"
            style={{
              maxWidth: 480,
              borderLeft: '3px solid var(--c-terracotta)',
              borderTopLeftRadius: 8,
              borderTopRightRadius: 8,
              borderBottom: 'none',
              padding: '10px 14px',
              pointerEvents: 'auto',
            }}
          >
            <div className="flex-1 min-w-0">
              <div
                className="font-mono text-2xs text-terracotta tracking-widest uppercase font-semibold"
                style={{ marginBottom: 2 }}
              >
                Selected
              </div>
              <div className="font-serif text-sm text-text-mid italic truncate">
                {selectionBar.text.length > 60
                  ? selectionBar.text.slice(0, 60) + '…'
                  : selectionBar.text}
              </div>
            </div>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={onSelectionCommentClick}
              className="font-mono text-xs tracking-widest uppercase text-terracotta px-2 py-1 flex-shrink-0"
            >
              Comment {'→'}
            </button>
          </div>
        </div>
      ) : null}

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
