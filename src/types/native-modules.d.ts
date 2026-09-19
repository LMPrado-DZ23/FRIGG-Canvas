// Módulos nativos OPCIONais (podem não estar instalados / sem tipos próprios).
// Carregados via import() dinâmico com try/catch em runtime; aqui só declaramos
// para o typecheck não falhar quando o binário pré-compilado estiver ausente.
declare module '@homebridge/node-pty-prebuilt-multiarch';
declare module 'node-pty';
