// PR A3 probe. Confirms Vite IIFE builds and executes.
// Will be replaced in PR A5 when real React mounting arrives.

export function probe() {
  console.log('[sorted-react] probe ok');
  return { version: '0.1.0', built: true };
}
