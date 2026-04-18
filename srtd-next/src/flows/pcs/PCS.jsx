import React, { useState } from 'react';
import { ErrorBoundary, Overlay } from '../../core/ui/index.js';
import { usePcsFlowState } from './flowStore.js';
import { usePcsStore } from './pcsStore.js';
import { useAppState } from '../../core/stores/appState.js';
import { pcsFlow } from './index.js';
import { Topbar } from './components/Topbar.jsx';
import { StageStrip } from './components/StageStrip.jsx';
import { PropertiesTable } from './components/PropertiesTable.jsx';
import { LinkedInIndicator } from './components/LinkedInIndicator.jsx';
import { CaptionBlock } from './components/CaptionBlock.jsx';
import { PhotoStrip } from './components/PhotoStrip.jsx';
import { LinkCards } from './components/LinkCards.jsx';
import { Tabs } from './components/Tabs.jsx';
import { CommentList } from './components/CommentList.jsx';
import { ComposerStub } from './components/ComposerStub.jsx';
import { RetryBanner } from './components/RetryBanner.jsx';

export function PCS() {
  const postId = usePcsFlowState(s => s.postId);
  const post = usePcsStore(s => s.post);
  const comments = usePcsStore(s => s.comments);
  const internalNotes = usePcsStore(s => s.internalNotes);
  const reactions = usePcsStore(s => s.reactions);
  const userRoles = usePcsStore(s => s.userRoles);
  const loading = usePcsStore(s => s.loading);
  const error = usePcsStore(s => s.error);
  const commentsError = usePcsStore(s => s.commentsError);
  const notesError = usePcsStore(s => s.notesError);
  const userRole = useAppState(s => s.user?.role || '');
  const userEmail = useAppState(s => s.user?.email || '');
  const [activeTab, setActiveTab] = useState('comments');

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
              <Topbar post={post} isAdmin={isAdmin} />
              <StageStrip post={post} canMove={canMove} />
              {!isClient && <PropertiesTable post={post} />}
              <LinkedInIndicator post={post} />
              <CaptionBlock post={post} canEdit={canEdit} userRoles={userRoles} />
              <PhotoStrip post={post} canEdit={canEdit} />
              <LinkCards post={post} />
              <Tabs activeTab={activeTab} onChange={setActiveTab} commentCount={comments.length} internalCount={internalNotes.length} canSeeInternal={canSeeInternal} />
              {currentError && <RetryBanner message={currentError} onRetry={currentRetry} />}
              <div className="flex-1">
                {!currentError && (
                  <CommentList
                    comments={currentThread}
                    reactions={reactions}
                    userRoles={userRoles}
                    currentEmail={userEmail}
                    emptyLabel={emptyLabel}
                  />
                )}
              </div>
              <ComposerStub activeTab={activeTab} />
            </>
          )}
        </div>
      </Overlay>
    </ErrorBoundary>
  );
}
