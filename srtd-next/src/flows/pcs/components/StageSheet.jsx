import React, { useState } from 'react';
import { X } from 'lucide-react';
import { STAGE_LABELS, STAGE_TOKEN } from '../utils/stage.js';
import { updatePostStage, patchPost } from '../../../core/api/posts.js';
import { writeAudit } from '../../../core/api/audit.js';
import { useAppState } from '../../../core/stores/appState.js';
import { usePcsStore } from '../pcsStore.js';
import { toast } from '../../../core/bridges/toast.js';
import { logClick, logError } from '../../../core/bridges/logging.js';
import { reseedOgPreview } from '../../../core/bridges/ogPreview.js';

const TRANSITIONS = {
  brief_done:           { forward: ['in_production'], back: [], off: ['parked', 'rejected'] },
  in_production:        { forward: ['ready'], back: ['brief_done'], off: ['parked', 'rejected'] },
  ready:                { forward: ['awaiting_approval'], back: ['in_production'], off: ['parked', 'rejected'] },
  awaiting_approval:    { forward: ['scheduled'], back: ['awaiting_brand_input', 'in_production'], off: ['parked', 'rejected'] },
  awaiting_brand_input: { forward: ['awaiting_approval'], back: ['in_production'], off: ['parked', 'rejected'] },
  scheduled:            { forward: ['published'], back: ['awaiting_approval'], off: ['parked'] },
  published:            { forward: [], back: [], off: ['parked'] },
  parked:               { forward: ['in_production'], back: [], off: ['rejected'] },
  rejected:             { forward: [], back: [], off: ['parked'] },
  brief:                { forward: ['in_production'], back: [], off: ['parked', 'rejected'] }
};

function StageDot({ stage }) {
  const token = STAGE_TOKEN[stage] || 'text-soft';
  return <span className="w-2.5 h-2.5 rounded-pill flex-shrink-0" style={{ backgroundColor: `var(--c-${token})` }} />;
}

export function StageSheet({ post, onClose }) {
  const actor = useAppState((s) => s.user?.email || '');
  const [busy, setBusy] = useState(false);
  const [linkedinUrl, setLinkedinUrl] = useState(post.linkedin_link || '');
  const t = TRANSITIONS[post.stage] || { forward: [], back: [], off: [] };

  async function move(to) {
    if (busy) return;
    setBusy(true);
    try {
      const updated = await updatePostStage(post.post_id, to, actor);
      writeAudit({ postId: post.post_id, field: 'stage', oldValue: post.stage, newValue: to, actor }).catch(() => {});
      if (updated) usePcsStore.setState({ post: updated });
      logClick('pcs_react_stage_move', { from: post.stage, to });
      toast(`Moved to ${STAGE_LABELS[to] || to}`, 'success');
      onClose();
    } catch (err) {
      logError(err, { context: 'pcs_react_stage_move', postId: post.post_id, to });
      toast('Failed to move stage', 'error');
      setBusy(false);
    }
  }

  async function markPublished() {
    if (busy) return;
    if (!linkedinUrl.trim()) { toast('LinkedIn URL required', 'warning'); return; }
    setBusy(true);
    try {
      const updated = await patchPost(post.post_id, {
        stage: 'published',
        linkedin_link: linkedinUrl.trim(),
        status_changed_at: new Date().toISOString(),
        updated_by: actor
      });
      writeAudit({ postId: post.post_id, field: 'stage', oldValue: post.stage, newValue: 'published', actor }).catch(() => {});
      if (updated) usePcsStore.setState({ post: updated });
      reseedOgPreview(post.post_id);
      logClick('pcs_react_publish', { postId: post.post_id });
      toast('Marked live', 'success');
      onClose();
    } catch (err) {
      logError(err, { context: 'pcs_react_publish' });
      toast('Failed to publish', 'error');
      setBusy(false);
    }
  }

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 bg-black/80" style={{ zIndex: 2500 }} />
      <div className="fixed inset-x-0 bottom-0 bg-bg border-t border-divider-warm rounded-t-card animate-slide-up max-w-[430px] mx-auto" style={{ zIndex: 2501 }}>
        <div className="flex items-center justify-between px-3 py-3 border-b border-divider-soft">
          <div className="font-mono text-sm text-text-dim tracking-widest uppercase">Move stage</div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center text-text-soft" aria-label="Close"><X size={16} /></button>
        </div>
        <div className="p-3 space-y-4 pb-safe-b">
          {post.stage === 'scheduled' && (
            <div className="space-y-2">
              <div className="font-mono text-2xs text-text-dim tracking-widest uppercase">Publish</div>
              <input type="url" value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/posts/..." className="w-full px-3 py-2 rounded-sm2 bg-bg-2 border border-border-neutral text-text-loud text-sm" />
              <button onClick={markPublished} disabled={busy} className="w-full px-3 py-2.5 rounded-sm2 bg-green text-text-loud text-sm font-semibold disabled:opacity-50">Mark live</button>
            </div>
          )}
          {t.forward.length > 0 && (
            <div>
              <div className="font-mono text-2xs text-text-dim tracking-widest uppercase mb-2">Forward</div>
              {t.forward.map((s) => (
                <button key={s} disabled={busy} onClick={() => move(s)} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-sm2 bg-bg-2 hover:bg-bg-3 mb-1.5 disabled:opacity-50">
                  <StageDot stage={s} />
                  <span className="text-sm text-text-loud">{STAGE_LABELS[s]}</span>
                </button>
              ))}
            </div>
          )}
          {t.back.length > 0 && (
            <div>
              <div className="font-mono text-2xs text-text-dim tracking-widest uppercase mb-2">Back</div>
              {t.back.map((s) => (
                <button key={s} disabled={busy} onClick={() => move(s)} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-sm2 bg-bg-2 hover:bg-bg-3 mb-1.5 disabled:opacity-50">
                  <StageDot stage={s} />
                  <span className="text-sm text-text-loud">{STAGE_LABELS[s]}</span>
                </button>
              ))}
            </div>
          )}
          {t.off.length > 0 && (
            <div>
              <div className="font-mono text-2xs text-text-dim tracking-widest uppercase mb-2">Off-path</div>
              {t.off.map((s) => (
                <button key={s} disabled={busy} onClick={() => move(s)} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-sm2 bg-bg-2 hover:bg-bg-3 mb-1.5 disabled:opacity-50">
                  <StageDot stage={s} />
                  <span className="text-sm text-text-mid">{STAGE_LABELS[s]}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
