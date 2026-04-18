import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite config for Sorted React runtime.
//
// PR A5: adds React plugin so JSX compiles. IIFE output so the
//        bundle loads via classic <script src>, matching the rest
//        of the frontend which is non-module.
//
//        The entry is `src/index.jsx` (not `.js`) because the file
//        contains JSX. Vite's esbuild pre-parse does not accept JSX
//        in a `.js` file without aggressive overrides, so the spec's
//        `.js` extension was changed to `.jsx` — an idiomatic rename
//        that keeps the plugin config minimal.
//
// Output format MUST stay IIFE. Do not switch to ESM.

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: 'src/index.jsx',
      formats: ['iife'],
      name: 'SortedReact',
      fileName: () => 'sorted-react.js'
    },
    outDir: 'dist',
    emptyOutDir: true,
    // Minified because React 19's unminified distribution is
    // ~1.66 MB (dev/prod ternaries that can't tree-shake without
    // minification). Minified lands ~150 KB. NODE_ENV=production is
    // set by Vite automatically in lib mode, so only the prod React
    // paths are retained even before minification.
    minify: 'esbuild',
    sourcemap: true,
    target: 'es2020'
  }
});
