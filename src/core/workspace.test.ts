import { describe, it, expect } from 'vitest';
import { parseWorkspace, emptyWorkspace } from './workspace.js';

describe('parseWorkspace', () => {
  it('aceita workspace vazio válido', () => {
    const doc = parseWorkspace(emptyWorkspace('X'));
    expect(doc.version).toBe(1);
    expect(doc.name).toBe('X');
    expect(doc.nodes).toHaveLength(0);
  });

  it('rejeita versão não suportada', () => {
    expect(() => parseWorkspace({ version: 2, nodes: [], edges: [] })).toThrow(/version/);
  });

  it('rejeita kind de nó inválido', () => {
    expect(() =>
      parseWorkspace({ version: 1, nodes: [{ id: 'a', kind: 'foo', position: { x: 0, y: 0 } }], edges: [] }),
    ).toThrow(/kind/);
  });

  it('rejeita ids duplicados', () => {
    const n = { kind: 'note', position: { x: 0, y: 0 } };
    expect(() =>
      parseWorkspace({ version: 1, nodes: [{ id: 'a', ...n }, { id: 'a', ...n }], edges: [] }),
    ).toThrow(/duplicad/);
  });

  it('descarta arestas que apontam para nós inexistentes', () => {
    const doc = parseWorkspace({
      version: 1,
      nodes: [{ id: 'a', kind: 'note', position: { x: 0, y: 0 } }],
      edges: [{ id: 'e1', source: 'a', target: 'zzz' }],
    });
    expect(doc.edges).toHaveLength(0);
  });

  it('normaliza data ausente para objeto vazio', () => {
    const doc = parseWorkspace({
      version: 1,
      nodes: [{ id: 'a', kind: 'terminal', position: { x: 1, y: 2 } }],
      edges: [],
    });
    expect(doc.nodes[0]!.data).toEqual({});
  });
});
