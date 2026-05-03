import { usePcsFlowState } from './flowStore.js';
import { usePcsStore } from './pcsStore.js';
import { useAppState } from '../../core/stores/appState';
import { getPostByPostId, enrichPostOwner } from '../../core/api/posts.js';
import { listComments, listInternalNotes } from '../../core/api/comments.js';
import { listReactionsForComments } from '../../core/api/reactions.js';
import { listUserRoles } from '../../core/api/users.js';
import { listAuditForPost } from '../../core/api/audit.js';
import { subscribePostComments } from '../../core/bridges/realtime.js';
import { logClick, logError } from '../../core/bridges/logging.js';

let _unsub = null;

async function retryActivity() {
  const postId = usePcsFlowState.getState().postId;
  if (!postId) return;
  usePcsStore.setState({ activityError: null });
  try {
    const rows = await listAuditForPost(postId);
    usePcsStore.setState({ activity: rows || [] });
  } catch (err) {
    logError(err, { context: 'pcs_react_retry_activity', postId });
    usePcsStore.setState({ activityError: String(err?.message || err) });
  }
}

async function fetchCommentsAndReactions(postId) {
  const comments = await listComments(postId);
  const commentIds = comments.map(c => c.id).filter(Boolean);
  const reactions = commentIds.length > 0 ? await listReactionsForComments(commentIds) : [];
  return { comments, reactions };
}

async function refreshRealtime(postId) {
  // NOTE: This handler currently does NOT replace post row fields.
  // If a future change adds post-row realtime refresh here, gate it
  // on usePcsStore.getState().optimisticFields — any field name in
  // that Set has an in-flight optimistic edit and must NOT be
  // overwritten by the realtime payload. See useOptimisticPatch.
  // userRoles refetched in the same batch so realtime echoes after
  // role/owner changes always render with fresh roster data.
  try {
    const [userRoles, { comments, reactions }] = await Promise.all([
      listUserRoles(),
      fetchCommentsAndReactions(postId)
    ]);
    const currentPostId = usePcsFlowState.getState().postId;
    if (currentPostId === postId) {
      usePcsStore.setState({ userRoles, comments, reactions, commentsError: null });
    }
  } catch (err) {
    logError(err, { context: 'pcs_react_realtime_refresh', postId });
  }
  try {
    const role = String(useAppState.getState().user?.role || '').toLowerCase();
    const isAgency = ['admin', 'creative', 'servicing'].includes(role);
    if (isAgency) {
      const internalNotes = await listInternalNotes(postId);
      const currentPostId = usePcsFlowState.getState().postId;
      if (currentPostId === postId) {
        usePcsStore.setState({ internalNotes, notesError: null });
      }
    }
  } catch (err) {
    logError(err, { context: 'pcs_react_realtime_refresh_notes', postId });
  }
}

export const pcsFlow = {
  async open(postId, opts) {
    if (!postId) { console.warn('[sorted-react/pcs] open() without postId'); return; }
    const { isOpen } = usePcsFlowState.getState();
    const { loading: alreadyLoading } = usePcsStore.getState();
    if (isOpen || alreadyLoading) return;
    useAppState.getState().syncFromWindow();
    usePcsStore.getState().reset();
    usePcsFlowState.getState().open(postId);
    logClick('pcs_react_open', { postId });
    const contextList = (opts && Array.isArray(opts.contextList)) ? opts.contextList : [];
    usePcsStore.setState({ loading: true, contextList });

    const role = String(useAppState.getState().user?.role || '').toLowerCase();
    const isAgency = ['admin', 'creative', 'servicing'].includes(role);

    let post = null;
    try {
      const timeoutP = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Post load timeout')), 12000)
      );
      post = await Promise.race([getPostByPostId(postId), timeoutP]);
      if (!post) { usePcsStore.setState({ error: 'Post not found', loading: false }); return; }
      usePcsStore.setState({ post, loading: false });
      enrichPostOwner(post).then((owner) => {
        if (usePcsFlowState.getState().postId !== postId) return;
        if (!owner) return;
        usePcsStore.setState((s) => ({ post: { ...s.post, owner_profile_id: owner } }));
      }).catch(() => {});
    } catch (err) {
      logError(err, { context: 'pcs_react_open_post', postId });
      usePcsStore.setState({ error: err?.message || 'Failed to load post', loading: false });
      return;
    }

    // Parallel fetch userRoles + comments/reactions so avatars resolve
    // on first paint instead of racing the realtime echo.
    try {
      const [userRoles, { comments, reactions }] = await Promise.all([
        listUserRoles(),
        fetchCommentsAndReactions(postId)
      ]);
      if (usePcsFlowState.getState().postId !== postId) return;
      usePcsStore.setState({ userRoles, comments, reactions, commentsError: null });
    } catch (err) {
      logError(err, { context: 'pcs_react_open', postId });
      if (usePcsFlowState.getState().postId !== postId) return;
      usePcsStore.setState({ commentsError: 'Failed to load data' });
    }

    if (isAgency) {
      try {
        const internalNotes = await listInternalNotes(postId);
        if (usePcsFlowState.getState().postId !== postId) return;
        usePcsStore.setState({ internalNotes, notesError: null });
      } catch (err) {
        logError(err, { context: 'pcs_react_open_notes', postId });
        if (usePcsFlowState.getState().postId !== postId) return;
        usePcsStore.setState({ notesError: 'Failed to load internal notes' });
      }
    }

    try {
      const rows = await listAuditForPost(postId);
      if (usePcsFlowState.getState().postId !== postId) return;
      usePcsStore.setState({ activity: rows || [], activityError: null });
    } catch (err) {
      logError(err, { context: 'pcs_react_open_activity', postId });
      if (usePcsFlowState.getState().postId !== postId) return;
      usePcsStore.setState({ activityError: String(err?.message || err) });
    }

    if (usePcsFlowState.getState().postId === postId) {
      if (_unsub) { try { _unsub(); } catch (e) {} _unsub = null; }
      _unsub = subscribePostComments(postId, () => refreshRealtime(postId));
    }
  },
  close() {
    if (_unsub) { try { _unsub(); } catch (e) {} _unsub = null; }
    usePcsFlowState.getState().close();
    usePcsStore.getState().reset();
    if (typeof window !== 'undefined' && window.AppState) {
      if (window.AppState.pcs) {
        window.AppState.pcs.open = false;
        window.AppState.pcs.postId = null;
        window.AppState.pcs.post = null;
      }
      if (window.AppState.ui) {
        window.AppState.ui.modalOpen = false;
      }
      if (typeof window._drainDeferredRender === 'function') {
        try { window._drainDeferredRender(); } catch (e) {}
      }
    }
  },
  async retryComments() {
    const postId = usePcsFlowState.getState().postId;
    if (!postId) return;
    usePcsStore.setState({ commentsError: null });
    try {
      const { comments, reactions } = await fetchCommentsAndReactions(postId);
      usePcsStore.setState({ comments, reactions });
    } catch (err) {
      logError(err, { context: 'pcs_react_retry_comments', postId });
      usePcsStore.setState({ commentsError: 'Failed to load comments' });
    }
  },
  async retryInternalNotes() {
    const postId = usePcsFlowState.getState().postId;
    if (!postId) return;
    usePcsStore.setState({ notesError: null });
    try {
      const internalNotes = await listInternalNotes(postId);
      usePcsStore.setState({ internalNotes });
    } catch (err) {
      logError(err, { context: 'pcs_react_retry_notes', postId });
      usePcsStore.setState({ notesError: 'Failed to load internal notes' });
    }
  },
  retryActivity,
  isOpen() { return usePcsFlowState.getState().isOpen; },
  // Walk the context list supplied to open(). Preserves the list across
  // navigation so the user can swipe prev/next through the same filtered
  // set without refetching it from Plan. No-op when the list is empty
  // (e.g. PCS opened from a notification deep link) or when there's no
  // neighbour in the requested direction.
  async navigate(direction) {
    const state = usePcsStore.getState();
    const list = state.contextList || [];
    const currentPostId = usePcsFlowState.getState().postId;
    if (!list.length || !currentPostId) return;
    const idx = list.indexOf(currentPostId);
    if (idx < 0) return;
    const nextIdx = direction === 'next' ? idx + 1 : idx - 1;
    if (nextIdx < 0 || nextIdx >= list.length) return;
    const nextPostId = list[nextIdx];
    if (!nextPostId || nextPostId === currentPostId) return;
    logClick('pcs_react_navigate', { direction, postId: nextPostId });
    await pcsFlow.open(nextPostId, { contextList: list });
  }
};
