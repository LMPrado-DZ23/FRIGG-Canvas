# FRIGG Canvas

Camada de **canvas + orquestração de agentes** sobre o **OmniRoute** (serviço
headless). Concorrente melhor que o Maestri; o diferencial é que cada nó roteia
pelo OmniRoute. Alvo: `.exe` Windows assinado, com auto-update.

> Coordenação de projeto e decisões A–G: `../Regente/REGENTE-PLANO-CONSENSO.md`
> e `../Regente/REGENTE-HANDOFF.md`. Espelho na MCP dz23:
> `project=regente`, `mission=regente-omniroute-contract`.

## Status por componente (honesto)

| Componente | Estado | Evidência |
|---|---|---|
| Núcleo: máquina de estados de turno (G4) | ✅ implementado + testado | `npm test` → 24 testes |
| Núcleo: cliente OmniRoute (saúde honesta) | ✅ implementado + testado | idem |
| Núcleo: contrato de adaptador de harness (G2) | ✅ implementado + testado | idem |
| Typecheck strict | ✅ limpo | `npm run typecheck` (exit 0) |
| Electron main + preload tipado (segurança) | 🟡 código escrito, **NÃO buildado** | requer deps desktop |
| Renderer React + React Flow + notas | ⬜ NÃO_IMPLEMENTADO (próximo incremento) | — |
| Terminal PTY real (xterm + node-pty) | ⬜ NÃO_IMPLEMENTADO (requer build tools) | — |
| Persistência SQLite | ⬜ NÃO_IMPLEMENTADO | — |
| Empacotamento .exe / assinatura | ⬜ fase posterior | — |

Nada aqui declara "TESTADO" sem teste executado. O que está verde é só o núcleo puro.

## Decisões que o código encarna

- **G4** — processo vivo ≠ resposta do modelo ≠ turno encerrado ≠ resultado
  validado. Cancelamento pedido ≠ confirmado. Stream cortado → `unknown`, nunca
  `completed`. (`src/core/turn-state.ts`)
- **Saúde honesta** — serviço ausente = `unavailable`; nunca `reachable` sem
  sonda HTTP OK. (`src/core/omniroute-client.ts`)
- **G2** — nó gerenciado = sessão de harness via adaptador estruturado
  (Codex App Server / Claude Agent SDK), não chamada `/v1`. Terminal PTY puro
  não é elegível a nó de grafo. (`src/core/harness-adapter.ts`)
- **Segurança Electron** — contextIsolation on, sandbox on, sem nodeIntegration,
  sem webview privilegiada. (`src/main/main.ts`, `src/preload/preload.ts`)

## Rodar os testes do núcleo

```bash
npm install
npm test
npm run typecheck
```

## Próximo incremento (continuação do Marco 1)

Renderer React + React Flow (canvas) + notas + persistência SQLite + terminal
PTY real. Passos e dependências desktop em `DEPS-DESKTOP.md`. O terminal PTY
exige build tools (node-gyp) — por isso não entra no `npm test` do núcleo.
