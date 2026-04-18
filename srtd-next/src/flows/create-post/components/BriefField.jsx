import React from 'react';
import { Field } from '../../../core/ui/index.js';
import { tokens } from '../../../core/tokens.js';
import { useFormState } from '../formStore.js';
import { useIsAdmin } from '../../../core/stores/appState.js';
import { openCaptionWorkspace } from '../../../core/bridges/captionWorkspace.js';
import { logClick } from '../../../core/bridges/logging.js';

// Admin-only inline brief input. Sits directly above the caption
// field. The "✦ Open Caption Workspace →" pill opens the workspace
// immediately with brief + title + internalNotes + caption composed —
// no sheet, no detour.

export function BriefField() {
  const brief = useFormState(s => s.form.brief);
  const update = useFormState(s => s.update);
  const isAdmin = useIsAdmin();

  if (!isAdmin) return null;

  const handleOpenWorkspace = () => {
    const form = useFormState.getState().form;
    const initial = (form.caption || '').trim();

    const briefParts = [];
    if (form.brief && form.brief.trim())                 briefParts.push(form.brief.trim());
    if (form.title && form.title.trim())                 briefParts.push(form.title.trim());
    if (form.internalNotes && form.internalNotes.trim()) briefParts.push(form.internalNotes.trim());
    if (form.caption && form.caption.trim())             briefParts.push(form.caption.trim());
    const composed = briefParts.join('\n\n').trim();

    logClick('caption_workspace_open', {
      hasBrief: !!composed,
      source: 'brief-field-pill',
      isAdmin
    });

    openCaptionWorkspace('write', {
      postId: null,
      initialCaption: initial,
      syntheticContext: {
        source: 'create-post-react',
        pillar: form.pillar || null,
        location: form.location || null,
        format: form.format || null,
        title: form.title || '',
        brief: composed
      },
      onUse: (text) => {
        if (typeof text !== 'string' || !text.trim()) return;
        const existing = (useFormState.getState().form.caption || '').trim();
        if (existing && existing !== text.trim()) {
          const accepted = window.confirm('Replace existing caption with generated version?');
          logClick('caption_overwrite_confirm', { accepted, source: 'brief-field' });
          if (!accepted) return;
        }
        useFormState.getState().update('caption', text);
      },
      onClose: () => {
        try {
          let finalCost = 0;
          if (typeof window.SortedReact?.bridges?.getSessionCost === 'function') {
            finalCost = window.SortedReact.bridges.getSessionCost();
          } else if (window._captionWS && typeof window._captionWS.sessionCost === 'number') {
            finalCost = window._captionWS.sessionCost;
          }
          useFormState.getState().setUI({ sessionCost: finalCost });
        } catch (e) { /* ignore */ }
      }
    });
  };

  const form = useFormState.getState().form;
  const canOpen = !!((brief && brief.trim()) || (form.title && form.title.trim()));

  return (
    <Field num="05" name="Brief for Claude" optional="team-only · not shown to client">
      <textarea
        value={brief}
        onChange={e => update('brief', e.target.value)}
        placeholder="Paste the brief, context, or angle direction here..."
        style={{
          width: '100%', background: 'transparent', border: 'none',
          padding: '8px 0 0',
          fontFamily: tokens.serif, fontStyle: 'italic', fontSize: 14.5,
          lineHeight: 1.6, color: tokens.text,
          outline: 'none', resize: 'none', minHeight: 80
        }}
      />
      <button
        onClick={handleOpenWorkspace}
        disabled={!canOpen}
        style={{
          width: '100%',
          marginTop: 12,
          padding: '12px 16px',
          background: canOpen ? tokens.claudeSoft : 'transparent',
          border: `1px solid ${canOpen ? tokens.claudeBorder : tokens.line}`,
          borderRadius: 999,
          color: canOpen ? tokens.claude : tokens.textGhost,
          fontFamily: tokens.mono, fontSize: 11, fontWeight: 600,
          letterSpacing: '0.12em', textTransform: 'uppercase',
          cursor: canOpen ? 'pointer' : 'not-allowed',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          transition: 'all 0.15s'
        }}>
        <span style={{ fontSize: 12 }}>✦</span>
        Open Caption Workspace
        <span style={{ fontFamily: tokens.serif, fontSize: 13 }}>→</span>
      </button>
    </Field>
  );
}
