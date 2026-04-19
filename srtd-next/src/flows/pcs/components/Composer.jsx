import React, { useState, useRef, useEffect } from 'react';
import { Plus, Sparkles, X, Image as ImageIcon, AtSign } from 'lucide-react';
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
  const [showMenu, setShowMenu] = useState(false);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const taRef = useRef(null);
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

  async function onPickFiles(e) {
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

  async function onSend() {
    if (sending || (!text.trim() && attachedImages.length === 0)) return;
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

      const attachments = attachedImages.length > 0 ? [{ type: 'images', urls: attachedImages }] : null;

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

      logClick('pcs_react_comment_send', { tab: activeTab, withImages: attachedImages.length > 0, replyTo: !!replyTo });
      setText('');
      setAttachedImages([]);
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

  return (
    <div className="sticky bottom-0 bg-bg border-t border-divider-warm pb-safe-b">
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
        <div className="relative">
          <button onClick={() => setShowMenu(!showMenu)} className="w-8 h-8 flex items-center justify-center text-text-soft hover:bg-bg-2 rounded-sm2" aria-label="Add">
            <Plus size={18} />
          </button>
          {showMenu && (
            <div className="absolute bottom-full left-0 mb-1 bg-bg border border-divider-warm rounded-card shadow-overlay min-w-[160px]">
              <button onClick={() => { fileInputRef.current?.click(); setShowMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-bg-2 text-left text-sm">
                <ImageIcon size={14} /><span>Add image</span>
              </button>
            </div>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={onPickFiles} className="hidden" />
        </div>
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
        <button onClick={onSend} disabled={sending || (!text.trim() && attachedImages.length === 0)} className="px-3 py-1.5 rounded-sm2 bg-text-loud text-bg text-sm font-semibold tracking-tight inline-flex items-center gap-1.5 disabled:opacity-40">
          <span>Send</span>
          <span className="font-mono text-2xs opacity-50">{'\u2318\u21B5'}</span>
        </button>
      </div>
      <div className="flex gap-1.5 px-3 pb-2 font-mono text-2xs text-text-dim tracking-wide">
        <span>{isInternalTab ? 'agency only' : 'client + agency'}</span>
        <span className="w-[2px] h-[2px] bg-text-dim rounded-pill self-center" />
        <span>{isInternalTab ? 'private' : 'visible to all'}</span>
      </div>
    </div>
  );
}
