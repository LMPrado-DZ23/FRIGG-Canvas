/**
 * FRIGG — schema do workspace persistido (layout do canvas + nós).
 *
 * Versão + validação explícita antes de gravar (D09: schema versionado,
 * separado dos dados operacionais). O estado 3D (câmera/seleção) NÃO entra
 * aqui como fonte operacional — só layout/preferências.
 */

export type NodeKind = 'terminal' | 'note' | 'agent' | 'health' | 'browser' | 'text' | 'image' | 'file' | 'draw';

export interface NodePosition {
  readonly x: number;
  readonly y: number;
}

export interface WorkspaceNode {
  readonly id: string;
  readonly kind: NodeKind;
  readonly position: NodePosition;
  /** dados específicos do nó (título, texto da nota, harness do agente, cwd...). */
  readonly data: Readonly<Record<string, unknown>>;
}

export interface WorkspaceEdge {
  readonly id: string;
  readonly source: string;
  readonly target: string;
}

export interface WorkspaceDoc {
  readonly version: 1;
  readonly name: string;
  readonly nodes: readonly WorkspaceNode[];
  readonly edges: readonly WorkspaceEdge[];
}

export const NODE_KINDS: readonly NodeKind[] = ['terminal', 'note', 'agent', 'health', 'browser', 'text', 'image', 'file', 'draw'];

export function emptyWorkspace(name = 'Workspace'): WorkspaceDoc {
  return { version: 1, name, nodes: [], edges: [] };
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function num(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function parseNode(v: unknown, i: number): WorkspaceNode {
  if (!isObj(v)) throw new Error(`node[${i}] não é objeto`);
  const { id, kind, position, data } = v;
  if (typeof id !== 'string' || id.length === 0) throw new Error(`node[${i}].id inválido`);
  if (typeof kind !== 'string' || !NODE_KINDS.includes(kind as NodeKind))
    throw new Error(`node[${i}].kind inválido: ${String(kind)}`);
  if (!isObj(position) || !num(position['x']) || !num(position['y']))
    throw new Error(`node[${i}].position inválida`);
  return {
    id,
    kind: kind as NodeKind,
    position: { x: position['x'], y: position['y'] },
    data: isObj(data) ? data : {},
  };
}

function parseEdge(v: unknown, i: number): WorkspaceEdge {
  if (!isObj(v)) throw new Error(`edge[${i}] não é objeto`);
  const { id, source, target } = v;
  if (typeof id !== 'string' || typeof source !== 'string' || typeof target !== 'string')
    throw new Error(`edge[${i}] inválida`);
  return { id, source, target };
}

/** Biblioteca de workspaces (multi-projeto). Formato em disco versão 2. */
export interface WorkspaceEntry {
  readonly id: string;
  readonly name: string;
  readonly nodes: readonly WorkspaceNode[];
  readonly edges: readonly WorkspaceEdge[];
}
export interface WorkspaceLibrary {
  readonly version: 2;
  readonly activeId: string;
  readonly workspaces: readonly WorkspaceEntry[];
}

let wsCounter = 0;
export function newWorkspaceId(): string {
  return `ws-${Date.now().toString(36)}-${(wsCounter++).toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function emptyLibrary(): WorkspaceLibrary {
  const id = newWorkspaceId();
  return { version: 2, activeId: id, workspaces: [{ id, name: 'Workspace 1', nodes: [], edges: [] }] };
}

/**
 * Aceita o formato novo (v2, biblioteca) OU o antigo (v1, doc único) e migra.
 * Nunca lança: em caso irrecuperável, retorna biblioteca vazia.
 */
export function parseLibrary(v: unknown): WorkspaceLibrary {
  return tryParseLibrary(v) ?? emptyLibrary();
}

/**
 * Como parseLibrary, mas retorna null quando o conteúdo é irrecuperável, para o
 * chamador preservar o original em vez de sobrescrevê-lo com uma biblioteca vazia.
 */
export function tryParseLibrary(v: unknown): WorkspaceLibrary | null {
  try {
    if (isObj(v) && v['version'] === 2 && Array.isArray(v['workspaces'])) {
      const entries: WorkspaceEntry[] = [];
      for (const raw of v['workspaces']) {
        if (!isObj(raw)) continue;
        const doc = parseWorkspace({ version: 1, name: raw['name'], nodes: raw['nodes'], edges: raw['edges'] });
        const id = typeof raw['id'] === 'string' && raw['id'] ? (raw['id'] as string) : newWorkspaceId();
        entries.push({ id, name: doc.name, nodes: doc.nodes, edges: doc.edges });
      }
      if (entries.length === 0) return null;
      const activeId =
        typeof v['activeId'] === 'string' && entries.some((e) => e.id === v['activeId'])
          ? (v['activeId'] as string)
          : entries[0]!.id;
      return { version: 2, activeId, workspaces: entries };
    }
    // Migração do formato antigo (v1, doc único).
    const doc = parseWorkspace(v);
    const id = newWorkspaceId();
    return { version: 2, activeId: id, workspaces: [{ id, name: doc.name || 'Workspace 1', nodes: doc.nodes, edges: doc.edges }] };
  } catch {
    return null;
  }
}

/** Validação estrita para gravação. Diferente da recuperação, nunca inventa dados. */
export function parseLibraryForSave(v: unknown): WorkspaceLibrary {
  if (!isObj(v) || v['version'] !== 2) throw new Error('biblioteca version 2 inválida');
  if (!Array.isArray(v['workspaces']) || v['workspaces'].length === 0)
    throw new Error('workspaces deve ser uma lista não vazia');
  if (v['workspaces'].length > 100) throw new Error('limite de workspaces excedido');

  const entries = v['workspaces'].map((raw, index): WorkspaceEntry => {
    if (!isObj(raw)) throw new Error(`workspace[${index}] não é objeto`);
    const id = raw['id'];
    if (typeof id !== 'string' || id.length === 0 || id.length > 128)
      throw new Error(`workspace[${index}].id inválido`);
    const doc = parseWorkspaceForSave({ version: 1, name: raw['name'], nodes: raw['nodes'], edges: raw['edges'] });
    return { id, name: doc.name, nodes: doc.nodes, edges: doc.edges };
  });
  const ids = new Set(entries.map((entry) => entry.id));
  if (ids.size !== entries.length) throw new Error('ids de workspace duplicados');
  const activeId = v['activeId'];
  if (typeof activeId !== 'string' || !ids.has(activeId)) throw new Error('activeId inválido');
  return { version: 2, activeId, workspaces: entries };
}

function parseWorkspaceForSave(v: unknown): WorkspaceDoc {
  if (!isObj(v) || v['version'] !== 1) throw new Error('workspace version 1 inválido');
  if (typeof v['name'] !== 'string' || v['name'].length === 0 || v['name'].length > 200)
    throw new Error('nome do workspace inválido');
  if (!Array.isArray(v['nodes']) || !Array.isArray(v['edges'])) throw new Error('nodes/edges inválidos');
  if (v['nodes'].length > 2_000 || v['edges'].length > 5_000) throw new Error('limite do workspace excedido');

  const nodes = v['nodes'].map((raw, index) => {
    const node = parseNode(raw, index);
    if (node.id.length > 128 || !isObj(raw) || !isObj(raw['data'])) throw new Error(`node[${index}].data inválido`);
    let encoded: string;
    try { encoded = JSON.stringify(raw['data']); } catch { throw new Error(`node[${index}].data não serializável`); }
    if (encoded.length > 1_000_000) throw new Error(`node[${index}].data excede o limite`);
    return node;
  });
  const ids = new Set(nodes.map((node) => node.id));
  if (ids.size !== nodes.length) throw new Error('ids de nó duplicados');
  const edges = v['edges'].map(parseEdge);
  for (const edge of edges) {
    if (edge.id.length === 0 || edge.id.length > 128 || !ids.has(edge.source) || !ids.has(edge.target))
      throw new Error(`aresta ${edge.id || '(sem id)'} inválida`);
  }
  return { version: 1, name: v['name'], nodes, edges };
}

/** Valida ANTES de gravar/usar. Lança em documento inválido. */
export function parseWorkspace(v: unknown): WorkspaceDoc {
  if (!isObj(v)) throw new Error('workspace não é objeto');
  if (v['version'] !== 1) throw new Error(`version não suportada: ${String(v['version'])}`);
  const name = typeof v['name'] === 'string' ? v['name'].slice(0, 200) : 'Workspace';
  const rawNodes = Array.isArray(v['nodes']) ? v['nodes'] : [];
  const rawEdges = Array.isArray(v['edges']) ? v['edges'] : [];
  if (rawNodes.length > 2_000 || rawEdges.length > 5_000) throw new Error('limite do workspace excedido');
  const nodes = rawNodes.map(parseNode);
  const ids = new Set(nodes.map((n) => n.id));
  if (ids.size !== nodes.length) throw new Error('ids de nó duplicados');
  const edges = rawEdges.map(parseEdge).filter((e) => ids.has(e.source) && ids.has(e.target));
  return { version: 1, name, nodes, edges };
}
