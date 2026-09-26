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
- **Command Center** com dashboard inicial, resumo de saúde do workspace, playbooks,
  ações rápidas e command palette (`Ctrl/Cmd + K`) para navegar e executar comandos sem
  interromper o fluxo.
- **Terminais de CLI de IA**: catálogo espelhando o OmniRoute — Code (26), Agent (10),
  Externas compatíveis (10).
- **Rota da inferência por agente**: *Automático* (OmniRoute quando online, senão direto
  no provedor), *Sempre OmniRoute* ou *Direto*.
- **Controle de custo**: limite de gasto por execução do agente (`--max-budget-usd`),
  limite por execução do fluxo e gasto visível na barra superior, no Dashboard e em cada nó.
- **Conversa contínua**: depois da 1ª tarefa, o nó oferece **↩ Continuar** (o agente lembra
  do que fez — `--resume` no Claude, `thread/resume` no Codex).

## Status (honesto)

| Componente | Estado | Evidência |
|---|---|---|
| Núcleo/adaptadores/renderer: turn-state, session-model, workspace, segurança, OmniRoute, Claude, Codex, IPC, registro de sessões, updater, log, ações do canvas e fluxo | ✅ testado | 140 testes Vitest + lint sem warnings |
| Typecheck strict (TS 6) | ✅ exit 0 | `npm run typecheck` |
| App Electron ponta a ponta: ponte do preload, IPC, agente, limites de gasto, terminal PTY real, escritório 3D, tecla Delete e arraste no canvas, nome de projeto, console sem erros, persistência após reiniciar | ✅ testado | 11 testes Playwright + Electron (`npm run test:e2e`) no CI Linux e Windows (contra o `FRIGG.exe` portátil) |
| Adaptadores Claude (stream-json) e Codex (App Server v2) | ✅ contrato testado; verificado com as CLIs reais (retomada e teto de gasto) | requer CLI logada |
| Instalador NSIS + atualização automática (GitHub Releases) | ✅ `npm run dist:win`; publicação por tag `v*` | sem assinatura de código |

## Rodar (na sua máquina Windows)
```bash
npm install
npm test                 # testes unitários e de contrato
npm run build            # main + renderer
npm run test:e2e         # abre o app de verdade (Playwright + Electron); rode após o build
npm start                # abre a janela (baixa o Electron na 1ª vez)
```

## Gerar o executável

**Portátil (sem instalador, sem admin) — recomendado:**
```bash
npm run package:portable   # gera release/FRIGG-win/FRIGG.exe (duplo clique)
```
O workflow `Quality` monta o portátil em Windows, abre o `FRIGG.exe`, confirma que o processo permanece saudável e publica o diretório como artefato.

**Instalador NSIS (`.exe` de setup, com atualização automática):**
```bash
npm run dist:win           # gera release/FRIGG-Setup-<versão>.exe (não publica)
```
A versão instalada verifica novas versões nas **GitHub Releases** ao abrir e a cada 6 h,
baixa em segundo plano e instala ao fechar o app (notificação do Windows). O portátil não
se atualiza. Para desligar: `FRIGG_DISABLE_UPDATES=1`.

**Publicar uma versão:** ajuste `version` no `package.json`, faça commit e crie a tag
igual (`git tag v0.1.0 && git push origin v0.1.0`). O workflow `Release` roda
lint/typecheck/testes, gera o instalador e publica o `.exe` + `latest.yml` na Release
— é desse feed que as instalações se atualizam.
> Este exige um privilégio do Windows: o electron-builder extrai o `winCodeSign`
> que contém symlinks de macOS, e o Windows bloqueia isso sem **Modo de
> Desenvolvedor** (Configurações → Privacidade e segurança → Para desenvolvedores)
> ou terminal como **Administrador**. O `package:portable` não precisa disso.

Terminais 100% (node-pty nativo): com Visual Studio Build Tools (C++), rode
`npm run rebuild`. Assinatura do `.exe` exige certificado (nasce da sua conta).

## Logs
O processo principal grava em `%APPDATA%\frigg-canvas\logs\main.log` (no Linux/macOS, na
pasta `userData` do app, junto do `workspace.json`), com rotação em 1 MB (`main.log.1`). Prompts e saídas dos
agentes não são registrados.

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
