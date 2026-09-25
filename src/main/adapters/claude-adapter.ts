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
import { killProcessTree, planSpawn } from '../resolve-command.js';

export interface StartAgentParams {
  readonly cwd: string;
  readonly prompt: string;
  readonly model?: string;
  /** base URL do OmniRoute para rotear a inferência (quando validado). */
  readonly baseUrl?: string;
  /** session_id de uma conversa anterior: continua a mesma conversa (--resume). */
  readonly resumeSessionId?: string;
  /** Teto de gasto (USD) do turno, aplicado pelo próprio Claude Code. */
  readonly maxBudgetUsd?: number;
}

/**
 * Argumentos fixos do `claude -p`. O prompt NÃO entra na linha de comando: vai
 * por stdin, para que nenhum texto livre passe por cmd.exe no Windows (onde a
 * CLI npm é um wrapper `.cmd`) e para não esbarrar no limite de argv.
 */
export function buildClaudeArgs(params: Pick<StartAgentParams, 'model' | 'resumeSessionId' | 'maxBudgetUsd'>): string[] {
  const args = ['-p', '--output-format', 'stream-json', '--verbose', '--permission-mode', 'default'];
  if (params.model) args.push('--model', params.model);
  if (params.resumeSessionId) args.push('--resume', params.resumeSessionId);
  if (params.maxBudgetUsd !== undefined) args.push('--max-budget-usd', String(params.maxBudgetUsd));
  return args;
}

export function startClaudeSession(params: StartAgentParams, cb: AgentCallbacks): ManagedSession {
  const args = buildClaudeArgs(params);

  const env = buildAgentEnv();
  // Rotear pelo OmniRoute (endpoint compatível). Só efetivo se a rota estiver ok.
  if (params.baseUrl) env['ANTHROPIC_BASE_URL'] = params.baseUrl;

  const plan = planSpawn('claude', args, { env });
  if (!plan) {
    cb.onEvent({ type: 'turn.failed', turnId: 'claude', error: 'CLI claude não encontrada no PATH ou modelo inválido' });
    return { cancel: () => {} };
  }

  let child: ChildProcessWithoutNullStreams;
  try {
    child = spawn(plan.file, plan.args, { cwd: params.cwd, env, shell: plan.shell, windowsHide: true });
  } catch (err) {
    cb.onEvent({ type: 'turn.failed', turnId: 'claude', error: `spawn falhou: ${String(err)}` });
    return { cancel: () => {} };
  }

  cb.onEvent({ type: 'process.started' });
  child.stdin.on('error', () => { /* processo pode ter saído antes de ler o prompt */ });
  child.stdin.end(params.prompt, 'utf8');

  let sawResult = false;
  let terminalEmitted = false;
  let sessionReported: string | null = null;
  let buf = '';
  const handleLine = (line: string): void => {
    const msg = parseStreamLine(line);
    if (!msg) return;
    if (typeof msg.session_id === 'string' && msg.session_id && msg.session_id !== sessionReported) {
      sessionReported = msg.session_id;
      cb.onSession?.(msg.session_id);
    }
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
      killProcessTree(child, 'SIGINT');
      setTimeout(() => killProcessTree(child, 'SIGTERM'), 2000);
    },
  };
}
