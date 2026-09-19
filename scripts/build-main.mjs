// Bundla o processo main e o preload do Electron para CJS com esbuild.
// Nativos e electron ficam como external (resolvidos em runtime).
import { build } from 'esbuild';

const external = ['electron', '@homebridge/node-pty-prebuilt-multiarch', 'node-pty', 'better-sqlite3'];

const common = {
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  sourcemap: true,
  external,
  logLevel: 'info',
};

await build({ ...common, entryPoints: ['src/main/main.ts'], outfile: 'dist/main/main.cjs' });
await build({ ...common, entryPoints: ['src/preload/preload.ts'], outfile: 'dist/preload/preload.cjs' });
console.log('main + preload bundled -> dist/');
