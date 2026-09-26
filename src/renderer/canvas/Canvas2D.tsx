import { useEffect, useMemo, useState, type JSX } from 'react';
import { ReactFlow, Background, Controls, MiniMap, applyNodeChanges, type Node, type Edge, type NodeTypes, type NodeMouseHandler, type Connection, type NodeChange } from '@xyflow/react';
import { useFrigg } from '../store.js';
import { TerminalNode } from './nodes/TerminalNode.js';
import { NoteNode } from './nodes/NoteNode.js';
import { AgentNode } from './nodes/AgentNode.js';
import { HealthNode } from './nodes/HealthNode.js';
import { BrowserNode } from './nodes/BrowserNode.js';
import { TextNode } from './nodes/TextNode.js';
import { ImageNode } from './nodes/ImageNode.js';
import { FileNode } from './nodes/FileNode.js';
import { DrawNode } from './nodes/DrawNode.js';
import { removeNodeSafely } from '../node-actions.js';

const nodeTypes: NodeTypes = {
  terminal: TerminalNode,
  note: NoteNode,
  agent: AgentNode,
  health: HealthNode,
  browser: BrowserNode,
  text: TextNode,
  image: ImageNode,
  file: FileNode,
  draw: DrawNode,
};

export function Canvas2D(): JSX.Element {
  const nodes = useFrigg((s) => s.nodes);
  const edges = useFrigg((s) => s.edges);
  const moveNode = useFrigg((s) => s.moveNode);
  const select = useFrigg((s) => s.select);
  const addEdge = useFrigg((s) => s.addEdge);
  const selectedId = useFrigg((s) => s.selectedId);

  // Estado local do React Flow: aplica as mudanças de arraste/seleção durante a
  // interação (com `nodes` controlados sem onNodesChange o nó não acompanhava o
  // cursor e a seleção nunca era aplicada — a tecla Delete não apagava nada).
  // O store continua sendo a fonte da verdade: posição é gravada ao soltar.
  const [rfNodes, setRfNodes] = useState<Node[]>([]);
  useEffect(() => {
    setRfNodes((prev) => {
      const byId = new Map(prev.map((n) => [n.id, n]));
      return nodes.map((n) => {
        const cur = byId.get(n.id);
        return {
          ...(cur ?? {}),
          id: n.id,
          type: n.kind,
          position: cur?.dragging ? cur.position : n.position,
          data: { nodeId: n.id },
          // Seleção única e derivada do store: Delete só apaga o nó selecionado.
          selected: n.id === selectedId,
        };
      });
    });
  }, [nodes, selectedId]);
  // Remoções passam por onNodesDelete (cancela agentes, para o fluxo); seleção vai
  // para o store; o resto (arraste, dimensões) é aplicado localmente.
  const onNodesChange = (changes: NodeChange[]): void => {
    for (const c of changes) if (c.type === 'select' && c.selected) select(c.id);
    const local = changes.filter((c) => c.type !== 'remove' && c.type !== 'select');
    if (local.length > 0) setRfNodes((nds) => applyNodeChanges(local, nds));
  };

  const rfEdges = useMemo<Edge[]>(
    () => edges.map((e) => ({ id: e.id, source: e.source, target: e.target, animated: true })),
    [edges],
  );

  const onNodeDragStop = (_: unknown, node: Node): void => moveNode(node.id, node.position.x, node.position.y);
  const onNodeClick: NodeMouseHandler = (_, node) => select(node.id);
  const onNodesDelete = (deleted: Node[]): void => {
    for (const n of deleted) removeNodeSafely(n.id);
  };
  const onConnect = (c: Connection): void => {
    if (c.source && c.target) addEdge(c.source, c.target);
  };

  return (
    <ReactFlow
      nodes={rfNodes}
      onNodesChange={onNodesChange}
      edges={rfEdges}
      nodeTypes={nodeTypes}
      onNodeDragStop={onNodeDragStop}
      onNodeClick={onNodeClick}
      onNodesDelete={onNodesDelete}
      onConnect={onConnect}
      onPaneClick={() => select(null)}
      deleteKeyCode={['Delete']}
      fitView
      proOptions={{ hideAttribution: true }}
    >
      <Background color="#24344f" gap={22} />
      <MiniMap pannable zoomable maskColor="rgba(6,12,20,.7)" />
      <Controls />
    </ReactFlow>
  );
}
