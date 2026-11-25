import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import purgeCss from '@fullhuman/postcss-purgecss';

const purge = purgeCss.default || purgeCss;

// Class-name fragments that are assembled at runtime (e.g. `nv-pill-${type}-${status}`), which a static
// scan of the JSX cannot see. Anything matching stays in the bundle.
const DYNAMIC_CLASSES = [
  /^is-/, /^nv-pill-/, /^nv-tag-/, /^nv-prio-/, /^priority-/, /^nv-col-/, /^nv-role-/, /^nv-tone-/,
  /^avatar-/, /^toast-/, /^nv-membership/, /^nv-due/, /^nv-chip/,
];

export default defineConfig(({ command }) => ({
  plugins: [react()],
  server: { port: 5173 },
  css: {
    // The app ships five stacked stylesheets that grew over several redesigns; drop every rule whose class
    // is never used by the app (production build only, so local dev keeps the full files).
    postcss: { plugins: command === 'build' ? [purge({ content: ['./index.html', './src/**/*.{js,jsx}'], safelist: { standard: DYNAMIC_CLASSES }, keyframes: true })] : [] },
  },
  build: {
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        // Stable vendor chunks: cached across deploys, loaded in parallel.
        manualChunks: {
          react: ['react', 'react-dom'],
          supabase: ['@supabase/supabase-js'],
          icons: ['lucide-react'],
        },
      },
    },
  },
}));
