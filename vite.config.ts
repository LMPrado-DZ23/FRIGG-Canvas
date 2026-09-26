import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

const root = import.meta.dirname;

// Pacotes estáveis em chunks próprios (cache entre versões). three/R3F/drei
// ficam FORA: vão junto com o Office3D (lazy) e não são pré-carregados na
// inicialização (~1 MB).
const VENDOR_CHUNKS: readonly (readonly [string, readonly string[]])[] = [
  ['vendor-react', ['react', 'react-dom', 'scheduler', 'zustand']],
  ['vendor-flow', ['@xyflow/react', '@xyflow/system']],
  ['vendor-terminal', ['@xterm/xterm', '@xterm/addon-fit']],
];

function vendorChunk(id: string): string | undefined {
  const normalized = id.replaceAll('\\', '/');
  for (const [chunk, packages] of VENDOR_CHUNKS) {
    if (packages.some((pkg) => normalized.includes(`/node_modules/${pkg}/`))) return chunk;
  }
  return undefined;
}

// Renderer do FRIGG. base './' para carregar via file:// no Electron empacotado.
export default defineConfig({
  root: resolve(root, 'src/renderer'),
  base: './',
  plugins: [react()],
  build: {
    outDir: resolve(root, 'dist/renderer'),
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 1_400, // chunk lazy do escritório 3D (three + drei)
    rollupOptions: {
      output: { manualChunks: vendorChunk },
    },
  },
  server: { port: 5173, strictPort: true },
});
