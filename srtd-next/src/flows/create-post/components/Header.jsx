import React, { useRef } from 'react';
import { Mail, ClipboardPaste, Upload } from 'lucide-react';
import { tokens } from '../../../core/tokens.js';
import { useFormState } from '../formStore.js';
import { useFlowState } from '../flowStore.js';
import { useIsAdmin } from '../../../core/stores/appState';
import { logClick } from '../../../core/bridges/logging.js';
import { openCaptionWorkspace } from '../../../core/bridges/captionWorkspace.js';
import { uploadFile } from '../../../shared/caption-workspace/api.js';

// Import sources. `admin: true` means admin-only (filtered out of
// the list for non-admins — the pill itself stays visible because
// Paste is available to every role). 'Sorted briefs' was removed
// in B5 — the pipeline is the canonical brief → post path.
const IMPORT_SOURCES = [
  { label: 'Paste link or text', hint: 'Article, URL, or raw notes', icon: ClipboardPaste, admin: false, kind: 'paste' },
  { label: 'Gmail',              hint: 'Unprocessed emails from clients', icon: Mail, badge: '2 new', admin: true, kind: 'gmail' },
  { label: 'Upload a file',      hint: 'PDF or image — Claude will read it', icon: Upload, admin: true, kind: 'upload' }
];

export function Header() {
  const importOpen = useFormState(s => s.importOpen);
  const setUI = useFormState(s => s.setUI);
  const setToast = useFormState(s => s.setToast);
  const close = useFlowState(s => s.close);
  const isAdmin = useIsAdmin();
  const fileInputRef = useRef(null);

  // Non-admins see only non-admin sources. As of B5: just Paste.
  const sources = isAdmin ? IMPORT_SOURCES : IMPORT_SOURCES.filter(s => !s.admin);

  const handleFilePicked = async (e) => {
    const file = e.target.files && e.target.files[0];
    // Reset the input value so picking the same file twice still fires change.
    e.target.value = '';
    if (!file) return;

    logClick('upload_file_picked', { size: file.size, type: file.type });
    setToast({ msg: 'Uploading…', sub: file.name });

    const createdBy =
      (window.AppState && window.AppState.user && window.AppState.user.email) || '';
    const result = await uploadFile(file, {
      postId:      null,
      workspaceId: (window.AppState && window.AppState.workspace && window.AppState.workspace.id) || null,
      createdBy
    });

    if (!result || !result.key) {
      logClick('upload_file_failed', { size: file.size, type: file.type });
      setToast({ msg: 'Upload failed, please try again' });
      setTimeout(() => useFormState.getState().clearToast(), 2400);
      return;
    }

    logClick('upload_file_ok', { key: result.key, mediaType: result.media_type });
    useFormState.getState().clearToast();

    const form = useFormState.getState().form;
    openCaptionWorkspace('write', {
      postId: null,
      initialCaption: '',
      attachment: {
        name:      result.filename || file.name,
        size:      file.size,
        type:      file.type,
        key:       result.key,
        mediaType: result.media_type || file.type
      },
      syntheticContext: {
        source: 'create-post-upload',
        title:    form.title    || null,
        pillar:   form.pillar   || null,
        location: form.location || null,
        format:   form.format   || null
      },
      onUse: (generated) => {
        if (typeof generated !== 'string' || !generated.trim()) return;
        const existingCaption = (useFormState.getState().form.caption || '').trim();
        if (existingCaption) {
          const accepted = window.confirm('Replace existing caption with generated version?');
          logClick('caption_overwrite_confirm', { accepted, source: 'upload' });
          if (!accepted) return;
        }
        useFormState.getState().update('caption', generated);
      }
    });
  };

  const handleSourceClick = (src) => {
    logClick('import_option_tap', { kind: src.kind, isAdmin });
    if (src.kind === 'paste') {
      setUI({ importOpen: false, pasteSheetOpen: true });
    } else if (src.kind === 'gmail') {
      setUI({ importOpen: false, gmailSheetOpen: true });
    } else if (src.kind === 'upload') {
      setUI({ importOpen: false });
      if (fileInputRef.current) fileInputRef.current.click();
    }
  };

  return (
    <div style={{
      padding: '22px 22px 16px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      position: 'relative',
      zIndex: 20
    }}>
      <div style={{
        fontFamily: tokens.serif, fontSize: 22, fontWeight: 500,
        letterSpacing: '-0.015em', color: tokens.textLoud
      }}>
        New post
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,image/*"
        style={{ display: 'none' }}
        onChange={handleFilePicked}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {isAdmin && (
        <div style={{ position: 'relative' }} data-dropdown>
          <button
            onClick={(e) => {
              e.stopPropagation();
              const next = !importOpen;
              if (next) logClick('import_open', { isAdmin });
              setUI({ importOpen: next });
            }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '7px 12px',
              border: `1px solid ${importOpen ? tokens.claude : tokens.line}`,
              borderRadius: 999,
              background: importOpen ? tokens.claudeSoft : 'transparent',
              color: importOpen ? tokens.claude : tokens.textSoft,
              fontFamily: tokens.sans, fontSize: 12.5, fontWeight: 500,
              cursor: 'pointer', transition: 'all 0.15s'
            }}>
            <span style={{ color: tokens.claude, fontSize: 12 }}>✦</span>
            Import brief
            <span style={{
              color: importOpen ? tokens.claude : tokens.textWhisper,
              fontFamily: tokens.serif, fontSize: 10, marginLeft: 1,
              display: 'inline-block',
              transform: importOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.15s'
            }}>▾</span>
          </button>

          {importOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0,
              width: 300, background: tokens.ink3, border: `1px solid ${tokens.lineStrong}`,
              borderRadius: 14, overflow: 'hidden',
              boxShadow: '0 2px 4px #0000004D, 0 12px 28px #0000008C',
              zIndex: 30
            }}>
              <div style={{ padding: '12px 14px 8px', borderBottom: `1px solid ${tokens.lineSoft}` }}>
                <div style={{
                  fontFamily: tokens.mono, fontSize: 9, letterSpacing: '0.2em',
                  textTransform: 'uppercase', color: tokens.textWhisper, marginBottom: 3
                }}>
                  ✦ Import brief
                </div>
                <div style={{
                  fontFamily: tokens.serif, fontSize: 14, fontWeight: 500,
                  color: tokens.textLoud, letterSpacing: '-0.005em'
                }}>
                  Where is it?
                </div>
              </div>
              {sources.map((src, i) => {
                const Icon = src.icon;
                return (
                  <button key={src.kind}
                    onClick={() => handleSourceClick(src)}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 12,
                      width: '100%', padding: '12px 14px',
                      background: 'transparent', border: 'none',
                      borderBottom: i < sources.length - 1 ? `1px solid ${tokens.lineSoft}` : 'none',
                      cursor: 'pointer', textAlign: 'left'
                    }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 7,
                      background: tokens.ink1, border: `1px solid ${tokens.line}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: tokens.textSoft, flexShrink: 0, marginTop: 1
                    }}>
                      <Icon size={14} strokeWidth={1.5} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontFamily: tokens.serif, fontSize: 14.5, fontWeight: 500,
                        color: tokens.textLoud, letterSpacing: '-0.01em', marginBottom: 1
                      }}>
                        {src.label}
                      </div>
                      <div style={{ fontFamily: tokens.sans, fontSize: 12, color: tokens.textSoft, lineHeight: 1.4 }}>
                        {src.hint}
                      </div>
                    </div>
                    {src.badge && (
                      <div style={{
                        fontFamily: tokens.mono, fontSize: 9, fontWeight: 600,
                        letterSpacing: '0.12em', textTransform: 'uppercase',
                        color: tokens.claude, padding: '2px 6px',
                        background: tokens.claudeSoft, border: `1px solid ${tokens.claudeBorder}`,
                        borderRadius: 4, flexShrink: 0, alignSelf: 'center'
                      }}>
                        {src.badge}
                      </div>
                    )}
                  </button>
                );
              })}
              <div style={{
                padding: '10px 14px', background: tokens.ink2,
                borderTop: `1px solid ${tokens.lineSoft}`,
                fontFamily: tokens.sans, fontSize: 11.5, color: tokens.textSoft,
                display: 'flex', alignItems: 'center', gap: 8
              }}>
                <span style={{ color: tokens.claude, fontSize: 11 }}>✦</span>
                <span>{isAdmin
                  ? <>Claude reads it and pre-fills <em style={{ fontStyle: 'italic', color: tokens.textWhisper }}>title, pillar, date, caption</em>.</>
                  : <>Paste raw brief text into Internal Notes.</>
                }</span>
              </div>
            </div>
          )}
        </div>
        )}

        <button
          aria-label="Close"
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
    </div>
  );
}
