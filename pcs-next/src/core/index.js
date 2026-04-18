// Sorted React core runtime — single import surface.
//
// Consumers either:
//   import { tokens, toast, useAppState } from './core';
// OR tap the window global in dev:
//   window.SortedReact.tokens.claude
//   window.SortedReact.bridges.toast('hi')

import { tokens } from './tokens.js';
import * as mappings from './mappings.js';

import { useAppState, useIsAdmin } from './stores/appState.js';

import { toast } from './bridges/toast.js';
import { getAIConfig } from './bridges/config.js';
import { openCaptionWorkspace, getSessionCost } from './bridges/captionWorkspace.js';
import { uploadToR2 } from './bridges/r2.js';

import { apiFetch } from './api/client.js';
import { buildPostPayload, createPost } from './api/posts.js';
import { stampPostId } from './api/aiUsage.js';

import { compressImage, generateFilename } from './utils/imageCompress.js';

import * as ui from './ui/index.js';

export const stores = { useAppState, useIsAdmin };
export const bridges = { toast, getAIConfig, openCaptionWorkspace, getSessionCost, uploadToR2 };
export const api = { apiFetch, buildPostPayload, createPost, stampPostId };
export const utils = { compressImage, generateFilename };

export { tokens, mappings, ui };
