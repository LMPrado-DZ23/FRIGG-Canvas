import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// Renderer do FRIGG. base './' para carregar via file:// no Electron empacotado.
export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  base: './',
  plugins: [react()],
  build: {
    outDir: resolve(__dirname, 'dist/renderer'),
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 1_000,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'zustand'],
          'vendor-flow': ['@xyflow/react'],
          'vendor-terminal': ['@xterm/xterm', '@xterm/addon-fit'],
          'vendor-three': ['three', '@react-three/fiber', '@react-three/drei'],
        },
      },
    },
  },
  server: { port: 5173, strictPort: true },
});
