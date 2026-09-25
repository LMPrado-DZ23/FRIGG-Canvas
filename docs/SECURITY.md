# Segurança do FRIGG Canvas

## Modelo de confiança

O FRIGG é um aplicativo desktop que coordena CLIs locais. O processo main possui as permissões do usuário e pode criar processos, abrir arquivos e acessar o endpoint local do OmniRoute. O terminal PTY, portanto, não deve ser tratado como sandbox de segurança.

O renderer roda com `contextIsolation`, `sandbox` e `nodeIntegration: false`. A ponte exposta pelo preload é mínima e os handlers IPC validam IDs, tamanhos e tipos antes de tocar em processos ou arquivos.

## Navegador incorporado

O nó de navegador aceita páginas HTTP/HTTPS, nega esquemas privilegiados e bloqueia pop-ups/permissões. A sessão é efêmera por padrão para evitar retenção involuntária de cookies e tokens. Usuários devem evitar abrir páginas não confiáveis quando o conteúdo puder induzir ações locais ou revelar informações na tela.

## Agentes e prompts

Prompts, arquivos do workspace, páginas visitadas e saídas de ferramentas são conteúdo não confiável. Não cole tokens ou credenciais em prompts. O FRIGG não deve registrar prompts completos, tokens ou saídas sensíveis em logs.

### Execução das CLIs gerenciadas (Claude/Codex)

- O executável é resolvido pelo `PATH` (com `PATHEXT` no Windows), ignorando entradas relativas do `PATH`.
- No Windows, CLIs instaladas via npm são wrappers `.cmd`, que só rodam via `cmd.exe`. Nesse caso a linha de comando contém **apenas tokens fixos ou validados** (`[A-Za-z0-9._:/@=[\]-]`) e o caminho do `.cmd` é recusado se tiver metacaracteres do `cmd.exe` (`% ! ^ " & | < >`).
- O prompt nunca vai na linha de comando: o Claude recebe o prompt por stdin; o Codex recebe via JSON-RPC.
- O nome do modelo é validado no IPC com a mesma classe de caracteres.
- Cancelamento encerra a árvore de processos (`taskkill /T` no Windows) e não sinaliza processos já encerrados.

## Arquivos

- `file:open` recusa executáveis e scripts (`.exe`, `.bat`, `.cmd`, `.ps1`, `.lnk`, `.js`, `.msi`, `.sh`, …), pois abrir com o app padrão do SO os executaria.
- `workspace.json` é gravado de forma atômica (`.tmp` + rename). Se o arquivo estiver corrompido **ou** tiver estrutura irrecuperável, ele é preservado como `workspace.json.corrupt-<timestamp>` antes de qualquer autosave.

## Reporte

Para reportar uma vulnerabilidade, abra uma issue privada ou entre em contato com o mantenedor antes de publicar detalhes exploráveis.
