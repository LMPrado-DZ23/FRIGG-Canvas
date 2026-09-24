# Segurança do FRIGG Canvas

## Modelo de confiança

O FRIGG é um aplicativo desktop que coordena CLIs locais. O processo main possui as permissões do usuário e pode criar processos, abrir arquivos e acessar o endpoint local do OmniRoute. O terminal PTY, portanto, não deve ser tratado como sandbox de segurança.

O renderer roda com `contextIsolation`, `sandbox` e `nodeIntegration: false`. A ponte exposta pelo preload é mínima e os handlers IPC validam IDs, tamanhos e tipos antes de tocar em processos ou arquivos.

## Navegador incorporado

O nó de navegador aceita páginas HTTP/HTTPS, nega esquemas privilegiados e bloqueia pop-ups/permissões. A sessão é efêmera por padrão para evitar retenção involuntária de cookies e tokens. Usuários devem evitar abrir páginas não confiáveis quando o conteúdo puder induzir ações locais ou revelar informações na tela.

## Agentes e prompts

Prompts, arquivos do workspace, páginas visitadas e saídas de ferramentas são conteúdo não confiável. Não cole tokens ou credenciais em prompts. O FRIGG não deve registrar prompts completos, tokens ou saídas sensíveis em logs.

## Reporte

Para reportar uma vulnerabilidade, abra uma issue privada ou entre em contato com o mantenedor antes de publicar detalhes exploráveis.
