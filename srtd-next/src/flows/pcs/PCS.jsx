import React, { useState } from 'react';
import { ErrorBoundary, Overlay } from '../../core/ui/index.js';
import { usePcsFlowState } from './flowStore.js';
import { usePcsStore } from './pcsStore.js';
import { useAppState, useIsAdmin, useIsClient } from '../../core/stores/appState.js';
import { pcsFlow } from './index.js';
import { KickerRow } from './components/KickerRow.jsx';
import { PcsDetailSheet } from './components/PcsDetailSheet.jsx';
import { CaptionBlock } from './components/CaptionBlock.jsx';
import { PhotoStrip } from './components/PhotoStrip.jsx';
import { Tabs } from './components/Tabs.jsx';
import { CommentList } from './components/CommentList.jsx';
import { Composer } from './components/Composer.jsx';
import { RetryBanner } from './components/RetryBanner.jsx';
import { PropertySheet } from './components/PropertySheet.jsx';
import { CommentActionSheet } from './components/CommentActionSheet.jsx';

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

  const isAgency = !isClient;
  const canEdit = !isClient;
  const canMove = !isClient;
  const canSeeInternal = isAgency;
  const currentThread = activeTab === 'internal' ? internalNotes : comments;
  const currentError = activeTab === 'internal' ? notesError : commentsError;
  const currentRetry = activeTab === 'internal' ? pcsFlow.retryInternalNotes : pcsFlow.retryComments;
  const emptyLabel = activeTab === 'internal' ? `No internal notes yet ${'·'} PRIVATE` : 'No comments yet';

  function onReplyToComment(c) {
    const authorName = c.author ? (userRoles.find((u) => u.email === c.author)?.name || c.author.split('@')[0]) : 'Unknown';
    setReplyTo({ id: c.id, authorName, message: c.message || '' });
  }

  function onLongPressComment(c, isInternal) {
    setActionSheet({ comment: c, isInternal });
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
              <CaptionBlock post={post} canEdit={canEdit} userRoles={userRoles} />
              <Tabs activeTab={activeTab} onChange={setActiveTab} commentCount={comments.length} internalCount={internalNotes.length} canSeeInternal={canSeeInternal} />
              {currentError && <RetryBanner message={currentError} onRetry={currentRetry} />}
              <div className="flex-1">
                {!currentError && (
                  <CommentList
                    comments={currentThread}
                    reactions={reactions}
                    userRoles={userRoles}
                    currentEmail={userEmail}
                    isInternal={activeTab === 'internal'}
                    onReply={onReplyToComment}
                    onLongPress={onLongPressComment}
                    emptyLabel={emptyLabel}
                  />
                )}
              </div>
              <Composer activeTab={activeTab} replyTo={replyTo} onCancelReply={() => setReplyTo(null)} />
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
    </ErrorBoundary>
  );
}
