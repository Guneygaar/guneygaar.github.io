// Bridge used by React flows (CaptionField ⤢, PasteSheet admin) to
// open the Caption Workspace.
//
// As of B5.5a.4 this routes to the pure-React workspace mounted in
// App.jsx (srtd-next/src/shared/caption-workspace). The vanilla
// window.openCaptionWorkspace is left untouched — PCS (Polish / QC /
// Rewrite) continues to consume that DOM-backed overlay directly.
//
// opts shape (all optional except mode):
//   mode:           'write' | 'chat'
//   postId:         null   (detached only — React path never patches /posts)
//   initialCaption: string
//   syntheticContext: { brief, title, pillar, location, format, source }
//   onUse:          (captionText) => void
//   onClose:        () => void

import { useCaptionWorkspaceStore } from '../../shared/caption-workspace/store.js';

export function openCaptionWorkspace(mode, opts = {}) {
  useCaptionWorkspaceStore.getState().open(mode, opts);
}

// Read the live session cost from the React store. Create Post's
// cost chip polls this every 600 ms (see CaptionField.jsx).
export function getSessionCost() {
  try {
    return useCaptionWorkspaceStore.getState().sessionCost || 0;
  } catch (e) {
    return 0;
  }
}
