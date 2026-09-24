/**
 * FRIGG — adaptador do Codex App Server (harness gerenciado, G2).
 * Protocolo JSON-RPC 2.0 sobre stdio, NDJSON. O adaptador valida o handshake,
 * correlaciona respostas, trata erros, aplica timeout por etapa e nunca deixa
 * uma sessão silenciosamente pendurada.
 */
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import type { SessionEvent } from '../../core/turn-state.js';
import type { ManagedSession, AgentCallbacks } from './types.js';
import { buildAgentEnv } from './agent-env.js';

export interface StartCodexParams {
  readonly cwd: string;
  readonly prompt: string;
  readonly model?: string;
  readonly requestTimeoutMs?: number;
}

interface RpcMsg {
  id?: number | string;
  method?: string;
  params?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: { code?: number; message?: string; data?: unknown };
}

const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

export function rpcErrorText(msg: RpcMsg): string {
  return msg.error?.message ?? `erro RPC${typeof msg.error?.code === 'number' ? ` (${msg.error.code})` : ''}`;
}

export function parseCodexLine(line: string): RpcMsg | null {
  const value = line.trim();
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed as RpcMsg : null;
  } catch {
    return null;
  }
}

export function startCodexSession(params: StartCodexParams, cb: AgentCallbacks): ManagedSession {
  let child: ChildProcessWithoutNullStreams;
  try {
    child = spawn('codex', ['app-server'], { cwd: params.cwd, env: buildAgentEnv(), shell: false });
  } catch (err) {
    cb.onEvent({ type: 'turn.failed', turnId: 'codex', error: `spawn falhou: ${String(err)}` });
    return { cancel: () => {} };
  }

  const timeoutMs = params.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  let nextId = 100;
  let threadId: string | null = null;
  let turnId: string | null = null;
  let cancelRequested = false;
  let sawTerminal = false;
  let failed = false;
  let processExitEmitted = false;
  let output = '';
  let buf = '';
  const approvals = new Map<string, number | string>();
  const pending = new Map<number | string, ReturnType<typeof setTimeout>>();

  const emit = (e: SessionEvent): void => cb.onEvent(e);
  const clearPending = (): void => {
    for (const timer of pending.values()) clearTimeout(timer);
    pending.clear();
  };
  const fail = (message: string): void => {
    if (failed || sawTerminal) return;
    failed = true;
    clearPending();
    emit({ type: 'turn.failed', turnId: turnId ?? 'codex', error: message });
  };
  const send = (msg: RpcMsg, expectsResponse = false): void => {
    try {
      child.stdin.write(JSON.stringify(msg) + '\n');
      if (expectsResponse && msg.id !== undefined) {
        const timer = setTimeout(() => {
          pending.delete(msg.id!);
          fail(`timeout aguardando resposta RPC ${String(msg.id)}`);
          try { child.kill(); } catch { /* processo pode ter saído */ }
        }, timeoutMs);
        pending.set(msg.id, timer);
      }
    } catch (err) {
      fail(`falha ao escrever no Codex: ${String(err)}`);
    }
  };
  const resolvePending = (id: number | string): void => {
    const timer = pending.get(id);
    if (timer) clearTimeout(timer);
    pending.delete(id);
  };

  cb.onEvent({ type: 'process.started' });

  const handle = (msg: RpcMsg): void => {
    if (msg.id !== undefined && msg.method === undefined) {
      resolvePending(msg.id);
      if (msg.error) {
        fail(rpcErrorText(msg));
        return;
      }
      if (msg.id === 0 && msg.result) {
        send({ method: 'initialized', params: {} });
        send({
          method: 'thread/start',
          id: 1,
          params: {
            cwd: params.cwd,
            ...(params.model ? { model: params.model } : {}),
            approvalPolicy: 'onRequest',
            sandboxPolicy: { type: 'workspaceWrite', networkAccess: true },
          },
        }, true);
      } else if (msg.id === 1 && msg.result) {
        const thread = msg.result['thread'] as { id?: unknown } | undefined;
        if (typeof thread?.id !== 'string' || thread.id.length === 0) {
          fail('thread/start não retornou thread.id');
          return;
        }
        threadId = thread.id;
        send({ method: 'turn/start', id: 2, params: { threadId, input: [{ type: 'text', text: params.prompt }], ...(params.model ? { model: params.model } : {}) } }, true);
      } else if (msg.id === 2 && msg.result && !turnId) {
        const turn = msg.result['turn'] as { id?: unknown } | undefined;
        if (typeof turn?.id === 'string') turnId = turn.id;
      }
      return;
    }

    switch (msg.method) {
      case 'turn/started': {
        const turn = msg.params?.['turn'] as { id?: unknown } | undefined;
        turnId = typeof turn?.id === 'string' ? turn.id : 'codex-turn';
        emit({ type: 'turn.started', turnId });
        break;
      }
      case 'turn/completed': {
        if (failed || sawTerminal) break;
        const turn = msg.params?.['turn'] as { id?: unknown; status?: unknown; error?: { message?: string } } | undefined;
        const status = typeof turn?.status === 'string' ? turn.status : 'completed';
        sawTerminal = true;
        clearPending();
        const resolvedTurnId = typeof turn?.id === 'string' ? turn.id : turnId ?? 'codex-turn';
        if (status === 'completed') {
          if (output.length > 0) cb.onOutput?.(output);
          emit({ type: 'result.validated' });
          emit({ type: 'turn.completed', turnId: resolvedTurnId });
          // FRIGG inicia um app-server por turno; não manter um processo órfão
          // depois do resultado final. O close subsequente emite process.exited.
          setTimeout(() => {
            try { child.kill(); } catch { /* processo pode ter encerrado */ }
          }, 250);
        } else if (status === 'interrupted') {
          if (cancelRequested) emit({ type: 'cancel.confirmed' });
          else emit({ type: 'turn.failed', turnId: resolvedTurnId, error: 'interrompido' });
        } else {
          emit({ type: 'turn.failed', turnId: resolvedTurnId, error: turn?.error?.message ?? status });
        }
        break;
      }
      case 'item/commandExecution/requestApproval':
      case 'item/fileChange/requestApproval': {
        if (msg.id !== undefined) {
          const rid = String(msg.id);
          approvals.set(rid, msg.id);
          emit({ type: 'turn.approval_requested', requestId: rid });
        }
        break;
      }
      case 'item/agentMessage/delta': {
        const delta = msg.params?.['delta'];
        if (typeof delta === 'string') output += delta;
        break;
      }
      default:
        break;
    }
  };

  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => {
    buf += chunk;
    let nl: number;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      const msg = parseCodexLine(line);
      if (msg) handle(msg);
    }
  });

  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (d: string) => { stderr = (stderr + d).slice(-4000); });
  child.on('error', (err) => fail(`codex não encontrado? ${err.message}`));
  child.on('close', (code) => {
    const last = buf.trim();
    if (last) {
      const msg = parseCodexLine(last);
      if (msg) handle(msg);
    }
    clearPending();
    if (!sawTerminal && !failed) {
      const detail = stderr.trim().slice(-300);
      if (cancelRequested) emit({ type: 'cancel.confirmed' });
      else fail(detail || `processo Codex encerrou antes da conclusão (code ${code ?? -1})`);
    }
    if (!processExitEmitted) {
      processExitEmitted = true;
      emit({ type: 'process.exited', code: code ?? -1 });
    }
  });

  send({ method: 'initialize', id: 0, params: { clientInfo: { name: 'frigg', title: 'FRIGG', version: '0.0.1' }, capabilities: { experimentalApi: false, optOutNotificationMethods: [] } } }, true);

  return {
    cancel: () => {
      if (sawTerminal) return;
      cancelRequested = true;
      emit({ type: 'cancel.requested' });
      if (threadId && turnId) send({ method: 'turn/interrupt', id: nextId++, params: { threadId, turnId } });
      setTimeout(() => {
        try { child.kill(); } catch { /* ignore */ }
      }, 3000);
    },
    approve: (requestId, decision) => {
      const rpcId = approvals.get(requestId);
      if (rpcId === undefined) return;
      approvals.delete(requestId);
      send({ id: rpcId, result: { decision: decision === 'approved' ? 'accept' : 'decline' } });
      emit({ type: 'turn.approval_resolved', requestId, decision });
    },
  };
}

export { DEFAULT_REQUEST_TIMEOUT_MS };
