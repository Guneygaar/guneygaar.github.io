// All Create Post form fields. Reset on open and on successful
// submit. B4 will add loadDraft/saveDraft from localStorage.

import { create } from 'zustand';

function initialForm() {
  return {
    title: '',
    owner: 'Admin',
    stage: 'In production',
    pillar: '',
    format: 'Photo',
    location: '',
    targetDate: new Date().toISOString().split('T')[0],
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

  update: (field, value) => set(s => ({ form: { ...s.form, [field]: value } })),
  reset: () => set({
    form: initialForm(),
    importOpen: false, ownerOpen: false, stageOpen: false,
    pillarOpen: false, formatOpen: false, locationOpen: false,
    submitting: false, toast: null
  }),
  closeAllDropdowns: () => set({
    importOpen: false, ownerOpen: false, stageOpen: false,
    pillarOpen: false, formatOpen: false, locationOpen: false
  }),
  setUI: (partial) => set(partial),
  setToast: (toast) => set({ toast }),
  clearToast: () => set({ toast: null })
}));
