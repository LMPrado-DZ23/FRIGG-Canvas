# Dependências do app desktop

Runtime do processo principal (vão para o instalador):

- `@lydell/node-pty` — PTY real dos terminais (prebuilds N-API, sem compilador; fica fora do asar).
- `electron-updater` — atualização automática via GitHub Releases (só na versão instalada).

Todo o resto é **build-time** (`devDependencies`) e chega ao app já empacotado pelo Vite
(renderer) ou pelo esbuild (main/preload):

- UI: `react` 19, `@xyflow/react` (canvas), `@xterm/xterm` 6 (terminal), `three` +
  `@react-three/fiber` 9 + `@react-three/drei` 10 (escritório 3D, carregado sob demanda), `zustand`.
- Build: `vite` 8 (Rolldown), `esbuild`, `typescript` 6.0, `electron` 44, `electron-builder`.
- Qualidade: `eslint` + `typescript-eslint`, `vitest`, `@playwright/test` (E2E com Electron).

O preload roda com `sandbox: true` e só pode importar `electron`; o build falha se ele
passar a depender de qualquer outro módulo.

Atualizações: o Dependabot abre PRs semanais (npm, minors/patches agrupados) e mensais
(GitHub Actions). Majors vêm em PRs separados e passam pela suíte completa, incluindo E2E.
