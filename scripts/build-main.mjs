// Bundla o processo main e o preload do Electron para CJS com esbuild.
// Nativos e electron ficam como external (resolvidos em runtime).
import { build } from 'esbuild';
import { copyFileSync, existsSync, readFileSync, rmSync } from 'node:fs';

// electron-updater fica external: só é importado (dinamicamente) na versão instalada,
// onde o electron-builder o inclui em node_modules; o portátil nunca o carrega.
const external = ['electron', '@lydell/node-pty', 'electron-updater'];

rmSync('dist/main', { recursive: true, force: true });
rmSync('dist/preload', { recursive: true, force: true });

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));

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
  define: { 'import.meta.url': '__frigg_import_meta_url', __FRIGG_VERSION__: JSON.stringify(version) },
  banner: { js: "const __frigg_import_meta_url = require('url').pathToFileURL(__filename).href;" },
});
// Preload roda com sandbox: true, onde só `require('electron')` existe. Nada de
// banner com require('url') aqui — ele quebrava o preload e o app ficava sem ponte.
await build({ ...common, entryPoints: ['src/preload/preload.ts'], outfile: 'dist/preload/preload.cjs' });
const preload = readFileSync('dist/preload/preload.cjs', 'utf8');
const requires = [...preload.matchAll(/require\((['"])([^'"]+)\1\)/g)].map((m) => m[2]).filter((m) => m !== 'electron');
if (requires.length > 0) throw new Error(`preload sandboxed não pode usar require(${requires.join(', ')})`);
// Ícone da janela/barra de tarefas (o instalador usa build/icon.png direto).
if (existsSync('build/icon.png')) copyFileSync('build/icon.png', 'dist/icon.png');
console.log('main + preload bundled -> dist/');
