import { useRef, useCallback } from 'react';
import { usePcsStore } from '../../flows/pcs/pcsStore.js';
import { patchPost, updatePostStage } from '../api/posts.js';
import { writeAudit } from '../api/audit.js';
import { toast } from '../bridges/toast.js';
import { logClick, logError } from '../bridges/logging.js';

export function useOptimisticPatch() {
  const queueRef = useRef(Promise.resolve());
  const undoTimerRef = useRef(null);

  async function undo(field, oldValue, opts) {
    const post = usePcsStore.getState().post;
    if (!post || !post.post_id) return;
    const currentValue = post[field];

    usePcsStore.setState({
      post: { ...post, [field]: oldValue },
    });

    try {
      let updated;
      if (opts.stage) {
        updated = await updatePostStage(post.post_id, oldValue, opts.actor, opts.extraPatch || {});
      } else {
        const body = { [field]: oldValue, ...(opts.extraPatch || {}), updated_by: opts.actor };
        updated = await patchPost(post.post_id, body);
      }
      writeAudit({
        postId: post.post_id,
        field: opts.auditField,
        oldValue: currentValue,
        newValue: oldValue,
        actor: opts.actor,
        note: 'undo',
      }).catch(() => {});
      if (updated) usePcsStore.setState({ post: updated });
      logClick('pcs_react_opt_undo', { field: opts.auditField });
      toast('Undone', 'success', { duration: 2000 });
    } catch (err) {
      const current = usePcsStore.getState().post;
      usePcsStore.setState({
        post: { ...current, [field]: currentValue },
      });
      logError(err, { context: 'pcs_react_opt_undo', field: opts.auditField });
      toast('Undo failed', 'error');
    } finally {
      const fields = new Set(usePcsStore.getState().optimisticFields);
      fields.delete(field);
      usePcsStore.setState({ optimisticFields: fields });
    }
  }

  const commit = useCallback(async (field, newValue, opts = {}) => {
    const {
      stage = false,
      auditField = field,
      label = prettyFieldLabel(field),
      actor = null,
      extraPatch = {},
    } = opts;

    const post = usePcsStore.getState().post;
    if (!post || !post.post_id) return;

    const oldValue = post[field];
    if (oldValue === newValue) return;

    usePcsStore.setState({
      post: { ...post, [field]: newValue, ...extraPatch },
    });

    const markedFields = new Set(usePcsStore.getState().optimisticFields);
    markedFields.add(field);
    usePcsStore.setState({ optimisticFields: markedFields });

    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }

    queueRef.current = queueRef.current.then(async () => {
      try {
        let updated;
        if (stage) {
          updated = await updatePostStage(post.post_id, newValue, actor, extraPatch);
        } else {
          const body = { [field]: newValue, ...extraPatch, updated_by: actor };
          updated = await patchPost(post.post_id, body);
        }
        writeAudit({
          postId: post.post_id,
          field: auditField,
          oldValue,
          newValue,
          actor,
        }).catch(() => {});
        if (updated) usePcsStore.setState({ post: updated });
        logClick('pcs_react_opt_commit', { field: auditField });

        const undoExtraPatch = {};
        if (extraPatch && typeof extraPatch === 'object') {
          for (const key of Object.keys(extraPatch)) {
            // Capture the pre-commit value of each extraPatch key
            undoExtraPatch[key] = post[key];
          }
        }

        toast(`${label} updated`, 'success', {
          action: {
            label: 'UNDO',
            onClick: () => undo(field, oldValue, {
              stage, auditField, actor, extraPatch: undoExtraPatch,
            }),
          },
          duration: 5000,
        });
      } catch (err) {
        const current = usePcsStore.getState().post;
        usePcsStore.setState({
          post: { ...current, [field]: oldValue },
        });
        logError(err, { context: 'pcs_react_opt_commit', field: auditField });
        toast('Save failed', 'error', {
          action: {
            label: 'RETRY',
            onClick: () => commit(field, newValue, opts),
          },
          duration: 6000,
        });
      } finally {
        const fields = new Set(usePcsStore.getState().optimisticFields);
        fields.delete(field);
        usePcsStore.setState({ optimisticFields: fields });
      }
    });

    return queueRef.current;
  }, []);

  return { commit };
}

function prettyFieldLabel(field) {
  const map = {
    stage: 'Stage',
    owner: 'Owner',
    owner_profile_id: 'Owner',
    target_date: 'Date',
    format: 'Format',
    content_pillar: 'Pillar',
    location: 'Location',
    canva_link: 'Canva link',
    drive_link: 'Drive link',
    title: 'Title',
    caption: 'Caption',
  };
  return map[field] || field;
}
