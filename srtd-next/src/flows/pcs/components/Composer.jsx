import React, { useState, useRef, useEffect } from 'react';
import { Plus, Sparkles, X, AtSign, ImagePlus, Paperclip, CircleDot, FileText, ArrowUp } from 'lucide-react';
import { createComment, createInternalNote } from '../../../core/api/comments.js';
import { useAppState, useIsClient } from '../../../core/stores/appState.js';
import { usePcsStore } from '../pcsStore.js';
import { toast } from '../../../core/bridges/toast.js';
import { polishText } from '../../../core/bridges/claudePolish.js';
import { uploadToR2 } from '../../../core/bridges/r2.js';
import { compressImage, generateFilename } from '../../../core/utils/imageCompress.js';
import { logClick, logError } from '../../../core/bridges/logging.js';
import { pcsFlow } from '../index.js';

export function Composer({ activeTab, replyTo, onCancelReply }) {
  const post = usePcsStore((s) => s.post);
  const userRoles = usePcsStore((s) => s.userRoles);
  const currentEmail = useAppState((s) => s.user?.email || '');
  const currentRole = useAppState((s) => s.user?.effectiveRole || s.user?.role || '');
  const isClient = useIsClient();
  const [text, setText] = useState('');
  const [polishPreview, setPolishPreview] = useState(null);
  const [polishing, setPolishing] = useState(false);
  const [sending, setSending] = useState(false);
  const [attachedImages, setAttachedImages] = useState([]);
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [taskAttachments, setTaskAttachments] = useState([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const taRef = useRef(null);
  const photoInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const chipRef = useRef(null);
  const anchorRequested = usePcsStore((s) => s.anchorRequested);
  // PR-3.13.1: read live pendingAnchor so the chip thumbnail/coords
  // update in real time while the draft pin is being dragged in the
  // Lightbox. Local-state shadow was removed for the same reason.
  const anchor = usePcsStore((s) => s.pendingAnchor);
  const lastSeenAnchor = useRef(anchorRequested);

  useEffect(() => {
    if (anchorRequested === lastSeenAnchor.current) return;
    lastSeenAnchor.current = anchorRequested;
    const next = usePcsStore.getState().pendingAnchor;
    if (!next) return;
    setTimeout(() => {
      try { taRef.current && taRef.current.focus(); } catch (e) {}
      setTimeout(() => {
        try {
          if (chipRef.current && typeof chipRef.current.scrollIntoView === 'function') {
            chipRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
          }
        } catch (e) {}
      }, 80);
    }, 30);
  }, [anchorRequested]);

  function clearAnchorChip() {
    try { usePcsStore.getState().clearAnchor(); } catch (e) {}
  }

  const isAgency = ['admin', 'creative', 'servicing'].includes(String(currentRole).toLowerCase());
  const isInternalTab = activeTab === 'internal' && isAgency;
  const placeholder = isInternalTab ? 'Write an internal note...' : 'Write a comment...';

  useEffect(() => {
    if (taRef.current) {
      taRef.current.style.height = 'auto';
      taRef.current.style.height = Math.min(taRef.current.scrollHeight, 200) + 'px';
    }
  }, [text]);

  useEffect(() => {
    function onDocPointerDown(e) {
      if (!taRef.current) return;
      if (document.activeElement !== taRef.current) return;
      const composerEl = taRef.current.closest('[data-composer]');
      if (composerEl && composerEl.contains(e.target)) return;
      taRef.current.blur();
    }
    document.addEventListener('pointerdown', onDocPointerDown, true);
    return () => document.removeEventListener('pointerdown', onDocPointerDown, true);
  }, []);

  function onTextChange(e) {
    const v = e.target.value;
    setText(v);
    const caret = e.target.selectionStart;
    const before = v.slice(0, caret);
    const m = before.match(/@([\w.-]*)$/);
    if (m) {
      setMentionOpen(true);
      setMentionQuery(m[1]);
    } else {
      setMentionOpen(false);
    }
  }

  function insertMention(user) {
    const ta = taRef.current;
    if (!ta) return;
    const caret = ta.selectionStart;
    const head = text.slice(0, caret).replace(/@[\w.-]*$/, '@' + (user.name || user.email) + ' ');
    const tail = text.slice(caret);
    setText(head + tail);
    setMentionOpen(false);
    setTimeout(() => ta.focus(), 0);
  }

  async function onPolish() {
    if (!text.trim() || polishing) return;
    setPolishing(true);
    try {
      const r = await polishText(text, post?.post_id);
      setPolishPreview(r.content);
    } catch (err) {
      logError(err, { context: 'pcs_react_polish' });
      toast('Polish failed', 'error');
    } finally {
      setPolishing(false);
    }
  }

  function acceptPolish() {
    if (polishPreview) { setText(polishPreview); setPolishPreview(null); }
  }

  function rejectPolish() { setPolishPreview(null); }

  async function onPickPhotos(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;
    try {
      const urls = [];
      for (const f of files) {
        const blob = await compressImage(f, { maxDim: 800, quality: 0.80 });
        const url = await uploadToR2(generateFilename('jpg'), blob);
        urls.push(url);
      }
      setAttachedImages((prev) => [...prev, ...urls]);
    } catch (err) {
      logError(err, { context: 'pcs_react_comment_img' });
      toast('Image upload failed', 'error');
    }
  }

  async function onPickFiles(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;
    try {
      const next = [];
      for (const f of files) {
        const ext = (f.name.split('.').pop() || 'bin').toLowerCase();
        const url = await uploadToR2(generateFilename(ext), f);
        next.push({ name: f.name, url });
      }
      setAttachedFiles((prev) => [...prev, ...next]);
    } catch (err) {
      logError(err, { context: 'pcs_react_comment_file' });
      toast('File upload failed', 'error');
    }
  }

  function addTask() {
    setTaskAttachments((prev) => [...prev, { type: 'task', assigned_to: null }]);
  }

  async function onSend() {
    if (sending || (!text.trim() && attachedImages.length === 0 && attachedFiles.length === 0 && taskAttachments.length === 0)) return;
    setSending(true);
    try {
      const mentioned = [];
      const mentionRe = /@([\w.-]+(?:@[\w.-]+\.[a-z]{2,})?)/gi;
      let m;
      while ((m = mentionRe.exec(text)) !== null) {
        const raw = m[1];
        const byEmail = userRoles.find((u) => u.email === raw);
        const byName = userRoles.find((u) => u.name && u.name.toLowerCase() === raw.toLowerCase());
        const hit = byEmail || byName;
        if (hit && !mentioned.includes(hit.email)) mentioned.push(hit.email);
      }

      const attachmentParts = [];
      if (attachedImages.length > 0) attachmentParts.push({ type: 'images', urls: attachedImages });
      if (attachedFiles.length > 0) attachmentParts.push({ type: 'files', files: attachedFiles });
      taskAttachments.forEach((t) => attachmentParts.push(t));
      const attachments = attachmentParts.length === 0
        ? null
        : JSON.stringify(attachmentParts.length === 1 ? attachmentParts[0] : attachmentParts);

      const r = String(currentRole).toLowerCase();
      const authorRoleTitle =
        r === 'admin' ? 'Admin' :
        r === 'servicing' ? 'Servicing' :
        r === 'creative' ? 'Creative' :
        r === 'client' ? 'Client' : '';
      if (!authorRoleTitle) {
        toast('Session role missing, please refresh', 'error');
        logError(new Error('composer_missing_role'), { context: 'pcs_react_comment_send', role: currentRole });
        return;
      }

      if (!currentEmail) {
        toast('Session expired, please refresh', 'error');
        return;
      }

      const trimmed = text.trim();
      const createdAtIso = new Date().toISOString();

      const anchorType = anchor && (anchor.type === 'caption' || anchor.type === 'photo') ? anchor.type : null;
      const anchorPayload = anchorType ? anchor : null;

      const payload = {
        post_id: post.post_id,
        author: currentEmail,
        author_role: authorRoleTitle,
        message: trimmed,
        post_title: post.title,
        mentioned_users: mentioned.length > 0 ? mentioned : null,
        attachments,
        reply_to: replyTo?.id || null,
        visibility: isInternalTab ? 'servicing' : 'all',
        anchor_type: anchorType,
        anchor_payload: anchorPayload,
        created_at: createdAtIso
      };

      // Optimistic insert for the comments tab. Internal notes path stays
      // await-only because Bug #6.1 was scoped to client-visible comments.
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
      const originalText = text;
      const doOptimistic = !isInternalTab;
      if (doOptimistic) {
        const optimisticRow = {
          id: tempId,
          post_id: post.post_id,
          author: currentEmail,
          author_role: authorRoleTitle,
          message: trimmed,
          visibility: 'all',
          created_at: createdAtIso,
          reply_to: replyTo?.id || null,
          attachments,
          anchor_type: anchorType,
          anchor_payload: anchorPayload,
          _temp: true
        };
        usePcsStore.setState((s) => ({ comments: [...s.comments, optimisticRow] }));
      }

      try {
        if (isInternalTab) {
          await createInternalNote(payload);
        } else {
          await createComment(payload);
        }
      } catch (err) {
        if (doOptimistic) {
          usePcsStore.setState((s) => ({ comments: s.comments.filter((c) => c.id !== tempId) }));
          setText(originalText);
        }
        throw err;
      }

      logClick('pcs_react_comment_send', { tab: activeTab, withImages: attachedImages.length > 0, withFiles: attachedFiles.length > 0, withTasks: taskAttachments.length > 0, replyTo: !!replyTo, anchorType: anchorType || null });
      setText('');
      setAttachedImages([]);
      setAttachedFiles([]);
      setTaskAttachments([]);
      setPolishPreview(null);
      try { usePcsStore.getState().clearAnchor(); } catch (e) {}
      if (onCancelReply) onCancelReply();
      if (isInternalTab) {
        await pcsFlow.retryInternalNotes();
      } else {
        await pcsFlow.retryComments();
        // Dedupe: drop the optimistic row when a real row landed with
        // matching author + message and a created_at within 60s.
        usePcsStore.setState((s) => {
          const tempRow = s.comments.find((c) => c.id === tempId);
          if (!tempRow) return {};
          const tempTs = new Date(tempRow.created_at).getTime();
          const realMatch = s.comments.find((c) =>
            c.id !== tempId &&
            !c._temp &&
            c.author === tempRow.author &&
            c.message === tempRow.message &&
            Math.abs(new Date(c.created_at).getTime() - tempTs) < 60000
          );
          if (realMatch) {
            return { comments: s.comments.filter((c) => c.id !== tempId) };
          }
          return {};
        });
      }
    } catch (err) {
      logError(err, { context: 'pcs_react_comment_send' });
      toast('Send failed', 'error');
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const hasContent = text.trim() !== '' || attachedImages.length > 0 || attachedFiles.length > 0 || taskAttachments.length > 0;
      if (hasContent && !sending) onSend();
    }
  }

  const matchingUsers = mentionOpen ? userRoles.filter((u) => {
    const q = mentionQuery.toLowerCase();
    return !q || (u.name && u.name.toLowerCase().includes(q)) || u.email.toLowerCase().includes(q);
  }).slice(0, 5) : [];

  const sheetOption = (Icon, label, sub, onClick) => (
    <button
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-3.5 w-full text-left hover:bg-bg-3 border-b border-divider-soft last:border-b-0"
    >
      <div className="w-9 h-9 rounded-card bg-bg-3 flex items-center justify-center flex-shrink-0">
        <Icon size={18} className="text-text-mid" />
      </div>
      <div>
        <div className="font-sans text-lg font-medium text-text-loud">{label}</div>
        <div className="font-mono text-xs text-text-dim tracking-wide">{sub}</div>
      </div>
    </button>
  );

  return (
    <div data-composer className="sticky bottom-0 bg-bg border-t border-divider-warm pb-safe-b">
      {replyTo && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-divider-soft bg-bg-2">
          <div className="flex-1 text-2xs text-text-soft">
            <span className="text-terracotta font-semibold">Replying to {replyTo.authorName}</span>
            <span className="block truncate">{replyTo.message}</span>
          </div>
          <button onClick={onCancelReply} className="w-6 h-6 flex items-center justify-center text-text-soft" aria-label="Cancel reply"><X size={14} /></button>
        </div>
      )}
      {polishPreview && (
        <div className="px-3 py-2 border-b border-divider-soft tint-amber border">
          <div className="font-mono text-2xs text-amber tracking-widest uppercase mb-1">{'\u2726'} Polished</div>
          <div className="font-serif text-sm text-text-loud">{polishPreview}</div>
          <div className="flex gap-2 mt-2">
            <button onClick={acceptPolish} className="px-3 py-1 rounded-sm2 bg-amber text-text-loud text-2xs font-semibold">Accept</button>
            <button onClick={rejectPolish} className="px-3 py-1 rounded-sm2 border border-border-neutral text-2xs text-text-mid">Discard</button>
          </div>
        </div>
      )}
      {anchor && (
        <div
          ref={chipRef}
          className="anchor-chip-enter mx-3 mt-2 mb-1 flex items-center gap-3 bg-bg-2 border border-divider-warm rounded-sm2"
          style={{
            borderLeft: '3px solid var(--c-terracotta)',
            padding: '10px 12px',
          }}
        >
          {anchor.type === 'photo' ? (() => {
            const imgs = Array.isArray(post?.images) ? post.images : (post?.images?.urls || []);
            const src = imgs[anchor.image_index || 0] || '';
            return (
              <div
                className="anchor-chip-thumb flex-shrink-0"
                style={{
                  position: 'relative',
                  width: 60,
                  height: 60,
                  borderRadius: 4,
                  overflow: 'hidden',
                  background: 'var(--c-bg-3)',
                }}
              >
                {src ? (
                  <img
                    src={src}
                    alt=""
                    draggable={false}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      pointerEvents: 'none',
                    }}
                  />
                ) : null}
                <span
                  className="anchor-photo-dot is-draft is-thumb"
                  style={{
                    left: `${anchor.x_pct || 0}%`,
                    top: `${anchor.y_pct || 0}%`,
                  }}
                  aria-hidden="true"
                >
                  <span className="anchor-photo-dot-plus">+</span>
                </span>
              </div>
            );
          })() : null}
          <div className="flex-1 min-w-0">
            <div
              className="font-mono text-2xs text-terracotta tracking-widest uppercase font-semibold"
              style={{ marginBottom: 2 }}
            >
              {anchor.type === 'caption' ? 'Replying to caption' : 'Replying to photo'}
            </div>
            {anchor.type === 'caption' ? (
              <div
                className="font-serif text-sm text-text-mid italic truncate"
                style={{ maxWidth: '100%' }}
              >
                {typeof anchor.text === 'string'
                  ? '“' + (anchor.text.length > 120 ? anchor.text.slice(0, 120) + '…' : anchor.text) + '”'
                  : '“snippet”'}
              </div>
            ) : (
              <div className="font-mono text-2xs text-text-soft tracking-wide">
                Photo {(anchor.image_index || 0) + 1} {'·'} {Math.round(anchor.x_pct || 0)}%, {Math.round(anchor.y_pct || 0)}%
              </div>
            )}
          </div>
          <button
            onClick={clearAnchorChip}
            className="w-6 h-6 flex-shrink-0 flex items-center justify-center text-text-soft hover:text-text-loud"
            aria-label="Clear anchor"
            type="button"
          >
            <X size={14} />
          </button>
        </div>
      )}
      {attachedImages.length > 0 && (
        <div className="flex gap-1.5 px-3 pt-2 flex-wrap">
          {attachedImages.map((url, i) => (
            <div key={i} className="relative">
              <div className="w-14 h-14 rounded-sm2 bg-cover bg-center border border-divider-soft" style={{ backgroundImage: `url(${url})` }} />
              <button onClick={() => setAttachedImages((prev) => prev.filter((_, idx) => idx !== i))} className="absolute -top-1 -right-1 w-4 h-4 rounded-pill bg-black text-text-loud flex items-center justify-center text-2xs" aria-label="Remove attached image">{'\u00D7'}</button>
            </div>
          ))}
        </div>
      )}
      {attachedFiles.length > 0 && (
        <div className="flex flex-col gap-1 px-3 pt-2">
          {attachedFiles.map((f, i) => (
            <div key={i} className="flex items-center gap-2 px-2 py-1.5 bg-bg-2 rounded-sm2 border border-divider-soft">
              <FileText size={14} className="text-text-mid flex-shrink-0" />
              <span className="text-sm text-text-mid truncate flex-1">{f.name}</span>
              <button onClick={() => setAttachedFiles((prev) => prev.filter((_, idx) => idx !== i))} className="text-text-soft" aria-label="Remove attached file"><X size={12} /></button>
            </div>
          ))}
        </div>
      )}
      {taskAttachments.length > 0 && (
        <div className="flex flex-col gap-1 px-3 pt-2">
          {taskAttachments.map((_, i) => (
            <div key={i} className="flex items-center gap-2 px-2 py-1.5 bg-bg-2 rounded-sm2 border border-divider-soft">
              <CircleDot size={14} className="text-amber flex-shrink-0" />
              <span className="text-sm text-text-mid flex-1">Task</span>
              <button onClick={() => setTaskAttachments((prev) => prev.filter((_, idx) => idx !== i))} className="text-text-soft" aria-label="Remove task"><X size={12} /></button>
            </div>
          ))}
        </div>
      )}
      {mentionOpen && matchingUsers.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 max-w-[430px] mx-auto bg-bg border border-divider-warm rounded-t-card shadow-overlay">
          {matchingUsers.map((u) => (
            <button key={u.id} onClick={() => insertMention(u)} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-bg-2 text-left">
              <AtSign size={12} className="text-text-dim" />
              <span className="text-sm text-text-loud">{u.name || u.email}</span>
            </button>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2 px-3 py-3">
        <button onClick={() => setSheetOpen(true)} className="w-8 h-8 flex items-center justify-center text-text-soft hover:bg-bg-2 rounded-sm2" aria-label="Add">
          <Plus size={18} />
        </button>
        <input ref={photoInputRef} type="file" accept="image/*" multiple onChange={onPickPhotos} className="hidden" />
        <input ref={fileInputRef} type="file" multiple onChange={onPickFiles} className="hidden" />
        <textarea
          ref={taRef}
          value={text}
          onChange={onTextChange}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          rows={1}
          className="flex-1 bg-transparent text-lg text-text-loud placeholder:text-text-dim font-sans py-1.5 px-1 outline-none resize-none"
        />
        {!isClient && isAgency && text.trim() && !polishPreview && (
          <button onClick={onPolish} disabled={polishing} className="w-8 h-8 flex items-center justify-center rounded-sm2 tint-amber border text-amber disabled:opacity-50" aria-label="Polish">
            <Sparkles size={14} />
          </button>
        )}
        {(() => {
          const hasContent = text.trim() !== '' || attachedImages.length > 0 || attachedFiles.length > 0 || taskAttachments.length > 0;
          const baseCls = 'w-8 h-8 mr-1 rounded-pill flex items-center justify-center transition-colors duration-150';
          const stateCls = hasContent ? ' bg-terracotta text-white' : ' bg-send-idle text-text-mid';
          const sendingCls = sending ? ' opacity-50 pointer-events-none' : '';
          return (
            <button onClick={onSend} disabled={sending} className={baseCls + stateCls + sendingCls} aria-label="Send">
              <ArrowUp size={16} strokeWidth={2.5} />
            </button>
          );
        })()}
      </div>

      {sheetOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 z-[2700]" onClick={() => setSheetOpen(false)} />
          <div className="fixed bottom-0 left-0 right-0 bg-bg-2 border-t border-divider-warm rounded-t-[16px] z-[2701] pb-safe-b">
            <div className="w-8 h-1 bg-border-neutral rounded-pill mx-auto mt-3 mb-2" />
            {sheetOption(ImagePlus, 'Photo', 'Upload an image', () => { setSheetOpen(false); photoInputRef.current?.click(); })}
            {sheetOption(Paperclip, 'File', 'Attach a document', () => { setSheetOpen(false); fileInputRef.current?.click(); })}
            {sheetOption(CircleDot, 'Task', 'Assign an action item', () => { setSheetOpen(false); addTask(); })}
          </div>
        </>
      )}
    </div>
  );
}
