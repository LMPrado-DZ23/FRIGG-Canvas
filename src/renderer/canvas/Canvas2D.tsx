import { useMemo } from 'react';
import { ReactFlow, Background, Controls, MiniMap, type Node, type Edge, type NodeTypes, type NodeMouseHandler, type Connection } from '@xyflow/react';
import { useFrigg } from '../store.js';
import { TerminalNode } from './nodes/TerminalNode.js';
import { NoteNode } from './nodes/NoteNode.js';
import { AgentNode } from './nodes/AgentNode.js';
import { HealthNode } from './nodes/HealthNode.js';

const nodeTypes: NodeTypes = {
  terminal: TerminalNode,
  note: NoteNode,
  agent: AgentNode,
  health: HealthNode,
};

export function Canvas2D(): JSX.Element {
  const nodes = useFrigg((s) => s.nodes);
  const edges = useFrigg((s) => s.edges);
  const moveNode = useFrigg((s) => s.moveNode);
  const select = useFrigg((s) => s.select);
  const addEdge = useFrigg((s) => s.addEdge);

  const rfNodes = useMemo<Node[]>(
    () =>
      nodes.map((n) => ({
        id: n.id,
        type: n.kind,
        position: n.position,
        data: { nodeId: n.id },
      })),
    [nodes],
  );

  const rfEdges = useMemo<Edge[]>(
    () => edges.map((e) => ({ id: e.id, source: e.source, target: e.target, animated: true })),
    [edges],
  );

  const onNodeDragStop = (_: unknown, node: Node): void => moveNode(node.id, node.position.x, node.position.y);
  const onNodeClick: NodeMouseHandler = (_, node) => select(node.id);
  const onConnect = (c: Connection): void => {
    if (c.source && c.target) addEdge(c.source, c.target);
  };

  return (
    <ReactFlow
      nodes={rfNodes}
      edges={rfEdges}
      nodeTypes={nodeTypes}
      onNodeDragStop={onNodeDragStop}
      onNodeClick={onNodeClick}
      onConnect={onConnect}
      onPaneClick={() => select(null)}
      fitView
      proOptions={{ hideAttribution: true }}
    >
      <Background color="#24344f" gap={22} />
      <MiniMap pannable zoomable maskColor="rgba(6,12,20,.7)" />
      <Controls />
    </ReactFlow>
  );
}
