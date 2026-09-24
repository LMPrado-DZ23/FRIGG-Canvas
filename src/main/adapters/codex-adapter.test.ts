import { describe, expect, it } from 'vitest';
import { parseCodexLine, rpcErrorText } from './codex-adapter.js';

describe('codex JSON-RPC protocol helpers', () => {
  it('aceita objetos JSON e ignora ruído/arrays', () => {
    expect(parseCodexLine('')).toBeNull();
    expect(parseCodexLine('not-json')).toBeNull();
    expect(parseCodexLine('[1,2]')).toBeNull();
    expect(parseCodexLine('{"id":1,"result":{}}')).toEqual({ id: 1, result: {} });
  });

  it('preserva a mensagem de erro RPC e inclui o código quando existir', () => {
    expect(rpcErrorText({ error: { message: 'thread inválida', code: -32000 } })).toBe('thread inválida');
    expect(rpcErrorText({ error: { code: -1 } })).toBe('erro RPC (-1)');
  });
});
