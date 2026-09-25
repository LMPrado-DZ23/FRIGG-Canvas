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
    chunkSizeWarningLimit: 1_400, // chunk lazy do escritório 3D (three + drei)
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'zustand'],
          'vendor-flow': ['@xyflow/react'],
          'vendor-terminal': ['@xterm/xterm', '@xterm/addon-fit'],
          // three/R3F/drei ficam FORA dos chunks manuais: assim vão junto com o
          // Office3D (lazy) e não são pré-carregados na inicialização (~1,3 MB).
        },
      },
    },
  },
  server: { port: 5173, strictPort: true },
});
