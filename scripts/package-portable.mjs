/**
 * FRIGG — empacotamento PORTÁTIL (sem electron-builder / sem assinatura / sem admin).
 * Monta release/FRIGG-win/ com o runtime do Electron + o app em resources/app e
 * renomeia o executável para FRIGG.exe. Gera um app rodável por duplo clique.
 *
 * Uso: npm run package:portable   (roda o build antes)
 * Pré-requisito: o binário do Electron precisa estar extraído em
 *   node_modules/electron/dist/electron.exe (o `npm install` normalmente faz isso;
 *   se faltar: `node node_modules/electron/install.js`).
 */
import { cpSync, rmSync, mkdirSync, readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const root = process.cwd();
const require = createRequire(import.meta.url);
const electronBinary = require('electron');
const src = dirname(electronBinary);
if (process.platform !== 'win32' || !existsSync(electronBinary) || !electronBinary.toLowerCase().endsWith('electron.exe')) {
  console.error('O pacote portátil Windows deve ser gerado no Windows com o Electron instalado.');
  process.exit(1);
}
if (!existsSync(join(root, 'dist', 'main', 'main.cjs'))) {
  console.error('dist/ ausente. Rode: npm run build');
  process.exit(1);
}

const out = join(root, 'release', 'FRIGG-win');
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(src, out, { recursive: true });

const app = join(out, 'resources', 'app');
mkdirSync(app, { recursive: true });
cpSync(join(root, 'dist'), join(app, 'dist'), { recursive: true });

// Dependências nativas em runtime (main.cjs as declara como external): copia o
// scope @lydell (node-pty + binário prebuilt win32-x64) para o app empacotado.
const lydellSrc = join(root, 'node_modules', '@lydell');
if (existsSync(lydellSrc)) {
  const lydellDst = join(app, 'node_modules', '@lydell');
  mkdirSync(lydellDst, { recursive: true });
  cpSync(lydellSrc, lydellDst, { recursive: true });
  console.log('incluído: @lydell/node-pty (terminais reais)');
} else {
  console.warn('AVISO: @lydell não encontrado — terminais ficarão indisponíveis no exe.');
}

writeFileSync(
  join(app, 'package.json'),
  JSON.stringify({ name: 'frigg-canvas', version: JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version, main: 'dist/main/main.cjs' }, null, 2),
);

renameSync(join(out, 'electron.exe'), join(out, 'FRIGG.exe'));
console.log('OK -> release/FRIGG-win/FRIGG.exe (duplo clique para abrir)');
