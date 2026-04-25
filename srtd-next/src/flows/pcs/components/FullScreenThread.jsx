import React from 'react';
import { FullScreenEditor } from './FullScreenEditor.jsx';
import { CommentList } from './CommentList.jsx';
import { Composer } from './Composer.jsx';

export function FullScreenThread({
  title, isInternal, comments, userRoles, reactions,
  currentEmail, onClose, onReplyToComment,
}) {
  return (
    <FullScreenEditor title={title} onClose={onClose}>
      <div className="flex flex-col flex-1 min-h-full">
        <div className="flex-1 overflow-y-auto px-0">
          <CommentList
            comments={comments}
            userRoles={userRoles}
            reactions={reactions}
            currentEmail={currentEmail}
            isInternal={isInternal}
            truncateAt={null}
            onReply={(c) => { onReplyToComment(c); onClose(); }}
            onLongPress={() => {}}
          />
        </div>
        <Composer activeTab={isInternal ? 'internal' : 'comments'} />
      </div>
    </FullScreenEditor>
  );
}
