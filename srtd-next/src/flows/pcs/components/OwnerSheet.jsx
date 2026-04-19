import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import { Avatar } from '../../../core/ui/index.js';
import { patchPost } from '../../../core/api/posts.js';
import { writeAudit } from '../../../core/api/audit.js';
import { useAppState } from '../../../core/stores/appState.js';
import { usePcsStore } from '../pcsStore.js';
import { toast } from '../../../core/bridges/toast.js';
import { ownerToRole, titleCase } from '../utils/stage.js';
import { logClick, logError } from '../../../core/bridges/logging.js';

const ROLE_TO_OWNER_LABEL = { admin: 'Admin', servicing: 'Servicing', creative: 'Creative', client: 'Client' };

export function OwnerSheet({ onClose }) {
  const post = usePcsStore((s) => s.post);
  const userRoles = usePcsStore((s) => s.userRoles);
  const actor = useAppState((s) => s.user?.email || '');
  const [busy, setBusy] = useState(false);

  async function pick(user) {
    if (busy) return;
    setBusy(true);
    try {
      const roleLabel = ROLE_TO_OWNER_LABEL[String(user.role || '').toLowerCase()] || 'Creative';
      const updated = await patchPost(post.post_id, { owner: roleLabel, owner_user_id: user.id, updated_by: actor });
      writeAudit({ postId: post.post_id, field: 'owner', oldValue: post.owner, newValue: roleLabel, actor }).catch(() => {});
      if (updated) usePcsStore.setState({ post: updated });
      logClick('pcs_react_owner_set', { userId: user.id });
      toast('Owner updated', 'success');
      onClose();
    } catch (err) {
      logError(err, { context: 'pcs_react_owner_set' });
      toast('Failed to set owner', 'error');
      setBusy(false);
    }
  }

  const currentId = (post && post.owner_user_id && (post.owner_user_id.id || post.owner_user_id)) || null;

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 bg-black/80" style={{ zIndex: 2500 }} />
      <div className="fixed inset-x-0 bottom-0 bg-bg border-t border-divider-warm rounded-t-card animate-slide-up max-w-[430px] mx-auto" style={{ zIndex: 2501 }}>
        <div className="flex items-center justify-between px-3 py-3 border-b border-divider-soft">
          <div className="font-mono text-sm text-text-dim tracking-widest uppercase">Set owner</div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center text-text-soft" aria-label="Close"><X size={16} /></button>
        </div>
        <div className="p-2 pb-safe-b max-h-[60vh] overflow-y-auto">
          {userRoles.map((u) => {
            const role = ownerToRole(u.role);
            const isCurrent = currentId === u.id;
            return (
              <button key={u.id} disabled={busy} onClick={() => pick(u)} className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-sm2 hover:bg-bg-2 ${isCurrent ? 'bg-bg-2' : ''} disabled:opacity-50`}>
                <Avatar name={u.display_name || u.name} role={role} size="md" avatarUrl={u.avatar_url} />
                <div className="flex-1 text-left">
                  <div className="text-sm text-text-loud">{u.name}</div>
                  <div className="text-2xs text-text-soft">{titleCase(role)}</div>
                </div>
                {isCurrent && <Check size={14} className="text-terracotta" />}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
