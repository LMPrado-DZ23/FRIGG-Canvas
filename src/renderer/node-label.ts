import { roleById } from '../core/roles.js';
import type { WorkspaceNode } from '../core/workspace.js';

/** Rótulo amigável de um nó: nome custom > papel (agente) > título > texto > tipo. */
export function nodeTitle(node: WorkspaceNode): string {
  const d = node.data;
  if (typeof d['name'] === 'string' && d['name']) return d['name'] as string;
  if (node.kind === 'agent') {
    const r = roleById(typeof d['role'] === 'string' ? (d['role'] as string) : '');
    if (r) return `${r.emoji} ${r.label}`;
  }
  if (typeof d['title'] === 'string' && d['title']) return d['title'] as string;
  if (typeof d['text'] === 'string' && d['text']) return (d['text'] as string).slice(0, 30);
  return node.kind;
}
