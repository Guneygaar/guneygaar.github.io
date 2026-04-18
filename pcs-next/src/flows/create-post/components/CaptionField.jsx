import React, { useMemo, useEffect } from 'react';
import { Maximize2 } from 'lucide-react';
import { tokens } from '../../../core/tokens.js';
import { useFormState } from '../formStore.js';
import { useIsAdmin } from '../../../core/stores/appState.js';
import { openCaptionWorkspace } from '../../../core/bridges/captionWorkspace.js';
import { logClick } from '../../../core/bridges/logging.js';

function formatINR(n) {
  if (!n || n < 1) return '₹0';
  if (n < 1000) return `₹${Math.round(n)}`;
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

export function CaptionField() {
  const caption = useFormState(s => s.form.caption);
  const update = useFormState(s => s.update);
  const sessionCost = useFormState(s => s.sessionCost);
  const sessionCalls = useFormState(s => s.sessionCalls);
  const isAdmin = useIsAdmin();

  // Log role state on render for diagnosing missing ⤢
  // eslint-disable-next-line
  if (typeof window !== 'undefined') window.__lastCaptionFieldIsAdmin = isAdmin;

  // Poll window._captionWS.sessionCost every 600ms so the cost chip
  // updates live during a workspace session (not just on close).
  // Admin-only — non-admins have no AI surfaces so the poll is a
  // pointless timer. Early-return keeps the hook order stable.
  useEffect(() => {
    if (!isAdmin) return;
    const tick = () => {
      try {
        var live = 0;
        if (typeof window.SortedReact?.bridges?.getSessionCost === 'function') {
          live = window.SortedReact.bridges.getSessionCost();
        } else if (window._captionWS && typeof window._captionWS.sessionCost === 'number') {
          live = window._captionWS.sessionCost;
        }
        if (live !== sessionCost) {
          useFormState.getState().setUI({ sessionCost: live });
        }
      } catch (e) { /* ignore */ }
    };
    const id = setInterval(tick, 600);
    return () => clearInterval(id);
  }, [sessionCost, isAdmin]);

  const wordCount = useMemo(() => {
    const m = (caption || '').trim().match(/\S+/g);
    return m ? m.length : 0;
  }, [caption]);

  const wordState = useMemo(() => {
    if (wordCount === 0) return 'default';
    if (wordCount >= 80 && wordCount <= 100) return 'green';
    if (wordCount > 100 && wordCount <= 125) return 'amber';
    if (wordCount > 125) return 'red';
    return 'default';
  }, [wordCount]);

  const handleOpenWorkspace = () => {
    console.log('[react/caption] ⤢ tapped', {
      mode: (caption || '').trim() ? 'chat' : 'write',
      vanillaAvailable: typeof window.openCaptionWorkspace === 'function',
      isAdmin: useIsAdmin.getState ? undefined : 'hook-scoped'
    });

    const initial = (caption || '').trim();
    const mode = initial ? 'chat' : 'write';
    logClick('caption_workspace_open', { mode, isAdmin });

    openCaptionWorkspace(mode, {
      postId: null,  // detached mode — no post exists yet
      initialCaption: initial,
      syntheticContext: {
        source: 'create-post-react',
        pillar: useFormState.getState().form.pillar || null,
        location: useFormState.getState().form.location || null,
        format: useFormState.getState().form.format || null,
        title: useFormState.getState().form.title || null
      },
      onUse: (text) => {
        if (typeof text !== 'string' || !text.trim()) return;
        const existing = (useFormState.getState().form.caption || '').trim();
        if (existing && existing !== text.trim()) {
          const accepted = window.confirm('Replace existing caption with generated version?');
          logClick('caption_overwrite_confirm', { accepted, source: 'workspace' });
          if (!accepted) return;
        }
        useFormState.getState().update('caption', text);
      },
      onClose: () => {
        try {
          var ws = window._captionWS;
          if (ws) {
            useFormState.getState().setUI({
              sessionCost: typeof ws.sessionCost === 'number' ? ws.sessionCost : 0,
              sessionCalls: Array.isArray(ws.messages)
                ? ws.messages.filter(m => m && m.role === 'assistant').length
                : 0
            });
          }
        } catch (e) {
          // ignore
        }
      }
    });
  };

  return (
    <div style={{ padding: '22px 22px 18px', borderTop: `1px solid ${tokens.lineSoft}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, gap: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8,
            fontFamily: tokens.mono, fontSize: 9.5, letterSpacing: '0.18em',
            textTransform: 'uppercase', color: tokens.textWhisper
          }}>
            <span style={{ color: tokens.claude, fontWeight: 500 }}>05</span>
            <span style={{ color: tokens.textSoft }}>Copy</span>
            <span style={{ color: tokens.textGhost, marginLeft: 10, letterSpacing: '0.14em' }}>Goes to client</span>
          </div>
          <div style={{
            fontFamily: tokens.serif, fontSize: 19, fontWeight: 500,
            color: tokens.textLoud, letterSpacing: '-0.015em', marginTop: 4
          }}>
            Write the caption
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div style={{ fontFamily: tokens.mono, fontSize: 10, letterSpacing: '0.12em', color: tokens.textWhisper }}>
            <span style={{
              color: wordState === 'green' ? tokens.good :
                     wordState === 'amber' ? tokens.warn :
                     wordState === 'red' ? tokens.danger : tokens.text
            }}>{wordCount}</span> / 80-100
          </div>
          {isAdmin && (
            <button
              onClick={handleOpenWorkspace}
              aria-label="Open Caption Workspace"
              style={{
                width: 30, height: 30,
                border: `1px solid ${tokens.line}`, background: 'transparent',
                color: tokens.textSoft,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', padding: 0, transition: 'all 0.15s'
              }}>
              <Maximize2 size={13} strokeWidth={1.7} />
            </button>
          )}
        </div>
      </div>
      <textarea
        value={caption}
        onChange={e => update('caption', e.target.value)}
        placeholder={isAdmin
          ? "Write the LinkedIn caption, or tap the expand icon to use Claude..."
          : "Write the LinkedIn caption..."}
        style={{
          width: '100%', background: 'transparent', border: 'none',
          borderTop: `1px solid ${tokens.line}`,
          padding: '14px 0 0',
          fontFamily: tokens.serif, fontSize: 15.5, lineHeight: 1.65,
          color: tokens.textLoud, outline: 'none', resize: 'none',
          minHeight: 140
        }}
      />
      {isAdmin && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 10px',
            border: `1px solid ${tokens.line}`,
            fontFamily: tokens.mono, fontSize: 10.5, letterSpacing: '0.04em',
            color: sessionCost > 0 ? tokens.text : tokens.textWhisper,
            background: 'transparent'
          }}>
            <span style={{
              width: 5, height: 5,
              background: sessionCost > 0 ? tokens.claude : tokens.textGhost,
              borderRadius: '50%'
            }} />
            <span style={{
              color: sessionCost > 0 ? tokens.textLoud : 'inherit',
              fontWeight: sessionCost > 0 ? 600 : 400
            }}>
              {formatINR(sessionCost)}
            </span>
            {sessionCalls > 0 && (
              <>
                <span style={{ color: tokens.textGhost, margin: '0 2px' }}>·</span>
                <span>{sessionCalls} call{sessionCalls === 1 ? '' : 's'}</span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
