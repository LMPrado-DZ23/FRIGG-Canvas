import { useMemo } from 'react';
import { ReactFlow, Background, Controls, MiniMap, type Node, type Edge, type NodeTypes, type NodeMouseHandler, type Connection } from '@xyflow/react';
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
import { bridge } from '../bridge.js';

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
  const removeNode = useFrigg((s) => s.removeNode);
  const sessions = useFrigg((s) => s.sessions);

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
  const onNodesDelete = (deleted: Node[]): void => {
    for (const n of deleted) {
      const turn = sessions[n.id]?.state.turn;
      if (turn === 'running' || turn === 'awaiting_approval' || turn === 'cancelling') void bridge.agent.cancel(n.id);
      removeNode(n.id);
    }
  };
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
