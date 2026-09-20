/**
 * FRIGG — schema do workspace persistido (layout do canvas + nós).
 *
 * Versão + validação explícita antes de gravar (D09: schema versionado,
 * separado dos dados operacionais). O estado 3D (câmera/seleção) NÃO entra
 * aqui como fonte operacional — só layout/preferências.
 */

export type NodeKind = 'terminal' | 'note' | 'agent' | 'health' | 'browser' | 'text' | 'image';

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

export const NODE_KINDS: readonly NodeKind[] = ['terminal', 'note', 'agent', 'health', 'browser', 'text', 'image'];

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

/** Valida ANTES de gravar/usar. Lança em documento inválido. */
export function parseWorkspace(v: unknown): WorkspaceDoc {
  if (!isObj(v)) throw new Error('workspace não é objeto');
  if (v['version'] !== 1) throw new Error(`version não suportada: ${String(v['version'])}`);
  const name = typeof v['name'] === 'string' ? v['name'] : 'Workspace';
  const rawNodes = Array.isArray(v['nodes']) ? v['nodes'] : [];
  const rawEdges = Array.isArray(v['edges']) ? v['edges'] : [];
  const nodes = rawNodes.map(parseNode);
  const ids = new Set(nodes.map((n) => n.id));
  if (ids.size !== nodes.length) throw new Error('ids de nó duplicados');
  const edges = rawEdges.map(parseEdge).filter((e) => ids.has(e.source) && ids.has(e.target));
  return { version: 1, name, nodes, edges };
}
