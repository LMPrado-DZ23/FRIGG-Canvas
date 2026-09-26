import { describe, expect, it, vi } from 'vitest';
import { AgentRegistry } from './agent-registry.js';

const session = () => ({ cancel: vi.fn() });

describe('AgentRegistry', () => {
  it('não permite duas sessões com o mesmo id (ativa ou iniciando)', () => {
    const reg = new AgentRegistry();
    const t = reg.reserve('a')!;
    expect(reg.reserve('a')).toBeNull();
    t.attach(session());
    t.release();
    expect(reg.busy('a')).toBe(true);
    expect(reg.reserve('a')).toBeNull();
  });

  it('evento terminal libera o id', () => {
    const reg = new AgentRegistry();
    const t = reg.reserve('a')!;
    t.attach(session());
    t.release();
    t.onTerminal();
    expect(reg.busy('a')).toBe(false);
  });

  it('evento tardio da sessão antiga não derruba a sessão nova', () => {
    const reg = new AgentRegistry();
    const old = reg.reserve('a')!;
    old.attach(session());
    old.release();
    reg.cancel('a');
    const fresh = reg.reserve('a')!;
    const s2 = session();
    fresh.attach(s2);
    fresh.release();
    old.onTerminal(); // process.exited atrasado da sessão cancelada
    expect(reg.get('a')).toBe(s2);
  });

  it('sessão que termina antes de ser registrada não fica registrada', () => {
    const reg = new AgentRegistry();
    const t = reg.reserve('a')!;
    t.onTerminal(); // ex.: spawn falhou de forma síncrona
    expect(t.attach(session())).toBe(false);
    t.release();
    expect(reg.busy('a')).toBe(false);
  });

  it('cancelar durante a partida cancela a sessão assim que ela existe', () => {
    const reg = new AgentRegistry();
    const t = reg.reserve('a')!;
    reg.cancel('a'); // usuário clicou Cancelar enquanto a CLI/rota era checada
    expect(reg.cancelPending('a')).toBe(true);
    const s = session();
    t.attach(s);
    t.release();
    expect(s.cancel).toHaveBeenCalledOnce();
    expect(reg.busy('a')).toBe(false);
  });

  it('cancelAll cancela ativas e marca as que estão iniciando', () => {
    const reg = new AgentRegistry();
    const a = reg.reserve('a')!;
    const sa = session();
    a.attach(sa);
    a.release();
    reg.reserve('b');
    reg.cancelAll();
    expect(sa.cancel).toHaveBeenCalledOnce();
    expect(reg.cancelPending('b')).toBe(true);
  });
});
