import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  // .env / .env.production live at the repo root (two levels above apps/frontEnd),
  // not inside this package — point Vite's env loader there so VITE_GRAPHQL_URL
  // and friends actually resolve instead of coming back undefined.
  envDir: path.resolve(__dirname, '../../..'),
  server: {
    port: 3000,
    fs: {
      allow: [
        path.resolve(__dirname, '../../skin'),
        path.resolve(__dirname, 'src'),
        path.resolve(__dirname),
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@skin': path.resolve(__dirname, '../../skin'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['src/**/e2e/**'],
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
  },
});
