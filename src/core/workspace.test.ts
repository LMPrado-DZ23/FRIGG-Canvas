import { describe, it, expect } from 'vitest';
import { parseWorkspace, emptyWorkspace, parseLibraryForSave } from './workspace.js';

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

describe('parseLibraryForSave', () => {
  it('rejeita biblioteca inválida em vez de substituir dados por um workspace vazio', () => {
    expect(() => parseLibraryForSave({ version: 2, activeId: 'missing', workspaces: 'invalid' }))
      .toThrow(/workspaces/i);
  });

  it('rejeita ids de workspace duplicados', () => {
    const workspace = { id: 'same', name: 'A', nodes: [], edges: [] };
    expect(() => parseLibraryForSave({
      version: 2,
      activeId: 'same',
      workspaces: [workspace, { ...workspace, name: 'B' }],
    })).toThrow(/duplicad/i);
  });

  it('rejeita estrutura parcial e aresta pendente sem apagar silenciosamente', () => {
    expect(() => parseLibraryForSave({ version: 2, activeId: 'a', workspaces: [{ id: 'a', name: 'A' }] }))
      .toThrow(/nodes\/edges/i);
    expect(() => parseLibraryForSave({
      version: 2,
      activeId: 'a',
      workspaces: [{ id: 'a', name: 'A', nodes: [], edges: [{ id: 'e', source: 'x', target: 'y' }] }],
    })).toThrow(/aresta/i);
  });
});
