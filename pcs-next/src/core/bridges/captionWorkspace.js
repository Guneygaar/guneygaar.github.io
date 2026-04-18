// Bridge to window.openCaptionWorkspace defined in
// actions/pcs-claude-caption.js:52. Detached mode is triggered
// when postId is explicitly null.
//
// opts shape (all optional except mode):
//   mode:           'write' | 'chat' | 'resume'
//   postId:         string | null (null = detached)
//   initialCaption: string
//   syntheticContext: object (brief, pillar, audience hints)
//   onUse:          (captionText) => void
//   onClose:        () => void

export function openCaptionWorkspace(mode, opts = {}) {
  if (typeof window === 'undefined') return;
  if (typeof window.openCaptionWorkspace !== 'function') {
    console.warn('[sorted-react/captionWorkspace] window.openCaptionWorkspace not yet defined');
    return;
  }
  return window.openCaptionWorkspace(mode, opts);
}

// Read the live session cost from window._captionWS (initialized
// by actions/pcs-claude-caption.js:8). Returns 0 if not ready.
export function getSessionCost() {
  if (typeof window === 'undefined') return 0;
  const ws = window._captionWS;
  if (!ws || typeof ws.sessionCost !== 'number') return 0;
  return ws.sessionCost;
}
