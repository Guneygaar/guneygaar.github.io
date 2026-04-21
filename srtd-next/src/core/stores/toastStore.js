// Minimal React-side toast queue. Success toasts auto-dismiss at
// 3 s, errors at 4 s. show() replaces whatever is currently on
// screen — simpler than a queue and matches Linear's behaviour
// (latest wins). The toast bridge (core/bridges/toast.js) routes
// every react-side toast() call here.
//
// Optional opts.action renders a tappable UNDO / RETRY label; the
// action click fires then dismisses. opts.duration overrides the
// default success/error timings.

import { create } from 'zustand';

let _dismissTimer = null;

export const useToastStore = create((set, get) => ({
  current: null,          // { id, msg, type, cost?, action?, duration? } | null

  show(msg, type, opts) {
    clearTimeout(_dismissTimer);
    const id = Date.now() + Math.random();
    const action = (opts && opts.action && typeof opts.action.onClick === 'function')
      ? { label: String(opts.action.label || ''), onClick: opts.action.onClick }
      : null;
    const duration = (opts && typeof opts.duration === 'number')
      ? opts.duration
      : (type === 'error' ? 4000 : 3000);
    set({
      current: {
        id,
        msg: String(msg || ''),
        type: type || 'success',
        cost: (opts && typeof opts.cost === 'number') ? opts.cost : null,
        action,
        duration
      }
    });
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
