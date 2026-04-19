// Zustand store for Caption Workspace (React-native, replaces
// vanilla window._captionWS). Drives the overlay, message thread,
// cost meter, and all AI call flows (angles → draft → finalise →
// review → rewrite → use-this).

import { create } from 'zustand';
import {
  callSrtdAI, fetchTodayMonthCosts, fetchAnthropicMonthCost, loadMemory,
  saveUserInstruction, saveCorrection
} from './api.js';
import {
  buildAnglesPrompt, buildWritePrompt, buildRefinePrompt,
  buildReviewPrompt, buildRewritePrompt, buildTitleSynthPrompt,
  buildRewriteFromCommentsPrompt, buildVanillaWriteOptionsPrompt
} from './systemPrompts.js';
import {
  calcCostINR, parseJsonLoose, extractCaption, MEMORY_REGEX,
  splitOptions
} from './utils.js';

let _msgSeq = 0;
const _id = (prefix) => `${prefix}_${Date.now()}_${++_msgSeq}`;

// Spread into callSrtdAI opts so an uploaded PDF/image rides every
// AI call until the workspace closes. No-op when no attachment is set.
function _attachmentOpts(st) {
  const a = st && st.attachment;
  if (!a || !a.key) return {};
  return { fileKey: a.key, mediaType: a.mediaType || a.type || '' };
}

function _initialState() {
  return {
    isOpen: false,
    mode: null,                   // 'write' | 'chat' | 'resume'
    context: null,
    syntheticTitle: '',
    brief: '',
    briefSource: null,            // 'paste' | 'gmail' | 'upload' | 'synthesised' | null
    attachment: null,             // {name, size, type, blob, key, mediaType} | null
    headerExpanded: false,
    messages: [],                 // [{id, role, content, meta?, _display?}]
    isSending: false,
    sessionCost: 0,
    todayCost: 0,
    monthCost: 0,
    memoryPrompt: '',
    correctionsPrompt: '',
    onUseCallback: null,
    onCloseCallback: null,
    postId: null,
    createdBy: ''
  };
}

export const useCaptionWorkspaceStore = create((set, get) => ({
  ..._initialState(),

  // ─── lifecycle ────────────────────────────────────────────
  open(mode, opts = {}) {
    // PR 2: PCS-driven modes ('qc' | 'rewrite' | 'write-options')
    // open the workspace with seed state then fire one async step
    // through callSrtdAI/runReview so existing renderers handle the
    // results without changes to Thread.jsx.
    if (mode === 'qc' || mode === 'rewrite' || mode === 'write-options') {
      _openPcsMode(get, set, mode, opts);
      return;
    }

    const brief = (opts.syntheticContext && opts.syntheticContext.brief) || '';
    const briefSource = brief ? (opts.syntheticContext.source || 'paste').replace('create-post-', '') : null;
    const createdBy =
      (window.AppState && window.AppState.user && window.AppState.user.email) || '';

    set({
      ..._initialState(),
      isOpen: true,
      mode,
      context: opts,
      brief,
      briefSource,
      attachment: opts.attachment || null,
      headerExpanded: !!brief,
      syntheticTitle: (opts.title || (opts.syntheticContext && opts.syntheticContext.title) || '').trim(),
      onUseCallback: typeof opts.onUse === 'function' ? opts.onUse : null,
      onCloseCallback: typeof opts.onClose === 'function' ? opts.onClose : null,
      postId: opts.postId || null,
      createdBy
    });

    // Hydrate memory, totals, synth-title, and angles in parallel.
    loadMemory().then((m) => set(m));
    fetchTodayMonthCosts(createdBy).then((c) => set({
      todayCost: c.todayCostINR || 0,
      monthCost: c.monthCostINR || 0
    }));
    // Real org-wide Anthropic month spend overrides the ai_usage
    // seed when the Admin API responds with a number. Null → keep
    // the ai_usage estimate already set above.
    fetchAnthropicMonthCost().then((inr) => {
      if (inr != null) set({ monthCost: inr });
    });

    if (brief) {
      // Synth a short title on first open.
      callSrtdAI('write', buildTitleSynthPrompt(brief), { createdBy })
        .then((r) => {
          if (r && r.success && r.content) {
            const t = r.content.split('\n')[0].trim();
            if (t) set({ syntheticTitle: t });
          }
        });
      // Auto-fire angles.
      get().requestAngles();
    } else if (opts.initialCaption) {
      // Manual ⤢ path — push the current caption as a starter "draft"
      // so the user can refine it from an existing string.
      const draftMsg = {
        id: _id('draft'),
        role: 'assistant',
        content: opts.initialCaption,
        meta: { type: 'draft', fromAngle: 0, content: opts.initialCaption }
      };
      set((s) => ({ messages: [...s.messages, draftMsg] }));
    }
  },

  close() {
    const { onCloseCallback } = get();
    set({ isOpen: false });
    if (typeof onCloseCallback === 'function') {
      try { onCloseCallback(); } catch (e) {}
    }
    // Reset after fade-out
    setTimeout(() => set(_initialState()), 320);
  },

  toggleHeader() {
    set((s) => ({ headerExpanded: !s.headerExpanded }));
  },

  updateBrief(text) {
    set({ brief: String(text || '') });
  },

  // Store a file attachment that was already uploaded to /ai/upload.
  // `key` + `mediaType` are what the Worker needs; `name`/`size`/`type`
  // drive the attachment chip in Header.jsx. Pass null to clear.
  setAttachment(next) {
    if (!next) { set({ attachment: null }); return; }
    set({
      attachment: {
        name:      next.name      || '',
        size:      Number(next.size) || 0,
        type:      next.type      || '',
        blob:      next.blob      || null,
        key:       next.key       || '',
        mediaType: next.mediaType || next.type || ''
      }
    });
  },

  // ─── angles ──────────────────────────────────────────────
  async requestAngles() {
    const { brief, context, memoryPrompt, createdBy } = get();
    if (!brief) return;
    set({ isSending: true });
    const prompt = buildAnglesPrompt(brief, {
      title: (context && context.syntheticContext && context.syntheticContext.title) || '',
      pillar: (context && context.syntheticContext && context.syntheticContext.pillar) || ''
    });
    const r = await callSrtdAI('angles', prompt, {
      createdBy,
      memoryContext: memoryPrompt || undefined,
      ..._attachmentOpts(get())
    });
    set({ isSending: false });
    if (!r || !r.success) {
      _pushErrorToast(get(), 'Could not fetch angles — check error log');
      return;
    }
    _addCost(get, set, r);
    const parsed = parseJsonLoose(r.content);
    const angles = (parsed && Array.isArray(parsed.angles)) ? parsed.angles.slice(0, 3) : [];
    if (angles.length === 0) return;
    set((s) => ({
      messages: [...s.messages, {
        id: _id('angles'),
        role: 'assistant',
        meta: { type: 'angles', angles }
      }]
    }));
  },

  // ─── draft request (tap an angle) ────────────────────────
  async requestDraftFromAngle(anglesMsgId, angleIdx) {
    const st = get();
    const anglesMsg = st.messages.find((m) => m.id === anglesMsgId);
    if (!anglesMsg || !anglesMsg.meta) return;
    const angle = anglesMsg.meta.angles[angleIdx];
    if (!angle) return;
    set((s) => ({
      messages: [...s.messages, {
        id: _id('user'),
        role: 'user',
        content: `Expand Angle ${angleIdx + 1} — ${angle.title}`
      }],
      isSending: true
    }));
    const prompt = buildWritePrompt(st.brief, angle, {
      title: st.syntheticTitle,
      corrections: st.correctionsPrompt
    });
    const r = await callSrtdAI('write', prompt, {
      createdBy: st.createdBy,
      memoryContext: st.memoryPrompt || undefined,
      ..._attachmentOpts(st)
    });
    set({ isSending: false });
    if (!r || !r.success) {
      _pushErrorToast(get(), 'Draft generation failed — check error log');
      return;
    }
    _addCost(get, set, r);
    const content = extractCaption(r.content || '');
    set((s) => ({
      messages: [...s.messages, {
        id: _id('draft'),
        role: 'assistant',
        content,
        meta: { type: 'draft', fromAngle: angleIdx + 1, content }
      }]
    }));
  },

  // ─── refine chip ─────────────────────────────────────────
  async applyRefineChip(draftMsgId, type) {
    const st = get();
    const draft = st.messages.find((m) => m.id === draftMsgId);
    if (!draft || !draft.meta) return;
    set((s) => ({
      messages: [...s.messages, {
        id: _id('user'),
        role: 'user',
        content: `Make draft ${draft.meta.fromAngle || ''} ${type}`.trim()
      }],
      isSending: true
    }));
    const prompt = buildRefinePrompt(draft.meta.content, type);
    const r = await callSrtdAI('refine', prompt, {
      createdBy: st.createdBy,
      memoryContext: st.memoryPrompt || undefined,
      ..._attachmentOpts(st)
    });
    set({ isSending: false });
    if (!r || !r.success) {
      _pushErrorToast(get(), 'Refine failed — check error log');
      return;
    }
    _addCost(get, set, r);
    const content = extractCaption(r.content || '');
    set((s) => ({
      messages: [...s.messages, {
        id: _id('draft'),
        role: 'assistant',
        content,
        meta: {
          type: 'draft',
          fromAngle: draft.meta.fromAngle,
          refinedFrom: draftMsgId,
          refineType: type,
          content
        }
      }]
    }));
  },

  // ─── edit a draft in place (contenteditable onBlur) ─────
  updateDraftContent(draftMsgId, nextContent) {
    set((s) => ({
      messages: s.messages.map((m) => (m.id === draftMsgId
        ? { ...m, content: nextContent, meta: { ...m.meta, content: nextContent } }
        : m
      ))
    }));
  },

  // ─── finalise ───────────────────────────────────────────
  finaliseDraft(draftMsgId) {
    const st = get();
    const draft = st.messages.find((m) => m.id === draftMsgId);
    if (!draft || !draft.meta) return;
    set((s) => ({
      messages: s.messages.map((m) => (m.id === draftMsgId
        ? { ...m, meta: { ...m.meta, finalised: true } }
        : m
      ))
    }));
  },

  // ─── review ─────────────────────────────────────────────
  async runReview(targetMsgId) {
    const st = get();
    const target = st.messages.find((m) => m.id === targetMsgId);
    if (!target || !target.meta) return;
    set((s) => ({
      messages: [...s.messages, {
        id: _id('user'),
        role: 'user',
        content: `Review draft ${target.meta.fromAngle || ''}`.trim()
      }],
      isSending: true
    }));
    const r = await callSrtdAI('review', buildReviewPrompt(target.meta.content), {
      createdBy: st.createdBy,
      memoryContext: st.memoryPrompt || undefined,
      ..._attachmentOpts(st)
    });
    set({ isSending: false });
    if (!r || !r.success) {
      _pushErrorToast(get(), 'Review failed — check error log');
      return;
    }
    _addCost(get, set, r);
    const parsed = parseJsonLoose(r.content);
    const items = (parsed && Array.isArray(parsed.items)) ? parsed.items : [];
    const flagsChecked = {};
    items.forEach((it, i) => { if (it.mark === 'FLAG') flagsChecked[i] = true; });
    const allPass = items.every((it) => it.mark === 'PASS');
    set((s) => ({
      messages: [
        ...s.messages.map((m) => (m.id === targetMsgId
          ? { ...m, meta: { ...m.meta, allPass } }
          : m
        )),
        {
          id: _id('review'),
          role: 'assistant',
          meta: { type: 'review', items, targetId: targetMsgId, flagsChecked }
        }
      ]
    }));
  },

  toggleReviewFlag(reviewMsgId, flagIdx) {
    set((s) => ({
      messages: s.messages.map((m) => {
        if (m.id !== reviewMsgId) return m;
        const next = { ...(m.meta.flagsChecked || {}) };
        next[flagIdx] = !next[flagIdx];
        return { ...m, meta: { ...m.meta, flagsChecked: next } };
      })
    }));
  },

  async regenerateFromFlags(reviewMsgId) {
    const st = get();
    const review = st.messages.find((m) => m.id === reviewMsgId);
    if (!review || !review.meta) return;
    const target = st.messages.find((m) => m.id === review.meta.targetId);
    if (!target || !target.meta) return;
    const checked = review.meta.items
      .map((it, i) => ({ it, i }))
      .filter(({ it, i }) => it.mark === 'FLAG' && review.meta.flagsChecked[i])
      .map(({ it }) => it);
    if (checked.length === 0) return;
    set({ isSending: true });
    const r = await callSrtdAI('rewrite', buildRewritePrompt(target.meta.content, checked), {
      createdBy: st.createdBy,
      memoryContext: st.memoryPrompt || undefined,
      ..._attachmentOpts(st)
    });
    set({ isSending: false });
    if (!r || !r.success) {
      _pushErrorToast(get(), 'Rewrite failed — check error log');
      return;
    }
    _addCost(get, set, r);
    const content = extractCaption(r.content || '');
    set((s) => ({
      messages: [...s.messages, {
        id: _id('draft'),
        role: 'assistant',
        content,
        meta: {
          type: 'draft',
          fromAngle: target.meta.fromAngle,
          rewrittenFrom: target.id,
          flagsAddressedCount: checked.length,
          content
        }
      }]
    }));
  },

  // ─── free-form user message (chat / memorize) ────────────
  async sendUserMessage(text) {
    const trimmed = String(text || '').trim();
    if (!trimmed) return;

    // Memory shortcut — memorize: / remember: / rule: etc. → save
    // to ai_memory and render a MemorizedRow. No /ai/complete call.
    const m = trimmed.match(MEMORY_REGEX);
    if (m && (m[2] || '').trim().length > 3) {
      const instruction = m[2].trim();
      saveUserInstruction(instruction, { postId: get().postId });
      set((s) => ({
        memoryPrompt:
          (s.memoryPrompt ? s.memoryPrompt + '\n\n' : '') +
          'USER INSTRUCTION: ' + instruction,
        messages: [
          ...s.messages,
          { id: _id('user'),     role: 'user',    content: trimmed },
          { id: _id('memorized'), role: 'memory', content: '\u2726 Locked in. Claude will follow this rule in every future session.' }
        ]
      }));
      return;
    }

    set((s) => ({
      messages: [...s.messages, { id: _id('user'), role: 'user', content: trimmed }],
      isSending: true
    }));

    const r = await callSrtdAI('write', trimmed, {
      createdBy: get().createdBy,
      memoryContext: get().memoryPrompt || undefined,
      ..._attachmentOpts(get())
    });
    set({ isSending: false });
    if (!r || !r.success) {
      _pushErrorToast(get(), 'Reply failed — check error log');
      return;
    }
    _addCost(get, set, r);
    const content = extractCaption(r.content || '');
    set((s) => ({
      messages: [...s.messages, {
        id: _id('draft'),
        role: 'assistant',
        content,
        meta: { type: 'draft', fromAngle: 0, content }
      }]
    }));
  },

  // ─── Use this ───────────────────────────────────────────
  useThis(msgId, explicitText) {
    const st = get();
    const msg = st.messages.find((m) => m.id === msgId);
    const text = (typeof explicitText === 'string' && explicitText)
      ? explicitText
      : ((msg && msg.meta && msg.meta.content) || (msg && msg.content) || '');
    if (!text) return;
    const original = (st.context && st.context.initialCaption) || '';
    if (original && original.trim() !== text.trim()) {
      saveCorrection(original, text, { postId: st.postId });
    }
    if (typeof st.onUseCallback === 'function') {
      try { st.onUseCallback(text); } catch (e) {}
    }
    if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
      try { window.showToast('Caption added', 'success'); } catch (e) {}
    }
    get().close();
  }
}));

// ─── helpers ──────────────────────────────────────────────

function _addCost(get, set, r) {
  const inTok = Number(r.input_tokens) || 0;
  const outTok = Number(r.output_tokens) || 0;
  const inr = calcCostINR(inTok, outTok);
  set((s) => ({
    sessionCost: (Number(s.sessionCost) || 0) + inr,
    todayCost:   (Number(s.todayCost)   || 0) + inr,
    monthCost:   (Number(s.monthCost)   || 0) + inr
  }));
}

// PR 2: PCS-driven open() variants. Seeded synchronously, AI call
// fires async then either pushes a draft / options message or
// auto-runs the QC review on the seeded starter draft.
function _openPcsMode(get, set, mode, opts) {
  const createdBy =
    (typeof window !== 'undefined' && window.AppState && window.AppState.user && window.AppState.user.email) || '';
  set({
    ..._initialState(),
    isOpen: true,
    mode,
    context: opts || {},
    postId: (opts && opts.postId) || null,
    onUseCallback: (opts && typeof opts.onUse === 'function') ? opts.onUse : null,
    onCloseCallback: (opts && typeof opts.onClose === 'function') ? opts.onClose : null,
    createdBy
  });
  loadMemory().then((m) => set(m));
  fetchTodayMonthCosts(createdBy).then((c) => set({
    todayCost: c.todayCostINR || 0,
    monthCost: c.monthCostINR || 0
  }));
  fetchAnthropicMonthCost().then((inr) => {
    if (inr != null) set({ monthCost: inr });
  });

  if (mode === 'qc') {
    const caption = (opts && (opts.initialCaption || (opts.syntheticContext && opts.syntheticContext.caption))) || '';
    const starterId = `starter_${Date.now()}_${++_msgSeq}`;
    set((s) => ({
      messages: [...s.messages, {
        id: starterId,
        role: 'assistant',
        content: caption,
        meta: { type: 'draft', fromAngle: 0, content: caption, finalised: true }
      }]
    }));
    setTimeout(() => { try { get().runReview(starterId); } catch (e) { /* swallow */ } }, 50);
    return;
  }

  if (mode === 'rewrite') {
    const caption = (opts && opts.caption) || '';
    const comments = (opts && Array.isArray(opts.comments)) ? opts.comments : [];
    const prompt = buildRewriteFromCommentsPrompt(caption, comments);
    const display = `Rewrite the caption addressing ${comments.length} comment(s).`;
    set((s) => ({
      messages: [
        ...s.messages,
        { id: `user_${Date.now()}_${++_msgSeq}`, role: 'user', content: display }
      ],
      isSending: true
    }));
    callSrtdAI('rewrite', prompt, { createdBy, postId: opts && opts.postId })
      .then((r) => {
        set({ isSending: false });
        if (!r || !r.success) {
          _pushErrorToast(get(), 'Rewrite failed - check error log');
          return;
        }
        _addCost(get, set, r);
        const text = extractCaption(r.content || '');
        set((s) => ({
          messages: [...s.messages, {
            id: `draft_${Date.now()}_${++_msgSeq}`,
            role: 'assistant',
            content: text,
            meta: { type: 'draft', fromAngle: 0, content: text }
          }]
        }));
      })
      .catch((err) => {
        set({ isSending: false });
        _pushErrorToast(get(), 'Rewrite failed - ' + (err && err.message || ''));
      });
    return;
  }

  if (mode === 'write-options') {
    const sc = (opts && opts.syntheticContext) || {};
    const prompt = buildVanillaWriteOptionsPrompt(sc.brief || '', sc.title || '', (opts && opts.initialCaption) || '');
    set({ isSending: true });
    callSrtdAI('write', prompt, { createdBy, postId: opts && opts.postId })
      .then((r) => {
        set({ isSending: false });
        if (!r || !r.success) {
          _pushErrorToast(get(), 'Write failed - check error log');
          return;
        }
        _addCost(get, set, r);
        const options = splitOptions(r.content || '');
        set((s) => ({
          messages: [...s.messages, {
            id: `opts_${Date.now()}_${++_msgSeq}`,
            role: 'assistant',
            meta: { type: 'options', options }
          }]
        }));
      })
      .catch((err) => {
        set({ isSending: false });
        _pushErrorToast(get(), 'Write failed - ' + (err && err.message || ''));
      });
  }
}

function _pushErrorToast(_st, msg) {
  if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
    try { window.showToast(msg, 'error'); } catch (e) {}
  }
  if (typeof window !== 'undefined' && typeof window.logError === 'function') {
    try { window.logError(msg, '', 'caption-workspace-react'); } catch (e) {}
  }
}
