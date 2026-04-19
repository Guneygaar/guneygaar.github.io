import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import { patchPost } from '../../../core/api/posts.js';
import { writeAudit } from '../../../core/api/audit.js';
import { useAppState } from '../../../core/stores/appState.js';
import { usePcsStore } from '../pcsStore.js';
import { toast } from '../../../core/bridges/toast.js';
import { logClick, logError } from '../../../core/bridges/logging.js';
import { reseedOgPreview } from '../../../core/bridges/ogPreview.js';

export function PropertySheet({ field, title, currentValue, options, inputType, placeholder, onClose, extraPatch, reseedOg }) {
  const post = usePcsStore((s) => s.post);
  const actor = useAppState((s) => s.user?.email || '');
  const [value, setValue] = useState(currentValue == null ? '' : String(currentValue));
  const [busy, setBusy] = useState(false);

  async function save(newVal) {
    if (busy || !post) return;
    setBusy(true);
    try {
      const patch = { [field]: newVal, updated_by: actor, ...(extraPatch || {}) };
      const updated = await patchPost(post.post_id, patch);
      writeAudit({ postId: post.post_id, field, oldValue: post[field], newValue: newVal, actor }).catch(() => {});
      if (updated) usePcsStore.setState({ post: updated });
      if (reseedOg) reseedOgPreview(post.post_id);
      logClick('pcs_react_prop_edit', { field });
      toast('Saved', 'success');
      onClose();
    } catch (err) {
      logError(err, { context: 'pcs_react_prop_edit', field });
      toast('Save failed', 'error');
      setBusy(false);
    }
  }

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 bg-black/80" style={{ zIndex: 2500 }} />
      <div className="fixed inset-x-0 bottom-0 bg-bg border-t border-divider-warm rounded-t-card animate-slide-up max-w-[430px] mx-auto" style={{ zIndex: 2501 }}>
        <div className="flex items-center justify-between px-3 py-3 border-b border-divider-soft">
          <div className="font-mono text-sm text-text-dim tracking-widest uppercase">{title}</div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center text-text-soft" aria-label="Close"><X size={16} /></button>
        </div>
        <div className="p-3 pb-safe-b space-y-2 max-h-[60vh] overflow-y-auto">
          {options && options.map((opt) => {
            const selected = currentValue === opt.value;
            return (
              <button key={String(opt.value)} disabled={busy} onClick={() => save(opt.value)} className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-sm2 hover:bg-bg-2 ${selected ? 'bg-bg-2' : ''} disabled:opacity-50`}>
                {opt.color && <span className="w-2.5 h-2.5 rounded-pill flex-shrink-0" style={{ backgroundColor: `var(--c-${opt.color})` }} />}
                <span className="text-sm text-text-loud flex-1 text-left">{opt.label}</span>
                {selected && <Check size={14} className="text-terracotta" />}
              </button>
            );
          })}
          {!options && (
            <>
              {inputType === 'textarea' ? (
                <textarea value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} className="w-full min-h-[120px] px-3 py-2 rounded-sm2 bg-bg-2 border border-border-neutral text-text-loud text-sm font-serif" />
              ) : (
                <input type={inputType || 'text'} value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} className="w-full px-3 py-2 rounded-sm2 bg-bg-2 border border-border-neutral text-text-loud text-sm" />
              )}
              <button disabled={busy} onClick={() => save(value.trim() || null)} className="w-full px-3 py-2.5 rounded-sm2 bg-terracotta text-text-loud text-sm font-semibold disabled:opacity-50">Save</button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
