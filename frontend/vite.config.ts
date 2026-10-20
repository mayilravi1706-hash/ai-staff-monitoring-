import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const backendPort = process.env.BACKEND_PORT || '5000';
const frontendPort = parseInt(process.env.PORT || '3000', 10);

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname, '.'),
  server: {
    host: '0.0.0.0',
    port: frontendPort,
    proxy: {
      '/api': {
        target: `http://localhost:${backendPort}`,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: path.resolve(__dirname, '../dist/frontend'),
    emptyOutDir: true,
  },
});
