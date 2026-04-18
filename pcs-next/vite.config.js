import { defineConfig } from 'vite';

// Vite config for Sorted React runtime.
//
// PR A3: single-entry IIFE bundle, unminified, for probe
//        verification. No React imports yet.
//
// Future PRs (A5+) will expand this to multi-entry and split
// React/Zustand into a shared vendor bundle.
//
// Output format MUST stay IIFE. The Sorted app loads this via
// <script src="...">, not <script type="module">, because the
// rest of the frontend is non-module.

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.js',
      formats: ['iife'],
      name: 'SortedReact',
      fileName: () => 'sorted-react.js'
    },
    outDir: 'dist',
    emptyOutDir: true,
    minify: false,
    sourcemap: true,
    target: 'es2020'
  }
});
