/**
 * FRIGG — leitura tipada da configuração de um nó-agente (data livre do
 * workspace) e montagem dos parâmetros de execução. Usado pelo nó e pelo fluxo.
 */
import { roleById } from '../core/roles.js';
import { parseRoutingMode, validBudgetUsd, validSessionRef, type RoutingMode } from '../core/agent-policy.js';
import type { AgentStartParams } from '../preload/preload.js';

export interface AgentConfig {
  readonly roleId: string;
  readonly harness: string;
  readonly systemPrompt: string;
  readonly model: string;
  readonly cwd: string;
  readonly routing: RoutingMode;
  readonly maxBudgetUsd: number | undefined;
  /** Conversa anterior que pode ser continuada. */
  readonly sessionRef: string | undefined;
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

export function agentConfig(data: Readonly<Record<string, unknown>> | undefined): AgentConfig {
  const d = data ?? {};
  const roleId = str(d['role']) || 'developer';
  const role = roleById(roleId);
  const budget = d['maxBudgetUsd'];
  const ref = d['sessionRef'];
  return {
    roleId,
    harness: str(d['harness']) || role?.harness || 'claude',
    systemPrompt: str(d['systemPrompt']) || role?.systemPrompt || '',
    model: str(d['model']),
    cwd: str(d['cwd']),
    routing: parseRoutingMode(d['routing']),
    maxBudgetUsd: validBudgetUsd(budget) ? budget : undefined,
    sessionRef: validSessionRef(ref) ? ref : undefined,
  };
}

/** Parâmetros de execução. `resume` só é enviado quando pedido explicitamente. */
export function agentStartParams(cfg: AgentConfig, prompt: string, resume = false): AgentStartParams {
  return {
    prompt,
    harness: cfg.harness,
    routing: cfg.routing,
    ...(cfg.model ? { model: cfg.model } : {}),
    ...(cfg.cwd ? { cwd: cfg.cwd } : {}),
    ...(cfg.maxBudgetUsd !== undefined ? { maxBudgetUsd: cfg.maxBudgetUsd } : {}),
    ...(resume && cfg.sessionRef ? { resume: cfg.sessionRef } : {}),
  };
}

/** Prompt da primeira mensagem: instruções do papel + tarefa. Continuações mandam só o texto. */
export function composeTaskPrompt(cfg: AgentConfig, task: string): string {
  return `${cfg.systemPrompt}\n\n---\n\nTAREFA:\n${task}\n\nTrabalhe no diretório do projeto. Ao terminar, resuma o que fez.`;
}
