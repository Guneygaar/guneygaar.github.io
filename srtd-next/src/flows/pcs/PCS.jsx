import React, { useState } from 'react';
import { ErrorBoundary, Overlay } from '../../core/ui/index.js';
import { usePcsFlowState } from './flowStore.js';
import { usePcsStore } from './pcsStore.js';
import { useAppState } from '../../core/stores/appState.js';
import { pcsFlow } from './index.js';
import { Topbar } from './components/Topbar.jsx';
import { PropertiesTable } from './components/PropertiesTable.jsx';
import { LinkedInIndicator } from './components/LinkedInIndicator.jsx';
import { CaptionBlock } from './components/CaptionBlock.jsx';
import { PhotoStrip } from './components/PhotoStrip.jsx';
import { LinkCards } from './components/LinkCards.jsx';
import { Tabs } from './components/Tabs.jsx';
import { CommentList } from './components/CommentList.jsx';
import { Composer } from './components/Composer.jsx';
import { RetryBanner } from './components/RetryBanner.jsx';
import { StageSheet } from './components/StageSheet.jsx';
import { PropertySheet } from './components/PropertySheet.jsx';
import { CommentActionSheet } from './components/CommentActionSheet.jsx';

// Fields still routed through the full-screen PropertySheet (title +
// long text fields). Chip fields (owner/target/format/pillar/location)
// moved to inline dropdowns owned by PropertiesTable itself.
function fieldConfig(which) {
  switch (which) {
    case 'title':          return { field: 'title', title: 'Title', inputType: 'text', placeholder: 'Post title', reseedOg: true };
    default: return null;
  }
}

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
  const userRole = useAppState((s) => s.user?.role || '');
  const userEmail = useAppState((s) => s.user?.email || '');
  const [activeTab, setActiveTab] = useState('comments');
  const [stageSheetOpen, setStageSheetOpen] = useState(false);
  const [activeSheet, setActiveSheet] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [actionSheet, setActionSheet] = useState(null);

  const roleLc = String(userRole).toLowerCase();
  const isClient = roleLc === 'client';
  const isAdmin = roleLc === 'admin';
  const isAgency = !isClient;
  const canEdit = isAgency;
  const canMove = isAgency;
  const canSeeInternal = isAgency;
  const currentThread = activeTab === 'internal' ? internalNotes : comments;
  const currentError = activeTab === 'internal' ? notesError : commentsError;
  const currentRetry = activeTab === 'internal' ? pcsFlow.retryInternalNotes : pcsFlow.retryComments;
  const emptyLabel = activeTab === 'internal' ? `No internal notes yet ${'\u00B7'} PRIVATE` : 'No comments yet';

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
              <Topbar post={post} isAdmin={isAdmin} canMove={canMove} onMoveStage={() => setStageSheetOpen(true)} />
              <PhotoStrip post={post} canEdit={canEdit} />
              <div className="px-3 pt-3 pb-1">
                <h1
                  onClick={canEdit ? () => setActiveSheet('title') : undefined}
                  className={`font-serif text-[26px] font-semibold leading-[1.15] tracking-[-0.02em] text-text-loud ${canEdit ? 'cursor-pointer' : ''}`}
                >
                  {post.title || 'Untitled'}
                </h1>
              </div>
              {!isClient && <PropertiesTable post={post} canEdit={canEdit} userRoles={userRoles} />}
              <div className="h-6" />
              <LinkedInIndicator post={post} />
              <LinkCards post={post} linkedinLink={post.linkedin_link} />
              <div className="h-6" />
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

      {stageSheetOpen && post && (
        <StageSheet post={post} onClose={() => setStageSheetOpen(false)} />
      )}

      {activeSheet && post && (() => {
        const cfg = fieldConfig(activeSheet);
        if (!cfg) return null;
        return (
          <PropertySheet
            field={cfg.field}
            title={cfg.title}
            currentValue={post[cfg.field]}
            options={cfg.options}
            inputType={cfg.inputType}
            placeholder={cfg.placeholder}
            reseedOg={!!cfg.reseedOg}
            onClose={() => setActiveSheet(null)}
          />
        );
      })()}

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
