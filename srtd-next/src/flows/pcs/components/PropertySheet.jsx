import React, { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { patchPost } from '../../../core/api/posts.js';
import { writeAudit } from '../../../core/api/audit.js';
import { useAppState } from '../../../core/stores/appState';
import { usePcsStore } from '../pcsStore.js';
import { toast } from '../../../core/bridges/toast.js';
import { logClick, logError } from '../../../core/bridges/logging.js';
import { reseedOgPreview } from '../../../core/bridges/ogPreview.js';
import { FullScreenEditor } from './FullScreenEditor.jsx';

export function PropertySheet({ field, title, currentValue, options, inputType, placeholder, onClose, extraPatch, reseedOg }) {
  const post = usePcsStore((s) => s.post);
  const actor = useAppState((s) => s.user?.email || '');
  const [value, setValue] = useState(currentValue == null ? '' : String(currentValue));
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);
  const isDate = inputType === 'date';

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

  useEffect(() => {
    if (!options && inputRef.current) {
      if (inputType === 'date') return;
      const t = setTimeout(() => {
        if (!inputRef.current) return;
        inputRef.current.focus();
        if (inputType === 'text' || inputType === 'url') {
          try { inputRef.current.select(); } catch (err) { /* ignore */ }
        }
      }, 100);
      return () => clearTimeout(t);
    }
  }, [options, inputType]);

  const showSave = !options;
  const onSave = () => save(value.trim() || null);

  return (
    <FullScreenEditor title={title} onClose={onClose} onSave={onSave} showSave={showSave && !isDate} busy={busy}>
      {options ? (
        <div className="p-3 space-y-1.5">
          {options.map((opt) => {
            const selected = currentValue === opt.value;
            return (
              <button
                key={String(opt.value)}
                disabled={busy}
                onClick={() => save(opt.value)}
                className={`w-full flex items-center gap-2.5 px-3 py-3 rounded-sm2 hover:bg-bg-2 ${selected ? 'bg-bg-2' : ''} disabled:opacity-50`}
              >
                {opt.color && <span className="w-2.5 h-2.5 rounded-pill flex-shrink-0" style={{ backgroundColor: `var(--c-${opt.color})` }} />}
                <span className="text-lg text-text-loud flex-1 text-left">{opt.label}</span>
                {selected && <Check size={16} className="text-terracotta" />}
              </button>
            );
          })}
        </div>
      ) : isDate ? (
        <div className="p-4">
          <label htmlFor="pcs-date-input" className="block font-mono text-2xs text-text-dim tracking-widest uppercase mb-2">Tap to pick date</label>
          <input
            id="pcs-date-input"
            ref={inputRef}
            type="date"
            value={value || ''}
            min="2020-01-01"
            max="2035-12-31"
            onChange={(e) => {
              const v = e.target.value;
              setValue(v);
              if (v) save(v);
            }}
            className="block w-full px-4 py-5 rounded-sm2 bg-bg-2 border border-border-neutral text-text-loud text-lg"
            style={{ minHeight: '56px', WebkitAppearance: 'none', appearance: 'none' }}
          />
          <div className="font-mono text-2xs text-text-soft tracking-widest uppercase mt-3">Picker opens on tap</div>
        </div>
      ) : inputType === 'textarea' ? (
        <div className="p-3">
          <textarea
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            className="w-full min-h-[200px] px-3 py-3 rounded-sm2 bg-bg-2 border border-border-neutral text-text-loud text-lg font-serif"
          />
        </div>
      ) : (
        <div className="p-3">
          <input
            ref={inputRef}
            type={inputType || 'text'}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            className="w-full px-3 py-4 rounded-sm2 bg-bg-2 border border-border-neutral text-text-loud text-lg"
          />
        </div>
      )}
    </FullScreenEditor>
  );
}
