# FRIGG Canvas

App desktop de **canvas + orquestração de agentes de IA** sobre o **OmniRoute**
(serviço headless). Vários terminais de CLI de IA, agentes gerenciados com papéis,
**escritório 3D** e **equipes orquestradas** — pensado para ser fácil até para leigos.

> Decisões A–G e D01–D12: `../Regente/*.md` e o canal `LMPrado-DZ23/ai-memory`.
> Memória cross-harness: MCP dz23 `project=regente`.

## O que dá pra fazer
- **Vários agentes ao mesmo tempo** no canvas (cada nó = uma sessão de harness real).
- **Papéis prontos**: Orquestrador, Arquiteto, Desenvolvedor, Revisor, QA, Analista,
  CTO, Segurança (system-prompt já vem pronto).
- **Equipes orquestradas**: escolha um template (Feature/Revisão/Discovery), escreva o
  objetivo e clique **Orquestrar** — o FRIGG dispara cada agente na ordem certa,
  passando a saída de um para o próximo, respeitando falhas (não inventa sucesso).
- **Escritório 3D** (mesma sessão do 2D) e visão **Operação** (lista acessível).
- **Terminais de CLI de IA**: catálogo espelhando o OmniRoute — Code (26), Agent (10),
  Externas compatíveis (10).

## Status (honesto)

| Componente | Estado | Evidência |
|---|---|---|
| Núcleo/adaptadores: turn-state, session-model, workspace, segurança, OmniRoute, Claude, Codex e IPC | ✅ testado | 70 testes Vitest + lint |
| Typecheck strict | ✅ exit 0 | `npm run typecheck` |
| Canvas 2D + nós + arestas + escritório 3D + Operação | ✅ build OK | `npm run build:renderer` |
| Orquestração (papéis + grafo + templates) | ✅ implementado; motor testado | idem + testes |
| Adaptadores Claude (stream-json) e Codex (App Server) | 🟡 execução ao vivo requer CLI logada; aprovações interativas estão disponíveis no Codex | parser/argumentos testados |
| Terminais PTY (node-pty pré-compilado) | 🟡 código pronto; binário nativo depende do ambiente | degrada p/ "indisponível" |
| `.exe` (electron-builder) | 🟡 config pronta; build/assinatura fora deste sandbox | `npm run dist:win` |

## Rodar (na sua máquina Windows)
```bash
npm install
npm test                 # testes unitários e de contrato
npm run build            # main + renderer
npm start                # abre a janela (baixa o Electron na 1ª vez)
```

## Gerar o executável

**Portátil (sem instalador, sem admin) — recomendado:**
```bash
npm run package:portable   # gera release/FRIGG-win/FRIGG.exe (duplo clique)
```
O workflow `Quality` monta o portátil em Windows, abre o `FRIGG.exe`, confirma que o processo permanece saudável e publica o diretório como artefato.

**Instalador NSIS (`.exe` de setup):**
```bash
npm run dist:win           # gera release/ (NSIS)
```
> Este exige um privilégio do Windows: o electron-builder extrai o `winCodeSign`
> que contém symlinks de macOS, e o Windows bloqueia isso sem **Modo de
> Desenvolvedor** (Configurações → Privacidade e segurança → Para desenvolvedores)
> ou terminal como **Administrador**. O `package:portable` não precisa disso.

Terminais 100% (node-pty nativo): com Visual Studio Build Tools (C++), rode
`npm run rebuild`. Assinatura do `.exe` exige certificado (nasce da sua conta).

## OmniRoute
Endpoint local padrão: `http://localhost:20128` (inferência em `/v1`). Ausente = a UI
mostra "indisponível" (nunca finge saúde). CLIs externas roteiam exportando
`OPENAI_BASE_URL=http://localhost:20128/v1`.

## Segurança e limitações operacionais

- O terminal PTY executa comandos com as permissões do usuário que abriu o FRIGG. O canvas não é uma sandbox para comandos locais.
- O navegador incorporado usa uma sessão efêmera por padrão; cookies e tokens não são persistidos entre execuções.
- O renderer não tem acesso direto a Node.js, filesystem ou IPC cru: capacidades privilegiadas passam pelo preload e por handlers com validação runtime.
- Um resultado só libera o próximo agente quando o harness reporta sucesso operacional e o estado está elegível para a aresta de sucesso; falhas e estados desconhecidos bloqueiam o downstream.
- Para distribuição Windows, o workflow `Quality` executa o smoke test do portátil. O rebuild do PTY deve usar o pacote efetivamente importado: `npm run rebuild`.

## Arquitetura encarnada
- **G4** processo ≠ turno ≠ resultado; cancelamento pedido ≠ confirmado; stream cortado
  → unknown. **G2** nó gerenciado = sessão de harness via adaptador, não `/v1`.
- **Orquestração** = grafo executável: aresta A→B só dispara B quando A concluiu; falha
  bloqueia downstream; ciclo é rejeitado.
- **Segurança** contextIsolation + sandbox, sem nodeIntegration; IPC aceita apenas o renderer confiável; webview sem Node/preload, pop-ups, permissões ou esquemas privilegiados.
