# FRIGG Canvas — missão 2026-09-25 (auditoria + hardening)

mission_id: "audit-hardening-20260925"
branch: "chore/audit-hardening-20260925"
pr: "https://github.com/LMPrado-DZ23/FRIGG-Canvas/pull/3"
base: "main @ 949b775"

## Gates (critérios de aceite)

| Gate | Prova |
|---|---|
| G1 lint sem warnings | `npm run lint -- --max-warnings=0` → exit 0 |
| G2 typecheck | `npm run typecheck` → exit 0 |
| G3 testes 100% | `npm test` → 18 arquivos, 97/97 (linha de base: 70) |
| G4 build | `npm run build` → exit 0; `npm run package:portable` + smoke do FRIGG.exe |
| G5 segurança deps/segredos | `npm audit --audit-level=moderate` → 0; secret scan do CI → sem achados |
| G6 bugs reais corrigidos com teste de regressão | ver tabela abaixo |
| G7 CI com Lint/Typecheck/Test/Build, verde no PR | `.github/workflows/quality.yml`; checks do PR #3 |

## Achados e correções

| Severidade | Achado | Correção | Teste |
|---|---|---|---|
| Alta | Windows: `spawn('claude'/'codex', {shell:false})` → ENOENT (CLIs npm são `.cmd`); agentes nunca iniciavam | `resolve-command.ts` (PATH/PATHEXT, `.cmd` só com tokens validados, prompt por stdin, `model` validado) | `resolve-command.test.ts`, `claude-adapter.integration.test.ts`, `ipc-validation.test.ts`; verificação real no Windows |
| Média | Cancel no Windows matava só o `cmd.exe`; CLI ficava órfã | `killProcessTree` (`taskkill /T`, ignora processo encerrado) | `resolve-command.test.ts` |
| Média | JSON válido com estrutura irrecuperável → biblioteca vazia + autosave sobrescrevia o arquivo | `tryParseLibrary` + backup `.corrupt-*` | `storage.test.ts` |
| Média | `onExit` tardio de PTY morto derrubava terminal novo com o mesmo id | checagem de identidade em `PtyHost` | `pty-host.test.ts` |
| Média | Evento tardio de agente cancelado desregistrava sessão nova | remoção por identidade em `main.ts` | — (código de glue Electron) |
| Baixa | `pty:start` em voo durante unmount deixava shell órfão | `TerminalView` mata após start se desmontado | — (componente React) |
| Baixa | `file:open` executava `.exe/.ps1/.lnk` via `shell.openPath` | `isExecutablePath` | `security.test.ts` |

## Decisões assumidas
- Clone em `C:\Users\zodyp\work\FRIGG-Canvas` (o caminho padrão da sessão excedia o limite do git).
- Só atualizações de patch (electron, vitest, @xyflow/react). Majors (React 19, R3F 9, three 0.186, Vite 8, TS 7, xterm 6) ficam de fora: são breaking e não há testes de UI para validar.
- `ANTHROPIC_BASE_URL` → OmniRoute mantido como estava (decisão de produto anterior).

## Pendências
- Majors acima, se desejado, em PR separado com validação visual.
- Sem teste automatizado para a remoção por identidade em `main.ts` e para o `TerminalView` (exigiria harness Electron/DOM).
