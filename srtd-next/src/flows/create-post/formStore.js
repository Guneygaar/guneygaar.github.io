// All Create Post form fields. Reset on open and on successful
// submit. Draft persistence added in B4: every form.update triggers
// a debounced save to localStorage (key sorted_create_post_draft_v1);
// createPostFlow.open() hydrates from it; Footer.handleSubmit clears
// it on success. Cancel/Esc/backdrop close do NOT clear the draft —
// accidental taps shouldn't lose typed input.

import { create } from 'zustand';

const DRAFT_KEY = 'sorted_create_post_draft_v1';
let _saveTimer = null;

function _saveDraftDebounced(form) {
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(form)); } catch (e) {}
  }, 800);
}

export function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

export function clearDraft() {
  clearTimeout(_saveTimer);
  try { localStorage.removeItem(DRAFT_KEY); } catch (e) {}
}

function initialForm() {
  return {
    title: '',
    owner: 'Admin',
    stage: 'In production',
    pillar: '',
    format: 'Photo',
    location: '',
    targetDate: new Date().toISOString().split('T')[0],
    brief: '',
    caption: '',
    photos: [],
    driveLink: '',
    internalNotes: ''
  };
}

export const useFormState = create((set, get) => ({
  form: initialForm(),

  // UI-only state — kept alongside form for convenience
  importOpen: false,
  ownerOpen: false,
  stageOpen: false,
  pillarOpen: false,
  formatOpen: false,
  locationOpen: false,
  submitting: false,
  toast: null,
  sessionCost: 0,
  sessionCalls: 0,
  sessionStart: new Date().toISOString(),

  // B5 import-brief sheets. Independent of the dropdown panel
  // state (importOpen) — closing the Import pill dropdown opens
  // one of these sheets.
  pasteSheetOpen: false,
  gmailSheetOpen: false,

  // B5.5a.1 draft-restore banner state. createPostFlow.open() sets
  // pendingDraft instead of auto-populating the form, so the user
  // chooses Restore/Start fresh explicitly.
  pendingDraft: null,

  update: (field, value) => {
    set(s => ({ form: { ...s.form, [field]: value } }));
    _saveDraftDebounced(get().form);
  },
  reset: () => set({
    form: initialForm(),
    importOpen: false, ownerOpen: false, stageOpen: false,
    pillarOpen: false, formatOpen: false, locationOpen: false,
    submitting: false, toast: null,
    sessionStart: new Date().toISOString(),
    sessionCost: 0,
    sessionCalls: 0,
    pasteSheetOpen: false,
    gmailSheetOpen: false
  }),
  closeAllDropdowns: () => set({
    importOpen: false, ownerOpen: false, stageOpen: false,
    pillarOpen: false, formatOpen: false, locationOpen: false
  }),
  setUI: (partial) => set(partial),
  setSessionCost: (n) => set({ sessionCost: n }),
  setToast: (toast) => set({ toast }),
  clearToast: () => set({ toast: null }),

  acceptDraft: () => {
    const d = get().pendingDraft;
    if (d && typeof d === 'object') {
      set({ form: d, pendingDraft: null });
    } else {
      set({ pendingDraft: null });
    }
  },
  dismissDraft: () => {
    clearDraft();
    set({ pendingDraft: null });
  }
}));
