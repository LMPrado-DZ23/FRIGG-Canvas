import { create } from 'zustand';
import type { WorkspaceNode, WorkspaceEdge, NodeKind, WorkspaceLibrary } from '../core/workspace.js';
import { newWorkspaceId } from '../core/workspace.js';
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
  workspaces: { id: string; name: string }[];
  activeWorkspaceId: string;
  inactiveDocs: Record<string, { nodes: WorkspaceNode[]; edges: WorkspaceEdge[] }>;

  setView: (v: ViewMode) => void;
  select: (id: string | null) => void;
  setHealth: (h: HealthResult) => void;
  setPty: (p: { available: boolean; detail: string }) => void;
  setObjective: (s: string) => void;
  setWorkflowRunning: (b: boolean) => void;
  loadLibrary: (lib: WorkspaceLibrary, recovered: boolean) => void;
  toLibrary: () => WorkspaceLibrary;
  switchWorkspace: (id: string) => void;
  addWorkspace: (name?: string) => void;
  renameWorkspace: (id: string, name: string) => void;
  deleteWorkspace: (id: string) => void;
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
  workspaces: [],
  activeWorkspaceId: '',
  inactiveDocs: {},

  setView: (view) => set({ view }),
  select: (selectedId) => set({ selectedId }),
  setHealth: (health) => set({ health }),
  setPty: (ptyAvailable) => set({ ptyAvailable }),
  setObjective: (objective) => set({ objective }),
  setWorkflowRunning: (workflowRunning) => set({ workflowRunning }),

  loadLibrary: (lib, recovered) =>
    set(() => {
      const active = lib.workspaces.find((w) => w.id === lib.activeId) ?? lib.workspaces[0]!;
      const inactiveDocs: Record<string, { nodes: WorkspaceNode[]; edges: WorkspaceEdge[] }> = {};
      for (const w of lib.workspaces) {
        if (w.id !== active.id) inactiveDocs[w.id] = { nodes: [...w.nodes], edges: [...w.edges] };
      }
      return {
        workspaces: lib.workspaces.map((w) => ({ id: w.id, name: w.name })),
        activeWorkspaceId: active.id,
        nodes: [...active.nodes],
        edges: [...active.edges],
        inactiveDocs,
        recovered,
        selectedId: null,
      };
    }),

  toLibrary: () => {
    const s = get();
    const workspaces = s.workspaces.map((w) =>
      w.id === s.activeWorkspaceId
        ? { id: w.id, name: w.name, nodes: s.nodes, edges: s.edges }
        : { id: w.id, name: w.name, ...(s.inactiveDocs[w.id] ?? { nodes: [], edges: [] }) },
    );
    return { version: 2, activeId: s.activeWorkspaceId, workspaces };
  },

  switchWorkspace: (id) =>
    set((s) => {
      if (id === s.activeWorkspaceId) return s;
      if (!s.workspaces.some((w) => w.id === id)) return s; // ignora id inválido (não corrompe)
      const inactiveDocs = { ...s.inactiveDocs, [s.activeWorkspaceId]: { nodes: s.nodes, edges: s.edges } };
      const target = inactiveDocs[id] ?? { nodes: [], edges: [] };
      delete inactiveDocs[id];
      return { activeWorkspaceId: id, nodes: [...target.nodes], edges: [...target.edges], inactiveDocs, selectedId: null };
    }),

  addWorkspace: (name) =>
    set((s) => {
      const id = newWorkspaceId();
      const inactiveDocs = { ...s.inactiveDocs, [s.activeWorkspaceId]: { nodes: s.nodes, edges: s.edges } };
      return {
        workspaces: [...s.workspaces, { id, name: name && name.trim() ? name.trim() : `Workspace ${s.workspaces.length + 1}` }],
        activeWorkspaceId: id,
        nodes: [],
        edges: [],
        inactiveDocs,
        selectedId: null,
      };
    }),

  renameWorkspace: (id, name) =>
    set((s) => ({ workspaces: s.workspaces.map((w) => (w.id === id ? { ...w, name } : w)) })),

  deleteWorkspace: (id) =>
    set((s) => {
      if (s.workspaces.length <= 1) return s;
      const remaining = s.workspaces.filter((w) => w.id !== id);
      const inactiveDocs = { ...s.inactiveDocs };
      delete inactiveDocs[id];
      if (id === s.activeWorkspaceId) {
        const next = remaining[0]!;
        const doc = inactiveDocs[next.id] ?? { nodes: [], edges: [] };
        delete inactiveDocs[next.id];
        return { workspaces: remaining, activeWorkspaceId: next.id, nodes: [...doc.nodes], edges: [...doc.edges], inactiveDocs, selectedId: null };
      }
      return { workspaces: remaining, inactiveDocs };
    }),

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
                  : kind === 'file'
                    ? { title: 'Arquivo', path: '' }
                    : kind === 'draw'
                      ? { title: 'Desenho', image: '' }
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
      if (!s.nodes.some((node) => node.id === id)) return s;
      const prev = s.sessions[id]?.state ?? initialSessionState();
      const slot = s.sessions[id];
      return { sessions: { ...s.sessions, [id]: { ...slot, state: reduce(prev, ev), lastEventAt: at ?? Date.now() } } };
    }),

  setOutput: (id, text) =>
    set((s) => {
      if (!s.nodes.some((node) => node.id === id)) return s;
      const slot = s.sessions[id] ?? { state: initialSessionState(), lastEventAt: Date.now() };
      return { sessions: { ...s.sessions, [id]: { ...slot, output: text } } };
    }),

  addCost: (id, usd) =>
    set((s) => {
      if (!s.nodes.some((node) => node.id === id)) return s;
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
