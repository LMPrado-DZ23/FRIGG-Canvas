/**
 * FRIGG — adaptador do Codex App Server (harness gerenciado, G2).
 * Protocolo real (doc oficial): JSON-RPC 2.0 sobre stdio, NDJSON, sem o header
 * "jsonrpc" no fio. Fluxo: initialize → initialized → thread/start → turn/start.
 * Notificações mapeadas para SessionEvent; aprovações são REQUESTS que o cliente
 * responde (accept/decline) — expostas via approve() e à UI.
 */
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import type { SessionEvent } from '../../core/turn-state.js';
import type { ManagedSession, AgentCallbacks } from './types.js';

export interface StartCodexParams {
  readonly cwd: string;
  readonly prompt: string;
  readonly model?: string;
}

interface RpcMsg {
  id?: number | string;
  method?: string;
  params?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: { message?: string };
}

export function startCodexSession(params: StartCodexParams, cb: AgentCallbacks): ManagedSession {
  let child: ChildProcessWithoutNullStreams;
  try {
    child = spawn('codex', ['app-server'], { cwd: params.cwd, env: process.env, shell: process.platform === 'win32' });
  } catch (err) {
    cb.onEvent({ type: 'turn.failed', turnId: 'codex', error: `spawn falhou: ${String(err)}` });
    return { cancel: () => {} };
  }

  cb.onEvent({ type: 'process.started' });

  let nextId = 100;
  const send = (msg: RpcMsg): void => {
    try {
      child.stdin.write(JSON.stringify(msg) + '\n');
    } catch {
      /* processo pode ter saído */
    }
  };

  let threadId: string | null = null;
  let turnId: string | null = null;
  let cancelRequested = false;
  let sawTerminal = false;
  let output = '';
  // requestId (string p/ a UI) -> id JSON-RPC da requisição de aprovação
  const approvals = new Map<string, number | string>();

  const emit = (e: SessionEvent): void => cb.onEvent(e);

  const handle = (msg: RpcMsg): void => {
    // Respostas a nossos requests (têm id e result/error, sem method).
    if (msg.method === undefined && msg.id !== undefined) {
      if (msg.id === 0 && msg.result) {
        send({ method: 'initialized', params: {} });
        send({ method: 'thread/start', id: 1, params: { cwd: params.cwd, ...(params.model ? { model: params.model } : {}), approvalPolicy: 'onRequest', sandboxPolicy: { type: 'workspaceWrite', networkAccess: true } } });
      } else if (msg.id === 1 && msg.result) {
        const thread = msg.result['thread'] as { id?: string } | undefined;
        threadId = thread?.id ?? null;
        send({ method: 'turn/start', id: 2, params: { threadId, input: [{ type: 'text', text: params.prompt }], ...(params.model ? { model: params.model } : {}) } });
      }
      return;
    }

    // Notificações e requests do servidor (têm method).
    switch (msg.method) {
      case 'turn/started': {
        const turn = msg.params?.['turn'] as { id?: string } | undefined;
        turnId = turn?.id ?? 'codex-turn';
        emit({ type: 'turn.started', turnId });
        break;
      }
      case 'turn/completed': {
        const turn = msg.params?.['turn'] as { id?: string; status?: string; error?: { message?: string } } | undefined;
        const status = turn?.status ?? 'completed';
        sawTerminal = true;
        if (status === 'completed') {
          if (output.length > 0) cb.onOutput?.(output);
          emit({ type: 'turn.completed', turnId: turn?.id ?? turnId ?? 'codex-turn' });
        }
        else if (status === 'interrupted') {
          if (cancelRequested) emit({ type: 'cancel.confirmed' });
          else emit({ type: 'turn.failed', turnId: turn?.id ?? 'codex-turn', error: 'interrompido' });
        } else emit({ type: 'turn.failed', turnId: turn?.id ?? 'codex-turn', error: turn?.error?.message ?? status });
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
        const d = msg.params?.['delta'];
        if (typeof d === 'string') output += d;
        break;
      }
      default:
        break; // item/started, item/completed, plan/diff updates: atividade
    }
  };

  let buf = '';
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => {
    buf += chunk;
    let nl: number;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      try {
        handle(JSON.parse(line) as RpcMsg);
      } catch {
        /* linha não-JSON */
      }
    }
  });

  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (d: string) => {
    stderr = (stderr + d).slice(-4000);
  });
  child.on('error', (err) => emit({ type: 'turn.failed', turnId: 'codex', error: `codex não encontrado? ${err.message}` }));
  child.on('close', (code) => {
    if (!sawTerminal) {
      const detail = stderr.trim().slice(-300);
      if (detail) emit({ type: 'turn.failed', turnId: turnId ?? 'codex', error: detail });
      emit({ type: 'process.exited', code: code ?? -1 });
    }
  });

  // Inicia o handshake.
  send({ method: 'initialize', id: 0, params: { clientInfo: { name: 'frigg', title: 'FRIGG', version: '0.0.1' }, capabilities: { experimentalApi: false, optOutNotificationMethods: [] } } });

  return {
    cancel: () => {
      cancelRequested = true;
      emit({ type: 'cancel.requested' });
      if (threadId && turnId) send({ method: 'turn/interrupt', id: nextId++, params: { threadId, turnId } });
      setTimeout(() => {
        try {
          child.kill();
        } catch {
          /* ignore */
        }
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
