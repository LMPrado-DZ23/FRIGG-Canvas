# FRIGG Canvas — missão 2026-09-26 (rodada 3: testar, corrigir, melhorar)

branch: `fix/round3-hardening` (empilhada: #3 → #4 → #5 → esta)

## Gates

| Gate | Prova |
|---|---|
| G1 lint/typecheck/unit/build/e2e verdes local | `npm run lint -- --max-warnings=0`, `npm run typecheck`, `npm test` (142), `npm run build`, `npm run test:e2e` (11) contra `dist/` e contra o `FRIGG.exe` portátil |
| G2 achados reais corrigidos com regressão | tabela abaixo |
| G3 CI verde em todos os PRs | checks dos PRs no GitHub |
| G4 tudo publicado | branch no `origin` + PR aberto; docs atualizadas |

## Achados e correções

| Sev. | Achado | Correção | Teste |
|---|---|---|---|
| Alta | Canvas: nós não acompanhavam o cursor no arraste e a tecla Delete nunca apagava (xyflow controlado sem `onNodesChange`) | estado local + `applyNodeChanges`, seleção única derivada do store | E2E "Delete apaga só o nó selecionado e o arraste move o nó" (falha no código antigo) |
| Alta | Remover nó com agente rodando: agente seguia vivo e os seguintes disparavam sem entrada; gasto sumia (orçamento burlável) | `removeNodeSafely` cancela e para o fluxo; `retiredCostUsd` (inclui custo tardio) | `node-actions.test.ts` |
| Alta | Trocar/excluir projeto durante fluxo: eventos dos agentes descartados (ficavam "cancelando" para sempre) e o fluxo disparava agentes do outro projeto | eventos aceitos para nós de projetos inativos; troca/exclusão param o fluxo | `node-actions.test.ts` |
| Média | Cancelar enquanto o agente iniciava era ignorado | `AgentRegistry` com cancelamento pendente | `agent-registry.test.ts` |
| Média | Codex: erro definitivo do provedor deixava o turno pendurado | notificação `error` sem retry falha o turno | `codex-adapter.integration.test.ts` |
| Média | Re-executar fluxo concluído não fazia nada | `resetSessions` no início (mantém custo) | `node-actions.test.ts` |
| Média | Modais perdiam foco/texto a cada 5 s | `onClose` em ref | revisão + E2E indireto |
| Média | Nome de projeto vazio travava todo salvamento | nome saneado no `toLibrary` | E2E "nome de projeto vazio…" |
| Média | Confirmação do terminal escondia o instalador custom | mostra a linha exata | — |
| Média | `file:open` aceitava UNC (vazamento NTLM via SMB) e várias extensões executáveis | recusa UNC/dispositivo antes de IO; lista ampliada | `security.test.ts` |
| Média | Orçamento do fluxo contava agentes de outro projeto | soma só os nós do fluxo | `node-actions.test.ts` |
| Alta | Atualização automática nunca iniciava no app instalado (`autoUpdater` indefinido no import dinâmico do bundle CJS) — achado rodando a suíte contra o FRIGG instalado | `resolveAutoUpdater` + logs do ciclo | `updater.test.ts`; verificado no app empacotado: consulta o GitHub Releases |
| Baixa | Validação vazava para o turno seguinte | `turn.started` zera validação | `turn-state.test.ts` |
| Baixa | Log novo por PID no temp, nunca limpo | `userData/logs/main.log` rotativo | `logger.test.ts` |
| Baixa | Palette "Definir objetivo" apagava o objetivo; navegador carregava 2x; barra não seguia links; imagem aceitava qualquer URL; `frame-ancestors` no meta gerava erro de console; controles sem label | corrigidos | E2E "nenhum erro de console" |

## Revisões independentes
- Subagente de auditoria (renderer/core): 11 achados, todos verificados e tratados.
- DZ23 reviewer: 5 achados — #2 (desseleção) e #3 (orçamento de outro projeto) aplicados; #1, #4, #5 não se aplicam (custo é delta por turno; ids são únicos; `stopWorkflow` não mexe em sessões).

## Decisões
- Merge e tag de release ficam com o usuário (merge sem revisão é bloqueado pelo modo automático).
- GitHub Actions v4 → v7; Dependabot semanal (npm) e mensal (actions); job de release sem cache de dependências.
