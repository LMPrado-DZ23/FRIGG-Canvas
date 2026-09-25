import { afterEach, describe, expect, it, vi } from 'vitest';
import { PtyHost } from './pty-host.js';

class FakePty {
  private dataCb: ((d: string) => void) | undefined;
  private exitCb: ((e: { exitCode: number }) => void) | undefined;
  readonly written: string[] = [];
  killed = false;
  onData(cb: (d: string) => void): void { this.dataCb = cb; }
  onExit(cb: (e: { exitCode: number }) => void): void { this.exitCb = cb; }
  write(d: string): void { this.written.push(d); }
  resize(): void {}
  kill(): void { this.killed = true; }
  emitData(d: string): void { this.dataCb?.(d); }
  emitExit(code: number): void { this.exitCb?.({ exitCode: code }); }
}

function setup() {
  const ptys: FakePty[] = [];
  const onData = vi.fn();
  const onExit = vi.fn();
  const host = new PtyHost({ onData, onExit }, () => {
    const p = new FakePty();
    ptys.push(p);
    return p;
  });
  return { host, ptys, onData, onExit };
}

describe('PtyHost', () => {
  afterEach(() => vi.useRealTimers());

  it('recusa id duplicado e repassa dados/saída do processo atual', async () => {
    const { host, ptys, onData, onExit } = setup();
    expect((await host.start('t1', 80, 24, '/tmp')).ok).toBe(true);
    expect((await host.start('t1', 80, 24, '/tmp')).ok).toBe(false);
    ptys[0]!.emitData('hello');
    ptys[0]!.emitExit(0);
    expect(onData).toHaveBeenCalledWith('t1', 'hello');
    expect(onExit).toHaveBeenCalledWith('t1', 0);
    // Depois da saída o id fica livre de novo.
    expect((await host.start('t1', 80, 24, '/tmp')).ok).toBe(true);
  });

  it('saída tardia de um PTY morto não derruba o terminal novo com o mesmo id', async () => {
    const { host, ptys, onData, onExit } = setup();
    await host.start('t1', 80, 24, '/tmp');
    host.kill('t1');
    await host.start('t1', 80, 24, '/tmp');
    const [old, current] = ptys;
    old!.emitData('lixo');
    old!.emitExit(1);
    expect(onData).not.toHaveBeenCalled();
    expect(onExit).not.toHaveBeenCalled();
    host.write('t1', 'ls\r');
    expect(current!.written).toEqual(['ls\r']);
  });

  it('digita o comando inicial no shell depois que ele sobe', async () => {
    vi.useFakeTimers();
    const { host, ptys } = setup();
    const res = await host.start('t1', 80, 24, '/tmp', '  claude  ');
    expect(res.detail).toBe('claude');
    vi.advanceTimersByTime(400);
    expect(ptys[0]!.written).toEqual(['claude\r']);
  });

  it('killAll encerra todos os processos', async () => {
    const { host, ptys } = setup();
    await host.start('a', 80, 24, '/tmp');
    await host.start('b', 80, 24, '/tmp');
    host.killAll();
    expect(ptys.every((p) => p.killed)).toBe(true);
  });
});
