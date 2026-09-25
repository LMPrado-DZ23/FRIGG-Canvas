// Bundla o processo main e o preload do Electron para CJS com esbuild.
// Nativos e electron ficam como external (resolvidos em runtime).
import { build } from 'esbuild';
import { readFileSync, rmSync } from 'node:fs';

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
};

// Main: no bundle CJS, import.meta.url fica undefined. Injeta um valor válido a
// partir de __filename (disponível em CJS) para fileURLToPath funcionar.
await build({
  ...common,
  entryPoints: ['src/main/main.ts'],
  outfile: 'dist/main/main.cjs',
  define: { 'import.meta.url': '__frigg_import_meta_url' },
  banner: { js: "const __frigg_import_meta_url = require('url').pathToFileURL(__filename).href;" },
});
// Preload roda com sandbox: true, onde só `require('electron')` existe. Nada de
// banner com require('url') aqui — ele quebrava o preload e o app ficava sem ponte.
await build({ ...common, entryPoints: ['src/preload/preload.ts'], outfile: 'dist/preload/preload.cjs' });
const preload = readFileSync('dist/preload/preload.cjs', 'utf8');
const requires = [...preload.matchAll(/require\((['"])([^'"]+)\1\)/g)].map((m) => m[2]).filter((m) => m !== 'electron');
if (requires.length > 0) throw new Error(`preload sandboxed não pode usar require(${requires.join(', ')})`);
console.log('main + preload bundled -> dist/');
