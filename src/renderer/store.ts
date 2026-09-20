import { create } from 'zustand';
import type { WorkspaceDoc, WorkspaceNode, WorkspaceEdge, NodeKind } from '../core/workspace.js';
import { emptyWorkspace } from '../core/workspace.js';
import { initialSessionState, reduce, type AgentSessionState, type SessionEvent } from '../core/turn-state.js';
import type { HealthResult } from '../core/omniroute-client.js';
import { roleById } from '../core/roles.js';

export type ViewMode = '2d' | '3d' | 'op';

export interface AgentTemplate {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly systemPrompt: string;
  readonly harness: string;
  readonly model: string;
}

function loadTemplates(): AgentTemplate[] {
  try {
    const raw = localStorage.getItem('frigg:agentTemplates');
    if (raw) return JSON.parse(raw) as AgentTemplate[];
  } catch {
    /* ignore */
  }
  return [];
}
function persistTemplates(t: AgentTemplate[]): void {
  try {
    localStorage.setItem('frigg:agentTemplates', JSON.stringify(t));
  } catch {
    /* ignore */
  }
}

export interface SessionSlot {
  readonly state: AgentSessionState;
  readonly lastEventAt: number | null;
  readonly output?: string;
  readonly costUsd?: number;
}

interface FriggState {
  view: ViewMode;
  nodes: WorkspaceNode[];
  edges: WorkspaceEdge[];
  selectedId: string | null;
  health: HealthResult | null;
  ptyAvailable: { available: boolean; detail: string } | null;
  sessions: Record<string, SessionSlot>;
  recovered: boolean;
  objective: string;
  workflowRunning: boolean;
  agentTemplates: AgentTemplate[];

  setView: (v: ViewMode) => void;
  select: (id: string | null) => void;
  setHealth: (h: HealthResult) => void;
  setPty: (p: { available: boolean; detail: string }) => void;
  setObjective: (s: string) => void;
  setWorkflowRunning: (b: boolean) => void;
  loadDoc: (doc: WorkspaceDoc, recovered: boolean) => void;
  toDoc: () => WorkspaceDoc;
  addNode: (kind: NodeKind, at?: { x: number; y: number }, data?: Record<string, unknown>) => string;
  moveNode: (id: string, x: number, y: number) => void;
  patchNodeData: (id: string, data: Record<string, unknown>) => void;
  removeNode: (id: string) => void;
  addEdge: (source: string, target: string) => void;
  addTemplate: (nodes: readonly { kind: NodeKind; data: Record<string, unknown>; dx: number; dy: number }[], chain: boolean) => void;
  applyEvent: (id: string, ev: SessionEvent, at?: number) => void;
  setOutput: (id: string, text: string) => void;
  addCost: (id: string, usd: number) => void;
  saveAgentTemplate: (nodeId: string) => void;
  addAgentFromTemplate: (templateId: string) => void;
  removeAgentTemplate: (templateId: string) => void;
}

let counter = 0;
const newId = (k: string): string => `${k}-${Date.now().toString(36)}-${(counter++).toString(36)}`;

export const useFrigg = create<FriggState>((set, get) => ({
  view: '2d',
  nodes: [],
  edges: [],
  selectedId: null,
  health: null,
  ptyAvailable: null,
  sessions: {},
  recovered: false,
  objective: '',
  workflowRunning: false,
  agentTemplates: loadTemplates(),

  setView: (view) => set({ view }),
  select: (selectedId) => set({ selectedId }),
  setHealth: (health) => set({ health }),
  setPty: (ptyAvailable) => set({ ptyAvailable }),
  setObjective: (objective) => set({ objective }),
  setWorkflowRunning: (workflowRunning) => set({ workflowRunning }),

  loadDoc: (doc, recovered) => set({ nodes: [...doc.nodes], edges: [...doc.edges], recovered }),
  toDoc: () => ({ ...emptyWorkspace('FRIGG'), nodes: get().nodes, edges: get().edges }),

  addNode: (kind, at, data) => {
    const id = newId(kind);
    const position = at ?? { x: 120 + Math.random() * 320, y: 120 + Math.random() * 200 };
    const base: Record<string, unknown> =
      kind === 'note'
        ? { text: 'Nova nota' }
        : kind === 'agent'
          ? { title: 'Agente', role: 'developer', harness: 'claude', cwd: '' }
          : kind === 'terminal'
            ? { title: 'Terminal', cwd: '' }
            : kind === 'browser'
              ? { title: 'Navegador', url: 'https://www.google.com/' }
              : kind === 'text'
                ? { text: 'Título' }
                : kind === 'image'
                  ? { url: '' }
                  : { title: 'OmniRoute' };
    set((s) => ({ nodes: [...s.nodes, { id, kind, position, data: { ...base, ...data } }], selectedId: id }));
    return id;
  },

  moveNode: (id, x, y) =>
    set((s) => ({ nodes: s.nodes.map((n) => (n.id === id ? { ...n, position: { x, y } } : n)) })),

  patchNodeData: (id, data) =>
    set((s) => ({ nodes: s.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...data } } : n)) })),

  removeNode: (id) =>
    set((s) => {
      const sessions = { ...s.sessions };
      delete sessions[id];
      return {
        nodes: s.nodes.filter((n) => n.id !== id),
        edges: s.edges.filter((e) => e.source !== id && e.target !== id),
        sessions,
        selectedId: s.selectedId === id ? null : s.selectedId,
      };
    }),

  addEdge: (source, target) =>
    set((s) => {
      if (source === target) return s;
      if (s.edges.some((e) => e.source === source && e.target === target)) return s;
      return { edges: [...s.edges, { id: newId('e'), source, target }] };
    }),

  addTemplate: (specs, chain) =>
    set((s) => {
      const baseX = 160 + Math.random() * 80;
      const baseY = 120;
      const created = specs.map((sp) => {
        const id = newId(sp.kind);
        return { id, kind: sp.kind, position: { x: baseX + sp.dx, y: baseY + sp.dy }, data: sp.data };
      });
      const edges = chain
        ? created.slice(1).map((n, i) => ({ id: newId('e'), source: created[i]!.id, target: n.id }))
        : [];
      return { nodes: [...s.nodes, ...created], edges: [...s.edges, ...edges] };
    }),

  applyEvent: (id, ev, at) =>
    set((s) => {
      const prev = s.sessions[id]?.state ?? initialSessionState();
      const slot = s.sessions[id];
      return { sessions: { ...s.sessions, [id]: { ...slot, state: reduce(prev, ev), lastEventAt: at ?? Date.now() } } };
    }),

  setOutput: (id, text) =>
    set((s) => {
      const slot = s.sessions[id] ?? { state: initialSessionState(), lastEventAt: Date.now() };
      return { sessions: { ...s.sessions, [id]: { ...slot, output: text } } };
    }),

  addCost: (id, usd) =>
    set((s) => {
      const slot = s.sessions[id] ?? { state: initialSessionState(), lastEventAt: Date.now() };
      return { sessions: { ...s.sessions, [id]: { ...slot, costUsd: (slot.costUsd ?? 0) + usd } } };
    }),

  saveAgentTemplate: (nodeId) =>
    set((s) => {
      const n = s.nodes.find((x) => x.id === nodeId);
      if (!n) return s;
      const d = n.data;
      const roleId = typeof d['role'] === 'string' ? (d['role'] as string) : 'developer';
      const name = (typeof d['name'] === 'string' && d['name']) ? (d['name'] as string) : (roleById(roleId)?.label ?? 'Agente');
      const tpl: AgentTemplate = {
        id: newId('tpl'),
        name,
        role: roleId,
        systemPrompt: (typeof d['systemPrompt'] === 'string' ? (d['systemPrompt'] as string) : '') || (roleById(roleId)?.systemPrompt ?? ''),
        harness: typeof d['harness'] === 'string' ? (d['harness'] as string) : 'claude',
        model: typeof d['model'] === 'string' ? (d['model'] as string) : '',
      };
      const agentTemplates = [...s.agentTemplates, tpl];
      persistTemplates(agentTemplates);
      return { agentTemplates };
    }),

  addAgentFromTemplate: (templateId) => {
    const tpl = get().agentTemplates.find((t) => t.id === templateId);
    if (!tpl) return;
    get().addNode('agent', undefined, {
      name: tpl.name,
      role: tpl.role,
      systemPrompt: tpl.systemPrompt,
      harness: tpl.harness,
      model: tpl.model,
      cwd: '',
    });
  },

  removeAgentTemplate: (templateId) =>
    set((s) => {
      const agentTemplates = s.agentTemplates.filter((t) => t.id !== templateId);
      persistTemplates(agentTemplates);
      return { agentTemplates };
    }),
}));
