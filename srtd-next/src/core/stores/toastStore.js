// Minimal React-side toast queue. Success toasts auto-dismiss at
// 3 s, errors at 4 s. show() replaces whatever is currently on
// screen — simpler than a queue and matches Linear's behaviour
// (latest wins). The toast bridge (core/bridges/toast.js) routes
// every react-side toast() call here.

import { create } from 'zustand';

let _dismissTimer = null;

export const useToastStore = create((set, get) => ({
  current: null,          // { id, msg, type, cost? } | null

  show(msg, type, opts) {
    clearTimeout(_dismissTimer);
    const id = Date.now() + Math.random();
    set({
      current: {
        id,
        msg: String(msg || ''),
        type: type || 'success',
        cost: (opts && typeof opts.cost === 'number') ? opts.cost : null
      }
    });
    const duration = type === 'error' ? 4000 : 3000;
    _dismissTimer = setTimeout(() => {
      const cur = get().current;
      if (cur && cur.id === id) set({ current: null });
    }, duration);
  },

  dismiss() {
    clearTimeout(_dismissTimer);
    set({ current: null });
  }
}));
