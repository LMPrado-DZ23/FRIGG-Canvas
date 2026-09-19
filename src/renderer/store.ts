import { create } from 'zustand';
import type { WorkspaceDoc, WorkspaceNode, NodeKind } from '../core/workspace.js';
import { emptyWorkspace } from '../core/workspace.js';
import { initialSessionState, reduce, type AgentSessionState, type SessionEvent } from '../core/turn-state.js';
import type { HealthResult } from '../core/omniroute-client.js';

export type ViewMode = '2d' | '3d' | 'op';

export interface SessionSlot {
  readonly state: AgentSessionState;
  readonly lastEventAt: number | null;
}

interface FriggState {
  view: ViewMode;
  nodes: WorkspaceNode[];
  selectedId: string | null;
  health: HealthResult | null;
  ptyAvailable: { available: boolean; detail: string } | null;
  sessions: Record<string, SessionSlot>;
  recovered: boolean;

  setView: (v: ViewMode) => void;
  select: (id: string | null) => void;
  setHealth: (h: HealthResult) => void;
  setPty: (p: { available: boolean; detail: string }) => void;
  loadDoc: (doc: WorkspaceDoc, recovered: boolean) => void;
  toDoc: () => WorkspaceDoc;
  addNode: (kind: NodeKind, at?: { x: number; y: number }) => string;
  moveNode: (id: string, x: number, y: number) => void;
  patchNodeData: (id: string, data: Record<string, unknown>) => void;
  removeNode: (id: string) => void;
  applyEvent: (id: string, ev: SessionEvent, at?: number) => void;
}

let counter = 0;
const newId = (k: string): string => `${k}-${Date.now().toString(36)}-${(counter++).toString(36)}`;

export const useFrigg = create<FriggState>((set, get) => ({
  view: '2d',
  nodes: [],
  selectedId: null,
  health: null,
  ptyAvailable: null,
  sessions: {},
  recovered: false,

  setView: (view) => set({ view }),
  select: (selectedId) => set({ selectedId }),
  setHealth: (health) => set({ health }),
  setPty: (ptyAvailable) => set({ ptyAvailable }),

  loadDoc: (doc, recovered) => set({ nodes: [...doc.nodes], recovered }),
  toDoc: () => ({ ...emptyWorkspace('FRIGG'), nodes: get().nodes, edges: [] }),

  addNode: (kind, at) => {
    const id = newId(kind);
    const position = at ?? { x: 120 + Math.random() * 320, y: 120 + Math.random() * 200 };
    const data: Record<string, unknown> =
      kind === 'note'
        ? { text: 'Nova nota' }
        : kind === 'agent'
          ? { title: 'Agente', harness: 'pty-terminal' }
          : kind === 'terminal'
            ? { title: 'Terminal' }
            : { title: 'OmniRoute' };
    set((s) => ({ nodes: [...s.nodes, { id, kind, position, data }], selectedId: id }));
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
        sessions,
        selectedId: s.selectedId === id ? null : s.selectedId,
      };
    }),

  applyEvent: (id, ev, at) =>
    set((s) => {
      const prev = s.sessions[id]?.state ?? initialSessionState();
      return { sessions: { ...s.sessions, [id]: { state: reduce(prev, ev), lastEventAt: at ?? Date.now() } } };
    }),
}));
