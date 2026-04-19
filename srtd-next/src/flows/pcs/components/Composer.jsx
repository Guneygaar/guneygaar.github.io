import React, { useState, useRef, useEffect } from 'react';
import { Plus, Sparkles, X, AtSign, ImagePlus, Paperclip, CircleDot, FileText } from 'lucide-react';
import { createComment, createInternalNote } from '../../../core/api/comments.js';
import { useAppState } from '../../../core/stores/appState.js';
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
  const currentRole = useAppState((s) => s.user?.role || '');
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

  const isAgency = ['admin', 'creative', 'servicing'].includes(String(currentRole).toLowerCase());
  const isInternalTab = activeTab === 'internal' && isAgency;
  const placeholder = isInternalTab ? 'Write an internal note...' : 'Write a comment...';

  useEffect(() => {
    if (taRef.current) {
      taRef.current.style.height = 'auto';
      taRef.current.style.height = Math.min(taRef.current.scrollHeight, 200) + 'px';
    }
  }, [text]);

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
      if (attachedImages.length > 0) attachmentParts.push({ type: 'image', urls: attachedImages });
      if (attachedFiles.length > 0) attachmentParts.push({ type: 'files', files: attachedFiles });
      taskAttachments.forEach((t) => attachmentParts.push(t));
      const attachments = attachmentParts.length > 0 ? attachmentParts : null;

      const payload = {
        post_id: post.post_id,
        author: currentEmail,
        author_role: currentRole,
        message: text.trim(),
        post_title: post.title,
        mentioned_users: mentioned.length > 0 ? mentioned : null,
        attachments,
        reply_to: replyTo?.id || null,
        visibility: isInternalTab ? 'servicing' : 'all',
        created_at: new Date().toISOString()
      };

      if (isInternalTab) {
        await createInternalNote(payload);
      } else {
        await createComment(payload);
      }

      logClick('pcs_react_comment_send', { tab: activeTab, withImages: attachedImages.length > 0, withFiles: attachedFiles.length > 0, withTasks: taskAttachments.length > 0, replyTo: !!replyTo });
      setText('');
      setAttachedImages([]);
      setAttachedFiles([]);
      setTaskAttachments([]);
      setPolishPreview(null);
      if (onCancelReply) onCancelReply();
      if (isInternalTab) {
        await pcsFlow.retryInternalNotes();
      } else {
        await pcsFlow.retryComments();
      }
    } catch (err) {
      logError(err, { context: 'pcs_react_comment_send' });
      toast('Send failed', 'error');
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); onSend(); }
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
    <div className="sticky bottom-0 bg-bg border-t border-divider-warm pb-safe-b">
      {replyTo && (
        <div
          className="flex items-start gap-2 mx-3 mt-2 mb-1 border-l-2 border-terracotta bg-bg-3"
          style={{ padding: '10px 14px', borderRadius: 6 }}
        >
          <div className="flex-1 min-w-0">
            <div className="text-terracotta font-semibold text-sm">Replying to {replyTo.authorName}</div>
            <div
              className="block truncate"
              style={{ fontSize: '13px', opacity: 0.7, color: 'var(--c-text-mid)', marginTop: 2 }}
            >
              {replyTo.message}
            </div>
          </div>
          <button onClick={onCancelReply} className="w-6 h-6 flex items-center justify-center text-text-soft flex-shrink-0" aria-label="Cancel reply"><X size={14} /></button>
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
      <div className="flex items-end gap-2 px-3 py-2">
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
        {isAgency && text.trim() && !polishPreview && (
          <button onClick={onPolish} disabled={polishing} className="w-8 h-8 flex items-center justify-center rounded-sm2 tint-amber border text-amber disabled:opacity-50" aria-label="Polish">
            <Sparkles size={14} />
          </button>
        )}
        <button
          onClick={onSend}
          disabled={sending || (!text.trim() && attachedImages.length === 0 && attachedFiles.length === 0 && taskAttachments.length === 0)}
          className="px-3 py-1.5 rounded-sm2 text-sm font-semibold tracking-tight inline-flex items-center gap-1.5 disabled:opacity-40"
          style={{ backgroundColor: '#ffffff', color: '#0a0a0a' }}
        >
          <span>Send</span>
          <span className="font-mono text-2xs opacity-50">{'\u2318\u21B5'}</span>
        </button>
      </div>

      {sheetOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 z-10" onClick={() => setSheetOpen(false)} />
          <div className="fixed bottom-0 left-0 right-0 bg-bg-2 border-t border-divider-warm rounded-t-[16px] z-20 pb-safe-b">
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
