# Auditoria final independente — FRIGG Canvas

**Branch:** `codex/final-hardening-20260924`  
**Base:** `b10786a`  
**Data:** 24 de setembro de 2026

## Síntese

Foram executadas três revisões independentes depois da primeira rodada de hardening. Os auditores receberam instruções read-only e não editaram o repositório. Os achados HIGH/CRITICAL foram incorporados ao fix loop e retestados.

| Auditor | Escopo | Resultado inicial | Resultado após correção |
|---|---|---|---|
| A — Architect/Engineering | Contratos, concorrência, lifecycle, packaging e CI | Request Changes: shell injection, dupla inicialização, lifecycle Codex, agentes órfãos, gates incompletos | **Sem bloqueio HIGH conhecido no escopo corrigido** |
| B — Security/DevSecOps | Electron, IPC, shell, ambiente, webview, secrets e supply chain | Request Changes: shell injection, herança de ambiente, prompt injection indireta; riscos médios em PTY, logs, endpoint e file open | **Shell, ambiente e demarcação de contexto corrigidos; riscos médios documentados** |
| C — Product/QA/UX | Boot, estados assíncronos, acessibilidade, layout e cobertura | Request Changes: boot sem retry, falta de foco/fallback, responsividade, testes de integração | **Boot/retry, focus trap, labels, reflow e smoke/integracional adicionados; WebGL/PTY real continuam dependentes de CI/Windows** |

## Achados corrigidos

### Shell injection no Windows — CRITICAL/HIGH

Os adapters Claude e Codex agora executam com `shell: false`. O prompt e o modelo continuam sendo argumentos separados e não são interpolados em uma string de shell. Foi adicionado teste de contrato do protocolo Codex e o CI mantém smoke do Electron.

### Herança indiscriminada de segredos — HIGH

Foi criado `src/main/adapters/agent-env.ts`, que copia apenas uma allowlist explícita de ambiente necessária para localizar CLIs, diretórios do usuário e autenticação suportada. Variáveis arbitrárias do processo Electron deixam de ser herdadas.

### Injeção indireta no encadeamento de agentes — HIGH

Saídas upstream agora são truncadas, demarcadas como `<upstream-output>` e acompanhadas de instrução explícita para tratá-las como dados não confiáveis, nunca como política ou comando. O risco residual de prompt injection permanece documentado porque o agente continua tendo ferramentas locais.

### Corrida de dupla inicialização — HIGH

O processo main usa `startingAgents` para reservar o ID antes de `await isCliAvailable`. O ID fica indisponível durante a inicialização e a reserva é liberada em `finally`.

### Processo Codex órfão e cancelamento incorreto — HIGH

O adapter Codex agora trata erro RPC, timeout, `thread.id` ausente, EOF parcial, eventos terminais idempotentes, cancelamento antes do `turn.failed` e emite `process.exited`. Após o turno one-shot concluído, o processo é encerrado e o cleanup é testado.

### Agentes sem owner após remoção/troca — HIGH

A UI cancela agentes ativos ao remover nós, trocar ou excluir workspace; eventos tardios para nós ausentes são ignorados no store. Isso impede que sessões removidas reapareçam silenciosamente no estado visual.

### Boot e persistência sem retry — P1

A aplicação agora tem estado explícito de boot, bloqueia edição enquanto o workspace não foi carregado e oferece “Tentar novamente” após falha.

### Acessibilidade e responsividade — P1/P2

O modal recebeu foco inicial, retorno de foco e focus trap. Labels foram associados a campos no modal e painel. A tabela de operação recebeu caption e `scope`; workflow tem `aria-live`; botões de remoção têm `aria-label`; CSS ganhou reflow para janelas menores e classe visually hidden.

## Riscos residuais documentados

- O PTY executa comandos com as permissões do usuário; ele não é sandbox.
- Integração real com CLIs Claude/Codex depende de instalação e autenticação da máquina do usuário.
- O smoke nativo de PTY e o empacotamento Windows dependem do job Windows do GitHub Actions.
- O webview aceita HTTP/HTTPS por requisito funcional, embora use partição efêmera, sandbox, sem Node/preload, sem permissões e sem pop-ups.
- `file:open` e logs ainda merecem endurecimento adicional para um threat model corporativo; não são blockers do fluxo corrigido e estão documentados em `docs/SECURITY.md`.
- O fallback acessível Operação existe e o 3D é lazy-loaded; falhas raras de WebGL ainda justificam um Error Boundary em uma próxima iteração.

## Gates finais planejados

| Gate | Status | Evidência |
|---|---|---|
| lint | PASS | `npm run lint` |
| typecheck | PASS | `npm run typecheck` |
| unit/contract | PASS | `npm test` — 70 testes |
| integration | PASS local | teste fake de handshake/cleanup Codex; smoke Electron local via `xvfb-run` |
| security | PASS | `npm audit --audit-level=moderate`, secret scan, revisão B |
| build | PASS | `npm run build` |
| functional acceptance | PASS parcial verificável | Electron permaneceu ativo por 15s no smoke local; Windows/PTY real coberto no CI |
| final audit | PASS condicionado ao CI remoto | três revisões independentes e fix loop registrados |

## Veredito

**A branch está pronta para revisão/publicação no GitHub, sem CRITICAL/HIGH interno conhecido após o fix loop.** A publicação não é merge em `main` nem deploy de produção; será feita somente na branch autorizada `codex/final-hardening-20260924`, preservando rollback e permitindo que o CI remoto valide o ambiente Windows.
