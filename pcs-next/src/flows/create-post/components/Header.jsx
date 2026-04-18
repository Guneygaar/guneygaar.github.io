import React from 'react';
import { FileText, Mail, ClipboardPaste, Upload } from 'lucide-react';
import { tokens } from '../../../core/tokens.js';
import { useFormState } from '../formStore.js';
import { useFlowState } from '../flowStore.js';

const IMPORT_SOURCES = [
  { label: 'Sorted briefs', hint: 'Briefs your team logged in-app', icon: FileText, badge: '3 new' },
  { label: 'Gmail', hint: 'Unprocessed emails from clients', icon: Mail, badge: '2 new' },
  { label: 'Paste link or text', hint: 'Article, URL, or raw notes', icon: ClipboardPaste },
  { label: 'Upload a file', hint: 'PDF, Word doc, or text file', icon: Upload }
];

export function Header() {
  const importOpen = useFormState(s => s.importOpen);
  const setUI = useFormState(s => s.setUI);
  const setToast = useFormState(s => s.setToast);
  const close = useFlowState(s => s.close);

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

      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ position: 'relative' }} data-dropdown>
          <button
            onClick={(e) => { e.stopPropagation(); setUI({ importOpen: !importOpen }); }}
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
              {IMPORT_SOURCES.map((src, i) => {
                const Icon = src.icon;
                return (
                  <button key={i}
                    onClick={() => {
                      setToast({ msg: `${src.label} selected`, sub: 'B3 wires this up' });
                      setUI({ importOpen: false });
                      setTimeout(() => useFormState.getState().clearToast(), 1800);
                    }}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 12,
                      width: '100%', padding: '12px 14px',
                      background: 'transparent', border: 'none',
                      borderBottom: i < IMPORT_SOURCES.length - 1 ? `1px solid ${tokens.lineSoft}` : 'none',
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
                <span>Claude reads it and pre-fills <em style={{ fontStyle: 'italic', color: tokens.textWhisper }}>title, pillar, date, caption</em>.</span>
              </div>
            </div>
          )}
        </div>

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
