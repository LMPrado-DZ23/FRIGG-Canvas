import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';

class FakeStream extends EventEmitter {
  setEncoding(): void {}
}

interface Sent { id?: number; method?: string; params?: Record<string, unknown> }

/** App-server falso. `threadError` simula o erro real do protocolo (ex.: variante inválida). */
class FakeChild extends EventEmitter {
  readonly stdout = new FakeStream();
  readonly stderr = new FakeStream();
  readonly sent: Sent[] = [];
  readonly stdin = { write: (line: string) => this.receive(JSON.parse(line) as Sent) };
  killed = false;
  exitCode: number | null = null;
  signalCode: string | null = null;

  /** `turnLines` substitui o roteiro padrão do turno (linhas NDJSON). */
  constructor(private readonly threadError?: string, private readonly turnLines?: string[]) {
    super();
  }

  private receive(msg: Sent): void {
    this.sent.push(msg);
    queueMicrotask(() => {
      if (msg.method === 'initialize') this.stdout.emit('data', '{"id":0,"result":{}}\n');
      else if (msg.method === 'thread/start' || msg.method === 'thread/resume') {
        if (this.threadError) {
          this.stdout.emit('data', `${JSON.stringify({ id: 1, error: { code: -32600, message: this.threadError } })}\n`);
          return;
        }
        const id = msg.method === 'thread/resume' ? msg.params?.['threadId'] : 'thread-1';
        this.stdout.emit('data', `${JSON.stringify({ id: 1, result: { thread: { id } } })}\n`);
      } else if (msg.method === 'turn/start' && this.turnLines) {
        for (const line of this.turnLines) this.stdout.emit('data', `${line}
`);
      } else if (msg.method === 'turn/start') {
        this.stdout.emit('data', '{"method":"turn/started","params":{"turn":{"id":"turn-1"}}}\n');
        this.stdout.emit('data', '{"method":"item/agentMessage/delta","params":{"delta":"ok"}}\n');
        this.stdout.emit('data', '{"method":"turn/completed","params":{"turn":{"id":"turn-1","status":"completed"}}}\n');
      }
    });
  }

  kill(): void {
    if (this.killed) return;
    this.killed = true;
    queueMicrotask(() => this.emit('close', 0));
  }
}

const spawn = vi.hoisted(() => vi.fn());
vi.mock('node:child_process', () => ({ spawn }));
vi.mock('../resolve-command.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../resolve-command.js')>()),
  planSpawn: (file: string, args: string[]) => ({ file, args, shell: false }),
  killProcessTree: (child: { kill: () => void }) => child.kill(),
}));

const { startCodexSession, codexThreadParams, codexTurnParams } = await import('./codex-adapter.js');
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 400));

describe('Codex adapter integration contract', () => {
  beforeEach(() => spawn.mockReset());

  it('faz handshake, emite resultado validado e encerra o processo one-shot', async () => {
    const child = new FakeChild();
    spawn.mockReturnValue(child);
    const events: string[] = [];
    let output = '';
    let session = '';
    startCodexSession({ cwd: '/tmp', prompt: 'faça' }, {
      onEvent: (event) => events.push(event.type),
      onOutput: (text) => { output = text; },
      onSession: (ref) => { session = ref; },
    });
    await settle();
    expect(events).toContain('turn.started');
    expect(events).toContain('result.validated');
    expect(events).toContain('turn.completed');
    expect(events).toContain('process.exited');
    expect(output).toBe('ok');
    expect(session).toBe('thread-1');
    expect(child.killed).toBe(true);
  });

  it('usa os valores do protocolo v2 (on-request / workspace-write)', async () => {
    const child = new FakeChild();
    spawn.mockReturnValue(child);
    startCodexSession({ cwd: '/tmp', prompt: 'faça', model: 'gpt-5' }, { onEvent: () => {} });
    await settle();
    const thread = child.sent.find((m) => m.method === 'thread/start');
    expect(thread?.params).toEqual({ cwd: '/tmp', model: 'gpt-5', approvalPolicy: 'on-request', sandbox: 'workspace-write' });
    const turn = child.sent.find((m) => m.method === 'turn/start');
    expect(turn?.params).toMatchObject({ threadId: 'thread-1', sandboxPolicy: { type: 'workspaceWrite', networkAccess: true } });
  });

  it('continua uma conversa com thread/resume', async () => {
    const child = new FakeChild();
    spawn.mockReturnValue(child);
    let session = '';
    startCodexSession({ cwd: '/tmp', prompt: 'e agora?', resumeThreadId: 'thread-antiga' }, {
      onEvent: () => {},
      onSession: (ref) => { session = ref; },
    });
    await settle();
    expect(child.sent.some((m) => m.method === 'thread/start')).toBe(false);
    expect(child.sent.find((m) => m.method === 'thread/resume')?.params).toMatchObject({ threadId: 'thread-antiga' });
    expect(child.sent.find((m) => m.method === 'turn/start')?.params).toMatchObject({ threadId: 'thread-antiga' });
    expect(session).toBe('thread-antiga');
  });

  it('erro de protocolo falha o turno E encerra o app-server (sem processo órfão)', async () => {
    const child = new FakeChild("unknown variant `onRequest`");
    spawn.mockReturnValue(child);
    const events: { type: string; error?: string }[] = [];
    startCodexSession({ cwd: '/tmp', prompt: 'faça' }, { onEvent: (e) => events.push(e as { type: string; error?: string }) });
    await settle();
    expect(events.find((e) => e.type === 'turn.failed')?.error).toContain('onRequest');
    expect(child.killed).toBe(true);
    expect(events.at(-1)?.type).toBe('process.exited');
  });
});

describe('notificações de erro do turno', () => {
  beforeEach(() => spawn.mockReset());
  const started = '{"method":"turn/started","params":{"turn":{"id":"turn-1"}}}';
  const errorLine = (willRetry: boolean): string =>
    JSON.stringify({ method: 'error', params: { threadId: 'thread-1', turnId: 'turn-1', willRetry, error: { message: 'provedor recusou a conexão' } } });

  it('erro definitivo falha o turno e encerra o app-server (sem sessão pendurada)', async () => {
    const child = new FakeChild(undefined, [started, errorLine(false)]);
    spawn.mockReturnValue(child);
    const events: { type: string; error?: string }[] = [];
    startCodexSession({ cwd: '/tmp', prompt: 'x' }, { onEvent: (e) => events.push(e as { type: string; error?: string }) });
    await settle();
    expect(events.find((e) => e.type === 'turn.failed')?.error).toBe('provedor recusou a conexão');
    expect(child.killed).toBe(true);
  });

  it('erro com nova tentativa só informa, sem falhar', async () => {
    const child = new FakeChild(undefined, [started, errorLine(true)]);
    spawn.mockReturnValue(child);
    const events: string[] = [];
    let output = '';
    startCodexSession({ cwd: '/tmp', prompt: 'x' }, { onEvent: (e) => events.push(e.type), onOutput: (t) => { output = t; } });
    await settle();
    expect(events).not.toContain('turn.failed');
    expect(output).toContain('tentando novamente');
    expect(child.killed).toBe(false);
  });
});

describe('parâmetros do protocolo', () => {
  it('thread params omitem campos vazios', () => {
    expect(codexThreadParams({ cwd: '/p' })).toEqual({ cwd: '/p', approvalPolicy: 'on-request', sandbox: 'workspace-write' });
    expect(codexThreadParams({ cwd: '/p', resumeThreadId: 't' })).toMatchObject({ threadId: 't' });
  });

  it('turn params levam o prompt como input de texto', () => {
    expect(codexTurnParams('t', 'olá')).toMatchObject({ threadId: 't', input: [{ type: 'text', text: 'olá' }] });
  });
});
