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
import { Composer } from './components/Composer.jsx';
import { RetryBanner } from './components/RetryBanner.jsx';
import { StageSheet } from './components/StageSheet.jsx';
import { PropertySheet } from './components/PropertySheet.jsx';
import { OwnerSheet } from './components/OwnerSheet.jsx';
import { CommentActionSheet } from './components/CommentActionSheet.jsx';
import { FORMATS, PILLARS, LOCATIONS } from '../../core/mappings.js';
import { Pencil } from 'lucide-react';

const FORMAT_OPTIONS = FORMATS.map((f) => ({ value: f, label: f }));
const PILLAR_OPTIONS = PILLARS.map((p) => ({ value: p.toLowerCase(), label: p }));
const LOCATION_OPTIONS = LOCATIONS.map((l) => ({ value: l, label: l }));

function fieldConfig(which, post) {
  switch (which) {
    case 'target':         return { field: 'target_date', title: 'Target date', inputType: 'date', placeholder: 'YYYY-MM-DD' };
    case 'format':         return { field: 'format', title: 'Format', options: FORMAT_OPTIONS, currentValue: post.format };
    case 'pillar':         return { field: 'content_pillar', title: 'Content pillar', options: PILLAR_OPTIONS, currentValue: post.content_pillar };
    case 'location':       return { field: 'location', title: 'Location', options: LOCATION_OPTIONS, currentValue: post.location };
    case 'title':          return { field: 'title', title: 'Title', inputType: 'text', placeholder: 'Post title', reseedOg: true };
    case 'drive':          return { field: 'drive_link', title: 'Drive link', inputType: 'url', placeholder: 'https://drive.google.com/...' };
    case 'canva':          return { field: 'canva_link', title: 'Canva link', inputType: 'url', placeholder: 'https://canva.com/...' };
    case 'internal_notes': return { field: 'internal_notes', title: 'Internal notes', inputType: 'textarea', placeholder: 'Notes for the agency team' };
    case 'client_feedback':return { field: 'client_feedback', title: 'Client feedback', inputType: 'textarea', placeholder: 'Feedback from the client' };
    case 'caption':        return { field: 'caption', title: 'Caption', inputType: 'textarea', placeholder: 'Post caption', reseedOg: true };
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
              <Topbar post={post} isAdmin={isAdmin} canEdit={canEdit} onEditTitle={() => setActiveSheet('title')} />
              <StageStrip post={post} canMove={canMove} onMove={() => setStageSheetOpen(true)} />
              {!isClient && <PropertiesTable post={post} canEdit={canEdit} onEdit={(which) => setActiveSheet(which === 'owner' ? 'owner' : which)} />}
              <LinkedInIndicator post={post} />
              <CaptionBlock post={post} canEdit={canEdit} userRoles={userRoles} onEdit={() => setActiveSheet('caption')} />
              <PhotoStrip post={post} canEdit={canEdit} />
              <LinkCards post={post} />
              {canEdit && (
                <div className="flex flex-wrap gap-2 px-3 py-2 border-b border-divider-warm font-mono text-2xs text-text-dim tracking-wide uppercase">
                  <button onClick={() => setActiveSheet('drive')} className="inline-flex items-center gap-1 px-2 py-1 rounded-sm2 hover:bg-bg-2"><Pencil size={10} /> Drive</button>
                  <button onClick={() => setActiveSheet('canva')} className="inline-flex items-center gap-1 px-2 py-1 rounded-sm2 hover:bg-bg-2"><Pencil size={10} /> Canva</button>
                  {!isClient && <button onClick={() => setActiveSheet('internal_notes')} className="inline-flex items-center gap-1 px-2 py-1 rounded-sm2 hover:bg-bg-2"><Pencil size={10} /> Internal notes</button>}
                  <button onClick={() => setActiveSheet('client_feedback')} className="inline-flex items-center gap-1 px-2 py-1 rounded-sm2 hover:bg-bg-2"><Pencil size={10} /> Client feedback</button>
                </div>
              )}
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

      {activeSheet === 'owner' && (
        <OwnerSheet onClose={() => setActiveSheet(null)} />
      )}

      {activeSheet && activeSheet !== 'owner' && post && (() => {
        const cfg = fieldConfig(activeSheet, post);
        if (!cfg) return null;
        return (
          <PropertySheet
            field={cfg.field}
            title={cfg.title}
            currentValue={cfg.currentValue !== undefined ? cfg.currentValue : post[cfg.field]}
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
