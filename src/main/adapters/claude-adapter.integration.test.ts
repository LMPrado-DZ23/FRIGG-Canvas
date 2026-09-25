import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';

class FakeStream extends EventEmitter {
  setEncoding(): void {}
}

class FakeChild extends EventEmitter {
  readonly stdout = new FakeStream();
  readonly stderr = new FakeStream();
  exitCode: number | null = null;
  signalCode: string | null = null;
  stdinText = '';
  readonly stdin = Object.assign(new EventEmitter(), {
    end: (text: string) => {
      this.stdinText = text;
    },
  });
  readonly kills: string[] = [];
  kill(signal: string): void {
    this.kills.push(signal);
  }
}

const spawn = vi.hoisted(() => vi.fn());
const planSpawn = vi.hoisted(() => vi.fn());
vi.mock('node:child_process', () => ({ spawn }));
vi.mock('../resolve-command.js', () => ({
  planSpawn,
  killProcessTree: (child: FakeChild, signal: string) => child.kill(signal),
}));

const { startClaudeSession } = await import('./claude-adapter.js');

describe('Claude adapter integration contract', () => {
  beforeEach(() => {
    spawn.mockReset();
    planSpawn.mockReset();
    planSpawn.mockImplementation((file: string, args: string[]) => ({ file, args, shell: false }));
  });

  it('envia o prompt por stdin, mapeia stream-json e reporta custo/saída', () => {
    const child = new FakeChild();
    spawn.mockReturnValue(child);
    const events: string[] = [];
    let output = '';
    let cost = 0;
    const prompt = 'faça & "algo" %PATH%';
    startClaudeSession({ cwd: '/tmp', prompt, baseUrl: 'http://localhost:20128' }, {
      onEvent: (e) => events.push(e.type),
      onOutput: (t) => { output = t; },
      onCost: (usd) => { cost = usd; },
    });
    const [, args, opts] = spawn.mock.calls[0] as [string, string[], { env: NodeJS.ProcessEnv }];
    expect(args).not.toContain(prompt);
    expect(child.stdinText).toBe(prompt);
    expect(opts.env['ANTHROPIC_BASE_URL']).toBe('http://localhost:20128');

    // Linha JSON partida entre chunks deve ser remontada.
    child.stdout.emit('data', '{"type":"system","subtype":"init","session_id":"s1"}\n{"type":"result","subtype":"success","re');
    child.stdout.emit('data', 'sult":"pronto","total_cost_usd":0.25,"session_id":"s1"}\n');
    child.emit('close', 0);
    expect(events).toEqual(['process.started', 'turn.started', 'result.validated', 'turn.completed', 'process.exited']);
    expect(output).toBe('pronto');
    expect(cost).toBe(0.25);
  });

  it('falha de forma explícita quando a CLI não está no PATH', () => {
    planSpawn.mockReturnValue(null);
    const events: string[] = [];
    startClaudeSession({ cwd: '/tmp', prompt: 'x' }, { onEvent: (e) => events.push(e.type) });
    expect(spawn).not.toHaveBeenCalled();
    expect(events).toEqual(['turn.failed']);
  });

  it('processo que morre sem result vira turn.failed uma única vez', () => {
    const child = new FakeChild();
    spawn.mockReturnValue(child);
    const events: string[] = [];
    startClaudeSession({ cwd: '/tmp', prompt: 'x' }, { onEvent: (e) => events.push(e.type) });
    child.stderr.emit('data', 'auth error');
    child.emit('error', new Error('boom'));
    child.emit('close', 1);
    expect(events.filter((t) => t === 'turn.failed')).toHaveLength(1);
    expect(events.at(-1)).toBe('process.exited');
  });

  it('cancelamento sinaliza a árvore do processo', () => {
    vi.useFakeTimers();
    try {
      const child = new FakeChild();
      spawn.mockReturnValue(child);
      const session = startClaudeSession({ cwd: '/tmp', prompt: 'x' }, { onEvent: () => {} });
      session.cancel();
      vi.advanceTimersByTime(2_000);
      expect(child.kills).toEqual(['SIGINT', 'SIGTERM']);
    } finally {
      vi.useRealTimers();
    }
  });
});
