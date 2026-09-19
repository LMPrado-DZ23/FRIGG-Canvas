# FRIGG Canvas

Camada de **canvas + orquestração de agentes** sobre o **OmniRoute** (serviço
headless). Concorrente melhor que o Maestri; o diferencial é que cada nó roteia
pelo OmniRoute. Alvo: `.exe` Windows assinado, com auto-update.

> Decisões A–G e D01–D12: `../Regente/*.md` e o canal `LMPrado-DZ23/ai-memory`
> (`docs/handoffs/regente/`). Memória cross-harness: MCP dz23 `project=regente`.

## Status por componente (honesto)

| Componente | Estado | Evidência |
|---|---|---|
| Núcleo: turn-state (G4), session-model (D05/D06), workspace, omniroute-client, claude-stream | ✅ implementado + testado | `npm test` → 43 testes |
| Typecheck strict | ✅ limpo | `npm run typecheck` (exit 0) |
| Renderer: Canvas 2D (React Flow), nós Terminal/Agente/Nota/Health | ✅ build OK | `npm run build:renderer` |
| Escritório 3D (React Three Fiber), lazy-load | ✅ build OK (chunk separado) | idem |
| View Operação (fallback DOM acessível, sem WebGL) | ✅ build OK | idem |
| Main Electron seguro + preload tipado | ✅ build OK | `npm run build:main` |
| Terminais PTY reais (xterm + node-pty pré-compilado) | 🟡 código pronto; binário nativo depende do ambiente | degrada p/ "indisponível" |
| Adaptador Claude (harness gerenciado, stream-json) | 🟡 implementado; execução ao vivo requer `claude` logado | mapeamento testado |
| Adaptador Codex App Server | ⬜ próximo (Marco 2b) | — |
| Empacotamento `.exe` (electron-builder) | 🟡 config pronta; build/assinatura fora deste ambiente | `npm run dist:win` |

Nada aqui diz "TESTADO" sem teste executado. O verde é núcleo + typecheck + builds.

## Rodar

```bash
npm install
npm test            # 43 testes
npm run build       # main + renderer
npm start           # abre a janela (baixa o binário do Electron na 1ª vez)
```

Terminais 100% (node-pty nativo): com Visual Studio Build Tools (C++) instalado,
rode `npm run rebuild`. Sem isso, os terminais aparecem como "indisponível".

Empacotar o instalador Windows: `npm run dist:win` (gera `release/`). A assinatura
do `.exe` exige um certificado — que nasce da conta do dono do projeto.

## Arquitetura (decisões encarnadas)
- **G4** — processo ≠ turno ≠ resultado; cancelamento pedido ≠ confirmado; stream
  cortado → `unknown`. (`src/core/turn-state.ts`)
- **G2** — nó gerenciado = sessão de harness via adaptador estruturado
  (`src/main/adapters/claude-adapter.ts` + `src/core/claude-stream.ts`), não `/v1`.
- **Saúde honesta** — OmniRoute ausente = indisponível. (`src/core/omniroute-client.ts`)
- **D01** — 4 visões (Canvas 2D, Escritório 3D, Operação, + seleção/Foco) sobre a
  MESMA sessão. **D04** — 3D sob demanda. **D05/D06** — animação derivada de estado
  confirmado. **D11** — Operação é o fallback sem WebGL.
- **Segurança** — contextIsolation/sandbox, sem nodeIntegration, sem webview
  privilegiada; renderer só fala com PTY/agent/fs via IPC tipado.
