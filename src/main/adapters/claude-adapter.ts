/**
 * FRIGG — adaptador do Claude Code (harness gerenciado, G2).
 * Spawna `claude -p ... --output-format stream-json --verbose` e converte a
 * saída em SessionEvent via o parser PURO e testado (claude-stream). Não
 * reimplementa ferramentas/planejamento; só normaliza e transporta.
 *
 * Cancelamento: SIGINT (a doc diz que encerra o turno) → o `result` chega e
 * vira turn.completed/failed; se o processo morrer sem result, vira 'unknown'.
 */
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { parseStreamLine, claudeMsgToEvents, costFromResult } from '../../core/claude-stream.js';
import type { ManagedSession, AgentCallbacks } from './types.js';
import { buildAgentEnv } from './agent-env.js';

export interface StartAgentParams {
  readonly cwd: string;
  readonly prompt: string;
  readonly model?: string;
  /** base URL do OmniRoute para rotear a inferência (quando validado). */
  readonly baseUrl?: string;
}

export function buildClaudeArgs(params: Pick<StartAgentParams, 'prompt' | 'model'>): string[] {
  const args = ['-p', params.prompt, '--output-format', 'stream-json', '--verbose', '--permission-mode', 'default'];
  if (params.model) args.push('--model', params.model);
  return args;
}

export function startClaudeSession(params: StartAgentParams, cb: AgentCallbacks): ManagedSession {
  const args = buildClaudeArgs(params);

  const env = buildAgentEnv();
  // Rotear pelo OmniRoute (endpoint compatível). Só efetivo se a rota estiver ok.
  if (params.baseUrl) env['ANTHROPIC_BASE_URL'] = params.baseUrl;

  let child: ChildProcessWithoutNullStreams;
  try {
    child = spawn('claude', args, { cwd: params.cwd, env, shell: false });
  } catch (err) {
    cb.onEvent({ type: 'turn.failed', turnId: 'claude', error: `spawn falhou: ${String(err)}` });
    return { cancel: () => {} };
  }

  cb.onEvent({ type: 'process.started' });

  let sawResult = false;
  let terminalEmitted = false;
  let buf = '';
  const handleLine = (line: string): void => {
    const msg = parseStreamLine(line);
    if (!msg) return;
    if (msg.type === 'result') {
      sawResult = true;
      const usd = costFromResult(msg);
      if (usd !== null) cb.onCost?.(usd);
      if (typeof msg.result === 'string' && msg.result.length > 0) cb.onOutput?.(msg.result);
    }
    for (const ev of claudeMsgToEvents(msg)) {
      if (terminalEmitted) continue;
      cb.onEvent(ev);
      if (ev.type === 'turn.completed' || ev.type === 'turn.failed') terminalEmitted = true;
    }
  };

  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => {
    buf += chunk;
    let nl: number;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      handleLine(line);
    }
  });

  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (d: string) => {
    stderr += d;
    if (stderr.length > 4000) stderr = stderr.slice(-4000);
  });

  child.on('error', (err) => {
    if (!terminalEmitted) {
      terminalEmitted = true;
      cb.onEvent({ type: 'turn.failed', turnId: 'claude', error: `claude não encontrado? ${err.message}` });
    }
  });

  child.on('close', (code) => {
    if (buf.trim().length > 0) handleLine(buf);
    if (!sawResult) {
      // Sem `result`: não concluiu. Sinaliza saída de processo (→ unknown na máquina).
      const detail = stderr.trim().slice(-300);
      if (detail && !terminalEmitted) {
        terminalEmitted = true;
        cb.onEvent({ type: 'turn.failed', turnId: 'claude', error: detail });
      }
    }
    cb.onEvent({ type: 'process.exited', code: code ?? -1 });
  });

  return {
    cancel: () => {
      try {
        child.kill('SIGINT');
        setTimeout(() => {
          try {
            child.kill('SIGTERM');
          } catch {
            /* ignore */
          }
        }, 2000);
      } catch {
        /* ignore */
      }
    },
  };
}
