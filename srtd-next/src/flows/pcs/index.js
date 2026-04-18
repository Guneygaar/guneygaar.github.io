import { usePcsFlowState } from './flowStore.js';
import { usePcsStore } from './pcsStore.js';
import { useAppState } from '../../core/stores/appState.js';
import { getPostByPostId } from '../../core/api/posts.js';
import { listComments, listInternalNotes } from '../../core/api/comments.js';
import { listReactionsForComments } from '../../core/api/reactions.js';
import { listUserRoles } from '../../core/api/users.js';
import { subscribePostComments } from '../../core/bridges/realtime.js';
import { logClick, logError } from '../../core/bridges/logging.js';

let _unsub = null;

async function fetchCommentsAndReactions(postId) {
  const comments = await listComments(postId);
  const commentIds = comments.map(c => c.id).filter(Boolean);
  const reactions = commentIds.length > 0 ? await listReactionsForComments(commentIds) : [];
  return { comments, reactions };
}

async function refreshRealtime(postId) {
  try {
    const { comments, reactions } = await fetchCommentsAndReactions(postId);
    const currentPostId = usePcsFlowState.getState().postId;
    if (currentPostId === postId) {
      usePcsStore.setState({ comments, reactions, commentsError: null });
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
  async open(postId) {
    if (!postId) { console.warn('[sorted-react/pcs] open() without postId'); return; }
    useAppState.getState().syncFromWindow();
    usePcsStore.getState().reset();
    usePcsFlowState.getState().open(postId);
    logClick('pcs_react_open', { postId });
    usePcsStore.setState({ loading: true });

    const role = String(useAppState.getState().user?.role || '').toLowerCase();
    const isAgency = ['admin', 'creative', 'servicing'].includes(role);

    let post = null;
    try {
      post = await getPostByPostId(postId);
      if (!post) { usePcsStore.setState({ error: 'Post not found', loading: false }); return; }
      usePcsStore.setState({ post, loading: false });
    } catch (err) {
      logError(err, { context: 'pcs_react_open_post', postId });
      usePcsStore.setState({ error: err?.message || 'Failed to load post', loading: false });
      return;
    }

    try {
      const userRoles = await listUserRoles();
      usePcsStore.setState({ userRoles });
    } catch (err) {
      logError(err, { context: 'pcs_react_open_users', postId });
    }

    try {
      const { comments, reactions } = await fetchCommentsAndReactions(postId);
      usePcsStore.setState({ comments, reactions, commentsError: null });
    } catch (err) {
      logError(err, { context: 'pcs_react_open_comments', postId });
      usePcsStore.setState({ commentsError: 'Failed to load comments' });
    }

    if (isAgency) {
      try {
        const internalNotes = await listInternalNotes(postId);
        usePcsStore.setState({ internalNotes, notesError: null });
      } catch (err) {
        logError(err, { context: 'pcs_react_open_notes', postId });
        usePcsStore.setState({ notesError: 'Failed to load internal notes' });
      }
    }

    if (_unsub) { try { _unsub(); } catch (e) {} _unsub = null; }
    _unsub = subscribePostComments(postId, () => refreshRealtime(postId));
  },
  close() {
    if (_unsub) { try { _unsub(); } catch (e) {} _unsub = null; }
    usePcsFlowState.getState().close();
    usePcsStore.getState().reset();
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
  isOpen() { return usePcsFlowState.getState().isOpen; }
};
