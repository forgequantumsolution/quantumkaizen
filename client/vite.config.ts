import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        // Point the dev proxy at the remote backend so the SPA talks to it
        // through same-origin /api (no CORS). Swap back to a local target
        // (e.g. http://127.0.0.1:4000) when running the backend locally.
        target: 'http://68.178.164.38:8080',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (_err, _req, res) => {
            if (res && 'writeHead' in res) {
              res.writeHead(503, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: { code: 'BACKEND_UNAVAILABLE', message: 'Backend server is not running' } }));
            }
          });
        },
      },
      '/socket.io': {
        target: 'http://68.178.164.38:8080',
        ws: true,
      },
    },
  },
  build: {
    sourcemap: mode !== 'production',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          query: ['@tanstack/react-query', '@tanstack/react-table'],
          charts: ['recharts'],
          ui: ['framer-motion', 'lucide-react', 'clsx', 'tailwind-merge'],
          state: ['zustand', 'axios', 'zod'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
}));
