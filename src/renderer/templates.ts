/**
 * FRIGG — equipes prontas (fácil para leigos): o usuário escolhe uma equipe e
 * os nós-agente já vêm com papéis e conectados na ordem certa. Depois é só
 * escrever o objetivo e clicar em Orquestrar.
 */
import type { NodeKind } from '../core/workspace.js';

export interface TemplateSpec {
  readonly kind: NodeKind;
  readonly data: Record<string, unknown>;
  readonly dx: number;
  readonly dy: number;
}
export interface TeamTemplate {
  readonly id: string;
  readonly label: string;
  readonly chain: boolean;
  readonly nodes: readonly TemplateSpec[];
}

const agent = (role: string, i: number): TemplateSpec => ({ kind: 'agent', data: { role }, dx: i * 280, dy: (i % 2) * 40 });

export const TEAM_TEMPLATES: readonly TeamTemplate[] = [
  {
    id: 'feature',
    label: '🏗️ Equipe de Feature (Orquestrador→Arquiteto→Dev→Revisor→QA)',
    chain: true,
    nodes: ['orchestrator', 'architect', 'developer', 'reviewer', 'qa'].map(agent),
  },
  {
    id: 'review',
    label: '🔍 Revisão (Dev→Revisor→Segurança)',
    chain: true,
    nodes: ['developer', 'reviewer', 'security'].map(agent),
  },
  {
    id: 'discovery',
    label: '📊 Discovery (Analista→CTO→Arquiteto)',
    chain: true,
    nodes: ['analyst', 'cto', 'architect'].map(agent),
  },
  {
    id: 'solo',
    label: '💻 Só um Desenvolvedor',
    chain: false,
    nodes: ['developer'].map(agent),
  },
];
