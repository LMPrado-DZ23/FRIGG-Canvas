// Bundla o processo main e o preload do Electron para CJS com esbuild.
// Nativos e electron ficam como external (resolvidos em runtime).
import { build } from 'esbuild';
import { rmSync } from 'node:fs';

const external = ['electron', '@lydell/node-pty', 'node-pty', 'better-sqlite3'];

rmSync('dist/main', { recursive: true, force: true });
rmSync('dist/preload', { recursive: true, force: true });

const common = {
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  sourcemap: false,
  external,
  logLevel: 'info',
  // No bundle CJS, import.meta.url fica undefined. Injeta um valor válido a
  // partir de __filename (disponível em CJS) para fileURLToPath funcionar.
  define: { 'import.meta.url': '__frigg_import_meta_url' },
  banner: { js: "const __frigg_import_meta_url = require('url').pathToFileURL(__filename).href;" },
};

await build({ ...common, entryPoints: ['src/main/main.ts'], outfile: 'dist/main/main.cjs' });
await build({ ...common, entryPoints: ['src/preload/preload.ts'], outfile: 'dist/preload/preload.cjs' });
console.log('main + preload bundled -> dist/');
