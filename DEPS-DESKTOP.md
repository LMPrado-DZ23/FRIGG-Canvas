# Dependências do shell desktop (a adicionar no próximo incremento)

O `package.json` atual só traz o toolchain de teste do **núcleo puro**, para
`npm test` rodar rápido e sem build tools. O shell Electron/React/PTY precisa
destas dependências — adicionadas quando formos buildar a UI:

## Runtime / build
- `electron` — shell desktop
- `electron-builder` — empacotamento NSIS (.exe)
- `electron-updater` — auto-update (reaproveitar feed do OmniRoute)
- `vite` + `@vitejs/plugin-react` — bundler do renderer
- `react`, `react-dom`
- `@xyflow/react` (React Flow) — canvas de nós/arestas
- `xterm` (`@xterm/xterm`) + `@xterm/addon-fit` — terminal no canvas
- `node-pty` — PTY real (**requer** node-gyp + Visual Studio Build Tools no Windows)
- `better-sqlite3` — persistência local de layout/workspace (nativo)

## Ordem de trabalho do incremento
1. Vite + React + preload compilado (`preload.cjs`) + `index.html`.
2. Canvas React Flow com nós de nota e um nó de terminal.
3. `node-pty` atrás do main; renderer fala com o terminal só pelo preload.
4. `better-sqlite3` para salvar/restaurar layout do workspace.
5. Supervisão do OmniRoute headless (spawn + probeHealth); ausente = indisponível.

## Nota sobre módulos nativos
`node-pty` e `better-sqlite3` compilam contra o ABI do Electron — usar
`electron-rebuild` após instalar. É por isso que ficam fora do `npm test` do
núcleo puro (que roda em Node, sem Electron).
