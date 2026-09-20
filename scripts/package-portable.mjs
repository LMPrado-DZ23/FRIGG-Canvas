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
import { cpSync, rmSync, mkdirSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const src = join(root, 'node_modules', 'electron', 'dist');
if (!existsSync(join(src, 'electron.exe'))) {
  console.error('electron.exe ausente. Rode: node node_modules/electron/install.js');
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
writeFileSync(
  join(app, 'package.json'),
  JSON.stringify({ name: 'frigg-canvas', version: '0.0.1', main: 'dist/main/main.cjs' }, null, 2),
);

renameSync(join(out, 'electron.exe'), join(out, 'FRIGG.exe'));
console.log('OK -> release/FRIGG-win/FRIGG.exe (duplo clique para abrir)');
