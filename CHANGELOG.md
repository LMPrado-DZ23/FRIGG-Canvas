# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/); versões seguem [SemVer](https://semver.org/lang/pt-BR/).

## [0.1.0] — primeira versão distribuída

### Novo
- **Instalador Windows** (NSIS) com **atualização automática** pelas GitHub Releases; publicação por tag `v*`.
- **Rota da inferência por agente**: automático (OmniRoute quando online, senão direto no provedor), sempre OmniRoute ou direto.
- **Controle de custo**: limite por execução do agente (`--max-budget-usd`), limite por execução do fluxo e gasto visível na barra superior, no Dashboard, na Operação e em cada nó.
- **Conversa contínua**: “↩ Continuar” retoma a sessão (`--resume` no Claude, `thread/resume` no Codex).
- **Ícone** próprio do app.
- Suíte **E2E** (Playwright + Electron) no CI, também contra o `FRIGG.exe` portátil.

### Corrigido
- O app empacotado rodava **sem a ponte do preload** (terminais, agentes e salvamento em disco não funcionavam no `.exe`).
- **Agentes nunca iniciavam no Windows** (CLIs npm são `.cmd`); prompt agora vai por stdin, sem injeção de shell.
- **Codex falhava sempre** (parâmetros do protocolo v2) e deixava o `app-server` órfão; erros definitivos do provedor agora encerram o turno.
- **Atualização automática** nunca iniciava no app instalado.
- **Canvas**: o nó não acompanhava o cursor no arraste e a tecla **Delete** não apagava.
- Remover nó / trocar ou excluir projeto durante um fluxo deixava agentes órfãos, disparava agentes sem entrada e perdia o gasto.
- Cancelar durante a partida do agente era ignorado.
- **Escritório 3D** ficava preso em “Carregando…” (texto WebGL bloqueado pela CSP).
- Perda silenciosa do `workspace.json` quando a estrutura era irrecuperável; nome de projeto vazio travava o salvamento.
- Corridas com o mesmo id em terminais e agentes; modais perdiam o foco a cada 5 s; re-executar fluxo concluído não fazia nada; validação vazava entre turnos.

### Segurança
- `file:open` recusa executáveis/scripts e caminhos de rede (UNC) antes de qualquer IO.
- Nó de imagem só carrega `http(s)`/`data:image`; confirmação do terminal mostra a linha exata.
- Nome do modelo, sessão e orçamento validados no IPC.

### Desempenho e manutenção
- React 19, R3F 9/drei 10, three 0.186, xterm 6, Vite 8 (Rolldown), TypeScript 6.0, Electron 44.
- three.js deixou de ser pré-carregado: JS inicial de ~1,8 MB para ~0,78 MB; build do renderer ~45 s → ~2 s.
- Log único e rotativo em `userData/logs/main.log`; GitHub Actions v7; Dependabot.
