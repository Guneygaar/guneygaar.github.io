// Zustand store for the React Caption Workspace.
//
// Mounted once at App level; consumers call open()/close() to
// toggle the full-screen overlay. Purely React state — no DOM
// coupling to the vanilla #caption-workspace-overlay element.

import { create } from 'zustand';
import { callSrtdAI, calcCostINR } from './api.js';
import { buildWritePrompt } from './systemPrompts.js';

const initialState = {
  isOpen: false,
  mode: null,             // 'write' | 'chat'
  context: null,          // { title, pillar, location, format, brief, initialCaption, source }
  messages: [],           // [{ role:'user'|'assistant', content, _display? }]
  isSending: false,
  sessionCost: 0,
  onUse: null,
  onClose: null
};

export const useCaptionWorkspaceStore = create((set, get) => ({
  ...initialState,

  open: async (mode, opts = {}) => {
    const ctx = {
      title: opts.title || (opts.syntheticContext && opts.syntheticContext.title) || '',
      pillar: opts.pillar || (opts.syntheticContext && opts.syntheticContext.pillar) || '',
      location: opts.location || (opts.syntheticContext && opts.syntheticContext.location) || '',
      format: opts.format || (opts.syntheticContext && opts.syntheticContext.format) || '',
      brief: (opts.syntheticContext && opts.syntheticContext.brief) || '',
      initialCaption: opts.initialCaption || '',
      source: (opts.syntheticContext && opts.syntheticContext.source) || 'react-workspace'
    };

    set({
      isOpen: true,
      mode: mode === 'write' ? 'write' : 'chat',
      context: ctx,
      messages: [],
      isSending: false,
      sessionCost: 0,
      onUse: typeof opts.onUse === 'function' ? opts.onUse : null,
      onClose: typeof opts.onClose === 'function' ? opts.onClose : null
    });

    if (mode === 'write') {
      const prompt = buildWritePrompt(ctx);
      await get()._send(prompt, 'writer');
    }
  },

  close: () => {
    const cb = get().onClose;
    set({ ...initialState });
    if (typeof cb === 'function') {
      try { cb(); } catch (e) { /* ignore */ }
    }
  },

  sendUserMessage: async (text) => {
    const trimmed = (text || '').trim();
    if (!trimmed || get().isSending) return;
    const mode = get().mode;
    const feature = mode === 'write' ? 'writer' : 'chat';
    await get()._send(trimmed, feature);
  },

  _send: async (userText, feature) => {
    const prior = get().messages;
    const nextMsgs = prior.concat([{ role: 'user', content: userText }]);
    set({ messages: nextMsgs, isSending: true });

    const apiMessages = nextMsgs
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role, content: m.content }));

    const result = await callSrtdAI(feature, apiMessages, null);

    if (result && result.success) {
      const inTok = result.input_tokens || (result.usage && result.usage.input) || 0;
      const outTok = result.output_tokens || (result.usage && result.usage.output) || 0;
      const cost = calcCostINR(inTok, outTok);
      set({
        messages: nextMsgs.concat([{ role: 'assistant', content: result.content || '' }]),
        sessionCost: get().sessionCost + cost,
        isSending: false
      });
    } else {
      const errMsg = (result && result.error) || 'Request failed. Try again.';
      set({
        messages: nextMsgs.concat([{ role: 'assistant', content: 'Error: ' + errMsg, _error: true }]),
        isSending: false
      });
      if (typeof window !== 'undefined' && typeof window.logError === 'function') {
        window.logError(errMsg, '', 'react-caption-workspace-' + feature);
      }
    }
  },

  applyDraft: (text) => {
    const cb = get().onUse;
    if (typeof cb === 'function' && typeof text === 'string' && text.trim()) {
      try { cb(text); } catch (e) {
        if (typeof window !== 'undefined' && typeof window.logError === 'function') {
          window.logError(e && e.message, e && e.stack, 'react-caption-workspace-onuse');
        }
      }
    }
    get().close();
  }
}));
