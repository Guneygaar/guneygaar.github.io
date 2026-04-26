import React, { useEffect, useState } from 'react';
import { Mail } from 'lucide-react';
import { tokens } from '../../../core/tokens.js';
import { useFormState } from '../formStore.js';
import { useAppState } from '../../../core/stores/appState.js';
import { listEmails, fetchBrief } from '../../../core/bridges/gmail.js';
import { logClick, logError } from '../../../core/bridges/logging.js';

// Gmail brief import sheet (admin-only, gated upstream in Header.jsx).
// Stages:
//   phase === 'list'    → loading + email rows, pick one
//   phase === 'brief'   → Claude is parsing the picked thread
//   phase === 'confirm' → existing form fields have content; user
//                         picks Replace All, Append Notes Only, or Cancel
//   phase === 'error'   → error message + retry / close
// Fields written on success:
//   form.title          ← data.title     (replace / skip)
//   form.caption        ← data.copy_option_1  (replace / skip)
//   form.internalNotes  ← data.internal_notes (replace / append with
//                          "\n\n---\n\n")

export function GmailSheet() {
  const setUI = useFormState(s => s.setUI);
  const update = useFormState(s => s.update);
  const setToast = useFormState(s => s.setToast);
  const form = useFormState(s => s.form);
  const user = useAppState(s => s.user);
  const workspaceId = useAppState(s => s.workspace?.id || null);

  const [phase, setPhase] = useState('list');
  const [emails, setEmails] = useState([]);
  const [error, setError] = useState(null);
  const [brief, setBrief] = useState(null);
  const [pickedSubject, setPickedSubject] = useState('');

  const close = () => setUI({ gmailSheetOpen: false });

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setEmails([]);
    setPhase('list');
    listEmails({ workspace_id: workspaceId })
      .then(list => {
        if (cancelled) return;
        setEmails(list || []);
        logClick('gmail_sheet_list_fetch', { count: (list || []).length });
      })
      .catch(err => {
        if (cancelled) return;
        setError(err.message || 'Failed to load emails');
        setPhase('error');
        logClick('gmail_sheet_list_fetch', {}, false, { error: err && err.message });
        logError(err, { action: 'gmail-sheet-list' });
      });
    return () => { cancelled = true; };
  }, []);

  const formatDate = (s) => {
    try { return s ? new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''; }
    catch (e) { return ''; }
  };

  const handlePick = (email) => {
    const threadId = email.thread_id || email.id;
    setPickedSubject(email.subject || '');
    setPhase('brief');
    setError(null);
    fetchBrief({
      thread_id: threadId,
      workspace_id: workspaceId,
      created_by: (user && user.email) || ''
    }).then(data => {
      if (!data || !data.success) {
        const errMsg = (data && data.error) || 'Claude could not read the brief';
        setError(errMsg);
        setPhase('error');
        logClick('gmail_sheet_fetch_brief', { thread_id: threadId }, false, { error: errMsg });
        logError(new Error(errMsg), { action: 'gmail-sheet-brief' });
        return;
      }
      setBrief(data);
      logClick('gmail_sheet_fetch_brief', { thread_id: threadId, total_posts: data.total_posts });
      const hasTitle = !!(form.title && form.title.trim());
      const hasCaption = !!(form.caption && form.caption.trim());
      const hasNotes = !!(form.internalNotes && form.internalNotes.trim());
      if (hasTitle || hasCaption || hasNotes) {
        setPhase('confirm');
      } else {
        applyBrief(data, 'replace');
      }
    }).catch(err => {
      setError(err.message || 'Failed to read brief');
      setPhase('error');
      logClick('gmail_sheet_fetch_brief', { thread_id: threadId }, false, { error: err && err.message });
      logError(err, { action: 'gmail-sheet-brief' });
    });
  };

  // Map the Worker's lowercase pillar back to the Title Case UI label
  // so the Pillar dropdown highlights the correct option.
  const _pillarToUi = (raw) => {
    if (!raw || typeof raw !== 'string') return null;
    const s = raw.trim().toLowerCase();
    if (!s) return null;
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  function applyBrief(data, mode /* 'replace' | 'append-notes' */) {
    const title = (data.title || '').trim();
    const caption = (data.copy_option_1 || '').trim();
    const notes = (data.internal_notes || '').trim();

    if (mode === 'replace') {
      if (title) update('title', title);
      if (caption) update('caption', caption);
      if (notes) update('internalNotes', notes);

      // B5.5a.1: Worker now returns pillar / target_date / location /
      // format. Only overwrite when Claude gave us a value (null means
      // "unclear from brief" — leave existing form value alone).
      const pillarUi = _pillarToUi(data.content_pillar);
      if (pillarUi) update('pillar', pillarUi);
      if (typeof data.target_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.target_date)) {
        update('targetDate', data.target_date);
      }
      if (data.location && typeof data.location === 'string') update('location', data.location);
      if (data.format && typeof data.format === 'string') update('format', data.format);
    } else {
      // Append Notes Only — never touch title/caption if the user
      // already filled them; just concat notes with a separator.
      if (notes) {
        const existing = (form.internalNotes || '').trim();
        update('internalNotes', existing ? existing + '\n\n---\n\n' + notes : notes);
      }
    }

    if (data.total_posts && data.total_posts > 1) {
      setToast({
        msg: `Brief contains ${data.total_posts} post ideas`,
        sub: 'This creates post 1 — run Import again for the next'
      });
    } else {
      setToast({ msg: 'Brief imported', sub: pickedSubject ? pickedSubject.slice(0, 60) : null });
    }
    setTimeout(() => useFormState.getState().clearToast(), 2400);
    close();
  }

  const retryList = () => {
    setError(null);
    setEmails([]);
    setPhase('list');
    listEmails({ workspace_id: workspaceId })
      .then(list => {
        setEmails(list || []);
        logClick('gmail_sheet_list_fetch', { count: (list || []).length, retry: true });
      })
      .catch(err => {
        setError(err.message || 'Failed');
        setPhase('error');
        logClick('gmail_sheet_list_fetch', { retry: true }, false, { error: err && err.message });
        logError(err, { action: 'gmail-sheet-list-retry' });
      });
  };

  return (
    <>
      {/* Scrim */}
      <div
        onClick={close}
        style={{ position: 'fixed', inset: 0, background: '#000000E0', zIndex: 1700 }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed',
        top: 0, left: '50%',
        transform: 'translateX(-50%)',
        width: '100%', maxWidth: 420,
        height: '100vh', height: '100dvh',
        background: tokens.ink1,
        borderLeft: `1px solid ${tokens.lineSoft}`,
        borderRight: `1px solid ${tokens.lineSoft}`,
        boxShadow: '0 30px 80px #000000CC',
        zIndex: 1701,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: tokens.sans, color: tokens.text
      }}>
        {/* Header */}
        <div style={{
          padding: '22px 22px 16px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderBottom: `1px solid ${tokens.lineSoft}`
        }}>
          <div>
            <div style={{
              fontFamily: tokens.mono, fontSize: 9, letterSpacing: '0.2em',
              textTransform: 'uppercase', color: tokens.textWhisper, marginBottom: 3
            }}>
              ✦ Import brief
            </div>
            <div style={{
              fontFamily: tokens.serif, fontSize: 22, fontWeight: 500,
              letterSpacing: '-0.015em', color: tokens.textLoud
            }}>
              Gmail
            </div>
          </div>
          <button
            aria-label="Close Gmail sheet"
            onClick={close}
            style={{
              fontSize: 20, color: tokens.textSoft,
              fontFamily: tokens.serif, fontWeight: 300,
              background: 'transparent', border: 'none', padding: 0,
              cursor: 'pointer', lineHeight: 1, transition: 'color 0.15s'
            }}>
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {phase === 'list' && emails.length === 0 && !error && (
            <div style={{
              padding: '40px 22px',
              fontFamily: tokens.mono, fontSize: 10, letterSpacing: '0.14em',
              textTransform: 'uppercase', color: tokens.textSoft, textAlign: 'center'
            }}>
              Loading emails...
            </div>
          )}

          {phase === 'list' && emails.length === 0 && error && null /* handled in error phase */}

          {phase === 'list' && emails.length > 0 && (
            <div>
              {emails.map((e) => (
                <button key={e.thread_id || e.id}
                  onClick={() => handlePick(e)}
                  style={{
                    display: 'block',
                    width: '100%', textAlign: 'left',
                    padding: '14px 22px',
                    background: 'transparent', border: 'none',
                    borderBottom: `1px solid ${tokens.lineSoft}`,
                    cursor: 'pointer'
                  }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{
                      fontFamily: tokens.mono, fontSize: 10, letterSpacing: '0.12em',
                      textTransform: 'uppercase', color: tokens.textSoft
                    }}>{(e.sender || 'Client').slice(0, 30)}</span>
                    <span style={{
                      fontFamily: tokens.mono, fontSize: 10, color: tokens.textWhisper
                    }}>{formatDate(e.date)}</span>
                  </div>
                  <div style={{
                    fontFamily: tokens.serif, fontSize: 14.5, fontWeight: 500,
                    color: tokens.textLoud, letterSpacing: '-0.01em', marginBottom: 3
                  }}>
                    {e.subject || '(no subject)'}
                  </div>
                  <div style={{ fontFamily: tokens.sans, fontSize: 12, color: tokens.textSoft, lineHeight: 1.4 }}>
                    {e.snippet || ''}
                  </div>
                  {e.message_count && e.message_count > 1 ? (
                    <div style={{
                      fontFamily: tokens.mono, fontSize: 9, letterSpacing: '0.12em',
                      textTransform: 'uppercase', color: tokens.claude, marginTop: 4
                    }}>
                      {e.message_count} messages in thread
                    </div>
                  ) : null}
                </button>
              ))}
            </div>
          )}

          {phase === 'brief' && (
            <div style={{
              padding: '60px 22px', textAlign: 'center'
            }}>
              <div style={{
                fontFamily: tokens.serif, fontSize: 18, color: tokens.claude, marginBottom: 8
              }}>✦</div>
              <div style={{
                fontFamily: tokens.serif, fontSize: 16, color: tokens.textLoud, marginBottom: 4
              }}>
                Claude is reading the brief...
              </div>
              {pickedSubject && (
                <div style={{
                  fontFamily: tokens.sans, fontSize: 12, color: tokens.textSoft
                }}>{pickedSubject.slice(0, 80)}</div>
              )}
            </div>
          )}

          {phase === 'confirm' && brief && (
            <div style={{ padding: '22px' }}>
              <div style={{
                fontFamily: tokens.serif, fontSize: 17, color: tokens.textLoud, marginBottom: 10
              }}>
                Replace existing fields?
              </div>
              <div style={{
                fontFamily: tokens.sans, fontSize: 13, color: tokens.textSoft, lineHeight: 1.5,
                marginBottom: 20
              }}>
                You've already typed into this form. Pick how to merge the imported brief:
              </div>
              <button onClick={() => applyBrief(brief, 'replace')} style={_btnPrimary}>
                Replace All
              </button>
              <button onClick={() => applyBrief(brief, 'append-notes')} style={_btnSecondary}>
                Append Notes Only
              </button>
              <button onClick={close} style={_btnGhost}>
                Cancel
              </button>
            </div>
          )}

          {phase === 'error' && (
            <div style={{ padding: '22px' }}>
              <div style={{
                fontFamily: tokens.mono, fontSize: 10, letterSpacing: '0.18em',
                textTransform: 'uppercase', color: tokens.danger, marginBottom: 8
              }}>
                Error
              </div>
              <div style={{
                fontFamily: tokens.serif, fontSize: 15, color: tokens.textLoud, marginBottom: 20
              }}>
                {error || 'Something went wrong'}
              </div>
              <button onClick={retryList} style={_btnPrimary}>
                Retry
              </button>
              <button onClick={close} style={_btnGhost}>
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

const _btnBase = {
  display: 'block', width: '100%',
  padding: '14px 16px',
  background: 'transparent',
  fontFamily: 'inherit',
  cursor: 'pointer',
  textAlign: 'center',
  marginBottom: 8
};

const _btnPrimary = {
  ..._btnBase,
  border: `1px solid ${tokens.claudeBorder}`,
  color: tokens.claude,
  fontFamily: tokens.mono, fontSize: 11, fontWeight: 600,
  letterSpacing: '0.16em', textTransform: 'uppercase',
  background: tokens.claudeSoft
};

const _btnSecondary = {
  ..._btnBase,
  border: `1px solid ${tokens.line}`,
  color: tokens.textLoud,
  fontFamily: tokens.mono, fontSize: 11, fontWeight: 600,
  letterSpacing: '0.16em', textTransform: 'uppercase'
};

const _btnGhost = {
  ..._btnBase,
  border: 'none',
  color: tokens.textSoft,
  fontFamily: tokens.mono, fontSize: 11, fontWeight: 600,
  letterSpacing: '0.16em', textTransform: 'uppercase'
};
