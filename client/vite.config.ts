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
        // Use the IPv4 loopback explicitly: on macOS `localhost` resolves to
        // IPv6 `::1` first, and the proxy stalls ~4s per cold connection before
        // falling back to IPv4 — which makes freshly-navigated pages look like
        // their data never loads until you interact.
        target: 'http://127.0.0.1:4000',
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
        target: 'http://127.0.0.1:4000',
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
