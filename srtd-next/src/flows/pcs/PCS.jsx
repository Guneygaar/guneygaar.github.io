import React, { useState } from 'react';
import { Check, ExternalLink, MessageSquare } from 'lucide-react';
import { ErrorBoundary, Overlay } from '../../core/ui/index.js';
import { usePcsFlowState } from './flowStore.js';
import { usePcsStore } from './pcsStore.js';
import { useAppState, useIsAdmin, useIsClient } from '../../core/stores/appState.js';
import { pcsFlow } from './index.js';
import { KickerRow } from './components/KickerRow.jsx';
import { PcsDetailSheet } from './components/PcsDetailSheet.jsx';
import { CaptionBlock } from './components/CaptionBlock.jsx';
import { PhotoStrip } from './components/PhotoStrip.jsx';
import { StatsStrip } from './components/StatsStrip.jsx';
import { Tabs } from './components/Tabs.jsx';
import { CommentList } from './components/CommentList.jsx';
import { Composer } from './components/Composer.jsx';
import { RetryBanner } from './components/RetryBanner.jsx';
import { PropertySheet } from './components/PropertySheet.jsx';
import { CommentActionSheet } from './components/CommentActionSheet.jsx';
import { ViewAllLink } from './components/ViewAllLink.jsx';
import { FullScreenThread } from './components/FullScreenThread.jsx';
import { ActivityFeed } from './components/ActivityFeed.jsx';
import { apiFetch } from '../../core/api/client.js';
import { updatePostStage } from '../../core/api/posts.js';
import { toast } from '../../core/bridges/toast.js';
import { logClick, logError } from '../../core/bridges/logging.js';
import { formatTargetDate } from './utils/time.js';

// Fields still routed through the full-screen PropertySheet (title only).
// Every other field lives in PcsDetailSheet.
const TITLE_FIELD_CONFIG = { field: 'title', title: 'Title', inputType: 'text', placeholder: 'Post title', reseedOg: true };

export function PCS() {
  const postId = usePcsFlowState((s) => s.postId);
  const post = usePcsStore((s) => s.post);
  const comments = usePcsStore((s) => s.comments);
  const internalNotes = usePcsStore((s) => s.internalNotes);
  const reactions = usePcsStore((s) => s.reactions);
  const userRoles = usePcsStore((s) => s.userRoles);
  const loading = usePcsStore((s) => s.loading);
  const error = usePcsStore((s) => s.error);
  const commentsError = usePcsStore((s) => s.commentsError);
  const notesError = usePcsStore((s) => s.notesError);
  const userEmail = useAppState((s) => s.user?.email || '');
  const isAdmin = useIsAdmin();
  const isClient = useIsClient();
  const [activeTab, setActiveTab] = useState('comments');
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [activeSheet, setActiveSheet] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [actionSheet, setActionSheet] = useState(null);
  const [threadView, setThreadView] = useState(null);

  const isAgency = !isClient;
  const canEdit = !isClient;
  const canMove = !isClient;
  const canSeeInternal = isAgency;

  const [approving, setApproving] = useState(false);

  function onReplyToComment(c) {
    const authorName = c.author ? (userRoles.find((u) => u.email === c.author)?.name || c.author.split('@')[0]) : 'Unknown';
    setReplyTo({ id: c.id, authorName, message: c.message || '' });
  }

  function onLongPressComment(c, isInternal) {
    setActionSheet({ comment: c, isInternal });
  }

  function focusComposer() {
    // The Composer container is marked with data-composer (see Composer.jsx).
    // Find its textarea and focus it; iOS Safari tolerates programmatic focus
    // here because this is driven by a direct tap handler.
    try {
      const ta = document.querySelector('[data-composer] textarea');
      if (ta && typeof ta.focus === 'function') ta.focus();
    } catch (err) {
      // Non-fatal — the composer may not yet be mounted on the activity tab.
    }
  }

  async function onClientApprove() {
    if (!post || approving) return;
    if (post.stage !== 'awaiting_approval') return;
    const actor = userEmail || 'unknown';
    const oldStage = post.stage;
    const newStage = 'scheduled';
    const previousPost = post;
    setApproving(true);
    // Optimistic local update so the action bar flips immediately.
    usePcsStore.setState({ post: { ...post, stage: newStage } });
    try {
      const updated = await updatePostStage(post.post_id, newStage, actor);
      if (updated) usePcsStore.setState({ post: updated });
      // Activity log write. notify-stage edge function fires server-side on
      // the PATCH above — we do not invoke it from the client.
      apiFetch('/activity_log', {
        method: 'POST',
        body: JSON.stringify({
          post_id: post.post_id,
          actor,
          action: 'approved',
          old_stage: oldStage,
          new_stage: newStage,
          created_at: new Date().toISOString(),
        }),
      }).catch((err) => {
        logError(err, { context: 'pcs_react_client_approve_activity' });
      });
      logClick('pcs_react_client_approve', { post_id: post.post_id });
      const when = formatTargetDate(post.target_date);
      toast(when ? `Approved. Goes live ${when}` : 'Approved. Agency will schedule.', 'success');
    } catch (err) {
      // Rollback optimistic update on failure.
      usePcsStore.setState({ post: previousPost });
      logError(err, { context: 'pcs_react_client_approve' });
      toast('Approve failed', 'error');
    } finally {
      setApproving(false);
    }
  }

  function onOpenLinkedIn() {
    if (!post || !post.linkedin_link) return;
    try {
      window.open(post.linkedin_link, '_blank', 'noopener,noreferrer');
      logClick('pcs_react_client_view_linkedin', { post_id: post.post_id });
    } catch (err) {
      logError(err, { context: 'pcs_react_client_view_linkedin' });
    }
  }

  function renderClientActionBar() {
    if (!isClient || !post) return null;
    const stage = post.stage;
    const commentBtn = (
      <button
        type="button"
        onClick={focusComposer}
        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 border border-border-warm bg-transparent text-text-mid font-mono text-xs tracking-wide uppercase active:opacity-70"
        aria-label="Comment"
      >
        <MessageSquare size={14} />
        <span>Comment</span>
      </button>
    );
    if (stage === 'awaiting_approval') {
      return (
        <div className="flex items-stretch gap-2 px-3 py-2 border-t border-divider-warm bg-bg">
          {commentBtn}
          <button
            type="button"
            onClick={onClientApprove}
            disabled={approving}
            style={{ backgroundColor: '#cc785c', color: '#ffffff' }}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 font-sans text-sm font-semibold tracking-tight disabled:opacity-60"
            aria-label="Approve"
          >
            <Check size={14} />
            <span>{approving ? 'Approving...' : 'Approve'}</span>
          </button>
        </div>
      );
    }
    if (stage === 'published' && post.linkedin_link) {
      return (
        <div className="flex items-stretch gap-2 px-3 py-2 border-t border-divider-warm bg-bg">
          {commentBtn}
          <button
            type="button"
            onClick={onOpenLinkedIn}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 bg-text-loud text-bg font-sans text-sm font-semibold tracking-tight active:opacity-80"
            aria-label="View on LinkedIn"
          >
            <ExternalLink size={14} />
            <span>View on LinkedIn</span>
          </button>
        </div>
      );
    }
    return (
      <div className="flex items-stretch gap-2 px-3 py-2 border-t border-divider-warm bg-bg">
        {commentBtn}
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Overlay onClose={() => pcsFlow.close()} zIndex={1501}>
        <div className="max-w-[430px] w-full mx-auto flex flex-col flex-1 min-h-full">
          {loading && !post && (
            <div className="px-3 py-16 font-mono text-sm text-text-dim tracking-widest uppercase text-center">Loading {postId}...</div>
          )}
          {error && !post && (
            <div className="px-3 py-16 font-mono text-sm text-red tracking-widest uppercase text-center">{error}</div>
          )}
          {post && (
            <>
              <KickerRow
                post={post}
                isAdmin={isAdmin}
                canMove={canMove}
                onOpenSheet={() => setDetailSheetOpen(true)}
                onOpenStage={() => setDetailSheetOpen(true)}
              />
              <PhotoStrip post={post} canEdit={canEdit} />
              <div className="px-3 pt-3 pb-1">
                <h1
                  onClick={canEdit ? () => setActiveSheet('title') : undefined}
                  className={`font-serif text-[26px] font-semibold leading-[1.15] tracking-[-0.02em] text-text-loud ${canEdit ? 'cursor-pointer' : ''}`}
                >
                  {post.title || 'Untitled'}
                </h1>
              </div>
              <CaptionBlock post={post} canEdit={canEdit} isAdmin={isAdmin} />
              <StatsStrip post={post} />
              <Tabs
                activeTab={activeTab}
                onChange={setActiveTab}
                commentsCount={comments.length}
                internalCount={internalNotes.length}
                canSeeInternal={canSeeInternal}
              />
              {activeTab === 'comments' && commentsError && (
                <RetryBanner message={commentsError} onRetry={pcsFlow.retryComments} />
              )}
              {activeTab === 'internal' && notesError && (
                <RetryBanner message={notesError} onRetry={pcsFlow.retryInternalNotes} />
              )}
              <div className="flex-1">
                {activeTab === 'comments' && !commentsError ? (
                  <>
                    <CommentList
                      comments={comments}
                      reactions={reactions}
                      userRoles={userRoles}
                      currentEmail={userEmail}
                      isInternal={false}
                      truncateAt={4}
                      onReply={onReplyToComment}
                      onLongPress={onLongPressComment}
                      emptyLabel="No comments yet"
                    />
                    {comments.length > 4 ? (
                      <ViewAllLink
                        label={`View all ${comments.length} comments`}
                        onClick={() => setThreadView('comments')}
                      />
                    ) : null}
                  </>
                ) : null}

                {activeTab === 'internal' && canSeeInternal && !notesError ? (
                  <>
                    <CommentList
                      comments={internalNotes}
                      reactions={reactions}
                      userRoles={userRoles}
                      currentEmail={userEmail}
                      isInternal={true}
                      truncateAt={4}
                      onReply={onReplyToComment}
                      onLongPress={onLongPressComment}
                      emptyLabel={`No internal notes yet ${'·'} PRIVATE`}
                    />
                    {internalNotes.length > 4 ? (
                      <ViewAllLink
                        label={`View all ${internalNotes.length} internal notes`}
                        onClick={() => setThreadView('internal')}
                      />
                    ) : null}
                  </>
                ) : null}

                {activeTab === 'activity' ? <ActivityFeed /> : null}
              </div>
              <div className="sticky bottom-0 z-10 bg-bg">
                {renderClientActionBar()}
                {activeTab !== 'activity' && (
                  <Composer activeTab={activeTab} replyTo={replyTo} onCancelReply={() => setReplyTo(null)} />
                )}
              </div>
            </>
          )}
        </div>
      </Overlay>

      {post && (
        <PcsDetailSheet
          post={post}
          isAdmin={isAdmin}
          canEdit={canEdit}
          userRoles={userRoles}
          open={detailSheetOpen}
          onClose={() => setDetailSheetOpen(false)}
          actor={userEmail}
        />
      )}

      {activeSheet === 'title' && post && (
        <PropertySheet
          field={TITLE_FIELD_CONFIG.field}
          title={TITLE_FIELD_CONFIG.title}
          currentValue={post[TITLE_FIELD_CONFIG.field]}
          inputType={TITLE_FIELD_CONFIG.inputType}
          placeholder={TITLE_FIELD_CONFIG.placeholder}
          reseedOg={TITLE_FIELD_CONFIG.reseedOg}
          onClose={() => setActiveSheet(null)}
        />
      )}

      {actionSheet && (
        <CommentActionSheet
          comment={actionSheet.comment}
          isInternal={actionSheet.isInternal}
          canDelete={isAdmin || actionSheet.comment.author === userEmail}
          currentEmail={userEmail}
          onReply={(c) => { onReplyToComment(c); setActionSheet(null); }}
          onClose={() => setActionSheet(null)}
        />
      )}

      {threadView === 'comments' && post ? (
        <FullScreenThread
          title="All comments"
          isInternal={false}
          comments={comments}
          userRoles={userRoles}
          reactions={reactions}
          currentEmail={userEmail}
          onClose={() => setThreadView(null)}
        />
      ) : null}

      {threadView === 'internal' && post ? (
        <FullScreenThread
          title="All internal notes"
          isInternal={true}
          comments={internalNotes}
          userRoles={userRoles}
          reactions={reactions}
          currentEmail={userEmail}
          onClose={() => setThreadView(null)}
        />
      ) : null}
    </ErrorBoundary>
  );
}
