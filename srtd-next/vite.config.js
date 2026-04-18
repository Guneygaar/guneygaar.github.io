import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite config for Sorted React runtime.
//
// IIFE output because the rest of the Sorted frontend loads
// scripts via classic <script src>, not ES modules.
//
// define block: Vite library mode does NOT auto-replace
// process.env.NODE_ENV. Zustand and React 19 both check it
// at runtime, which throws "process is not defined" in the
// browser. Replace with a string literal at build time.

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    'process.env': JSON.stringify({})
  },
  build: {
    lib: {
      entry: 'src/index.jsx',
      formats: ['iife'],
      name: 'SortedReact',
      fileName: () => 'sorted-react.js'
    },
    outDir: 'dist',
    emptyOutDir: true,
    minify: 'esbuild',
    sourcemap: true,
    target: 'es2020'
  }
});
