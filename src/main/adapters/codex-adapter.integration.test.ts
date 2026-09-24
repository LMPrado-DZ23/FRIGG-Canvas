import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';

class FakeStream extends EventEmitter {
  setEncoding(): void {}
}

class FakeChild extends EventEmitter {
  readonly stdout = new FakeStream();
  readonly stderr = new FakeStream();
  readonly stdin = { write: (line: string) => this.receive(JSON.parse(line) as { id?: number; method?: string }) };
  killed = false;

  private receive(msg: { id?: number; method?: string }): void {
    queueMicrotask(() => {
      if (msg.method === 'initialize') this.stdout.emit('data', '{"id":0,"result":{}}\n');
      else if (msg.method === 'thread/start') this.stdout.emit('data', '{"id":1,"result":{"thread":{"id":"thread-1"}}}\n');
      else if (msg.method === 'turn/start') {
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

const { startCodexSession } = await import('./codex-adapter.js');

describe('Codex adapter integration contract', () => {
  beforeEach(() => spawn.mockReset());

  it('faz handshake, emite resultado validado e encerra o processo one-shot', async () => {
    const child = new FakeChild();
    spawn.mockReturnValue(child);
    const events: string[] = [];
    let output = '';
    startCodexSession({ cwd: '/tmp', prompt: 'faça' }, {
      onEvent: (event) => events.push(event.type),
      onOutput: (text) => { output = text; },
    });
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(events).toContain('turn.started');
    expect(events).toContain('result.validated');
    expect(events).toContain('turn.completed');
    expect(events).toContain('process.exited');
    expect(output).toBe('ok');
    expect(child.killed).toBe(true);
  });
});
