// Sorted React bundle entry. Exported names become
// properties of window.SortedReact in the IIFE build.

import { probe } from './_probe.js';

if (typeof window !== 'undefined') {
  console.log('[sorted-react] bundle loaded, v0.1.0');
}

export { probe };
