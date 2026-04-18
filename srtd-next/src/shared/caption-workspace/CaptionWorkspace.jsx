import React, { useEffect, useRef, useState } from 'react';
import { X, Send, Sparkles, Check } from 'lucide-react';
import { tokens } from '../../core/tokens.js';
import { useCaptionWorkspaceStore } from './store.js';
import { formatINR } from './api.js';

// Extracts the user-facing caption from a raw assistant message.
// Matches the vanilla extractor closely enough for v1 — tag-based
// first, then strips common preambles / footers.
function extractCaption(raw) {
  let text = raw || '';
  const tagMatches = [];
  const tagRe = /<caption>([\s\S]*?)<\/caption>/gi;
  let m;
  while ((m = tagRe.exec(text)) !== null) tagMatches.push(m[1]);
  if (tagMatches.length) return tagMatches[tagMatches.length - 1].trim();

  const sepIdx = text.lastIndexOf('\n---\n');
  if (sepIdx !== -1) text = text.substring(sepIdx + 5);

  text = text.replace(
    /^\s*\*{0,2}(REVISED|UPDATED|REWRITTEN|NEW|CORRECTED|HERE'S THE|HERE IS THE|FINAL)[\s\w]*:?\*{0,2}\s*\n/i,
    ''
  );
  text = text.replace(/\n\s*\*{0,2}(Key improvements|Key changes|Changes made|Summary|Notes|Improvements|Changes)[\s:]*\*{0,2}\s*\n[\s\S]*/i, '');
  text = text.replace(/\*\*/g, '');
  return text.trim();
}

// Split a numbered assistant response (e.g. "1. foo\n2. bar\n3. baz")
// into discrete option blocks. Falls back to a single option when
// the numbering isn't detected.
function splitOptions(raw) {
  const text = (raw || '').trim();
  if (!text) return [];
  const parts = text.split(/\n\s*(?=(?:Option\s*)?[1-9]\s*[.\):]\s)/i)
    .map(p => p.replace(/^\s*(?:Option\s*)?[1-9]\s*[.\):]\s*/i, '').trim())
    .filter(Boolean);
  return parts.length ? parts : [text];
}

export function CaptionWorkspace() {
  const isOpen = useCaptionWorkspaceStore(s => s.isOpen);
  const mode = useCaptionWorkspaceStore(s => s.mode);
  const context = useCaptionWorkspaceStore(s => s.context);
  const messages = useCaptionWorkspaceStore(s => s.messages);
  const isSending = useCaptionWorkspaceStore(s => s.isSending);
  const sessionCost = useCaptionWorkspaceStore(s => s.sessionCost);
  const close = useCaptionWorkspaceStore(s => s.close);
  const sendUserMessage = useCaptionWorkspaceStore(s => s.sendUserMessage);
  const applyDraft = useCaptionWorkspaceStore(s => s.applyDraft);

  const [input, setInput] = useState('');
  const [animIn, setAnimIn] = useState(false);
  const threadRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      const id = requestAnimationFrame(() => setAnimIn(true));
      return () => cancelAnimationFrame(id);
    }
    setAnimIn(false);
    setInput('');
  }, [isOpen]);

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages.length, isSending]);

  if (!isOpen) return null;

  const handleSend = () => {
    const t = input.trim();
    if (!t || isSending) return;
    sendUserMessage(t);
    setInput('');
  };

  const title = (context && context.title) || 'New post — no title yet';

  return (
    <div
      style={{
        position: 'fixed',
        left: 0, right: 0, top: 0, bottom: 0,
        background: tokens.ink1,
        zIndex: 9600,
        display: 'flex',
        flexDirection: 'column',
        transform: animIn ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 280ms ease',
        fontFamily: tokens.sans,
        color: tokens.text
      }}
    >
      {/* Header */}
      <div style={{
        padding: '14px 18px',
        borderBottom: `1px solid ${tokens.lineSoft}`,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexShrink: 0
      }}>
        <button
          onClick={close}
          aria-label="Close"
          style={{
            width: 32, height: 32,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'transparent',
            border: `1px solid ${tokens.line}`,
            color: tokens.textSoft,
            cursor: 'pointer',
            padding: 0
          }}
        >
          <X size={15} strokeWidth={1.7} />
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: tokens.mono,
            fontSize: 9.5,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: tokens.textWhisper,
            marginBottom: 2
          }}>
            <span style={{ color: tokens.claude }}>✦</span>{' '}
            Caption Workspace · {mode === 'write' ? 'Write' : 'Chat'}
          </div>
          <div style={{
            fontFamily: tokens.serif,
            fontSize: 14,
            color: tokens.textLoud,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {title}
          </div>
        </div>

        <div style={{
          fontFamily: tokens.mono,
          fontSize: 10,
          letterSpacing: '0.08em',
          padding: '5px 9px',
          border: `1px solid ${tokens.line}`,
          color: sessionCost > 0 ? tokens.textLoud : tokens.textWhisper,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          flexShrink: 0
        }}>
          <span style={{
            width: 5, height: 5,
            background: sessionCost > 0 ? tokens.claude : tokens.textGhost,
            borderRadius: '50%'
          }} />
          {formatINR(sessionCost)}
        </div>
      </div>

      {/* Thread */}
      <div
        ref={threadRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '18px 18px 10px',
          maxWidth: 480,
          width: '100%',
          margin: '0 auto'
        }}
      >
        {context && context.initialCaption && (
          <div style={{
            padding: '10px 12px',
            border: `1px solid ${tokens.line}`,
            marginBottom: 16,
            background: tokens.ink2
          }}>
            <div style={{
              fontFamily: tokens.mono,
              fontSize: 9,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: tokens.textWhisper,
              marginBottom: 6
            }}>Current caption</div>
            <div style={{
              fontFamily: tokens.serif,
              fontSize: 14,
              lineHeight: 1.55,
              color: tokens.text,
              whiteSpace: 'pre-wrap'
            }}>{context.initialCaption}</div>
          </div>
        )}

        {messages.length === 0 && !isSending && (
          <div style={{
            padding: '48px 12px',
            textAlign: 'center',
            color: tokens.textWhisper
          }}>
            <Sparkles size={20} strokeWidth={1.5} style={{ color: tokens.claude, marginBottom: 10 }} />
            <div style={{
              fontFamily: tokens.serif,
              fontSize: 15,
              color: tokens.textSoft,
              lineHeight: 1.55
            }}>
              Ask anything about this caption, or let Claude write one for you.
            </div>
          </div>
        )}

        {messages.map((m, i) => {
          const isUser = m.role === 'user';
          const isLatest = i === messages.length - 1 && m.role === 'assistant' && !m._error;
          if (isUser) {
            return (
              <div key={i} style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
                <div style={{
                  maxWidth: '85%',
                  padding: '10px 13px',
                  background: tokens.claudeSoft,
                  border: `1px solid ${tokens.claudeBorder}`,
                  fontFamily: tokens.sans,
                  fontSize: 14,
                  lineHeight: 1.5,
                  color: tokens.textLoud,
                  whiteSpace: 'pre-wrap'
                }}>{m._display || m.content}</div>
              </div>
            );
          }

          const options = mode === 'write' && isLatest ? splitOptions(m.content) : [m.content];

          return (
            <div key={i} style={{ marginBottom: 18 }}>
              <div style={{
                fontFamily: tokens.mono,
                fontSize: 9.5,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: tokens.textWhisper,
                marginBottom: 8
              }}>
                <span style={{ color: tokens.claude }}>✦</span> Claude
              </div>
              {options.map((opt, oi) => {
                const captionText = extractCaption(opt);
                const showUse = isLatest && !m._error && !!captionText;
                return (
                  <div key={oi} style={{
                    padding: '12px 14px',
                    border: `1px solid ${tokens.line}`,
                    marginBottom: 8,
                    background: tokens.ink2
                  }}>
                    <div style={{
                      fontFamily: tokens.serif,
                      fontSize: 14.5,
                      lineHeight: 1.6,
                      color: m._error ? tokens.danger : tokens.textLoud,
                      whiteSpace: 'pre-wrap'
                    }}>{opt}</div>
                    {showUse && (
                      <div style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        marginTop: 10,
                        paddingTop: 8,
                        borderTop: `1px solid ${tokens.lineSoft}`
                      }}>
                        <button
                          onClick={() => applyDraft(captionText)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '8px 14px',
                            background: tokens.claude,
                            border: 'none',
                            color: '#FFFFFF',
                            fontFamily: tokens.mono,
                            fontSize: 11,
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            cursor: 'pointer',
                            minHeight: 36
                          }}
                        >
                          <Check size={13} strokeWidth={2} />
                          Use this
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}

        {isSending && (
          <div style={{
            display: 'flex',
            gap: 5,
            padding: '10px 4px',
            alignItems: 'center'
          }}>
            {[0, 1, 2].map(i => (
              <span key={i} style={{
                width: 6, height: 6,
                background: tokens.textWhisper,
                borderRadius: '50%',
                animation: `cw-pulse 1.2s ease-in-out ${i * 0.18}s infinite`
              }} />
            ))}
          </div>
        )}
      </div>

      {/* Composer */}
      <div style={{
        borderTop: `1px solid ${tokens.lineSoft}`,
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'flex-end',
        gap: 10,
        flexShrink: 0,
        background: tokens.ink1,
        maxWidth: 480,
        width: '100%',
        margin: '0 auto',
        boxSizing: 'border-box'
      }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={mode === 'write' ? 'Refine, or type a new instruction…' : 'Ask Claude anything about this caption…'}
          rows={1}
          style={{
            flex: 1,
            resize: 'none',
            background: tokens.ink2,
            border: `1px solid ${tokens.line}`,
            color: tokens.textLoud,
            fontFamily: tokens.sans,
            fontSize: 14,
            lineHeight: 1.4,
            padding: '10px 12px',
            outline: 'none',
            maxHeight: 120,
            minHeight: 40
          }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isSending}
          aria-label="Send"
          style={{
            width: 40, height: 40,
            background: input.trim() && !isSending ? tokens.claude : tokens.ink3,
            border: 'none',
            color: input.trim() && !isSending ? '#FFFFFF' : tokens.textWhisper,
            cursor: input.trim() && !isSending ? 'pointer' : 'default',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            flexShrink: 0,
            transition: 'background 0.12s'
          }}
        >
          <Send size={15} strokeWidth={1.7} />
        </button>
      </div>

      <style>{`
        @keyframes cw-pulse {
          0%, 80%, 100% { opacity: 0.25; transform: scale(0.85); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
