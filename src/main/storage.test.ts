import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { emptyLibrary } from '../core/workspace.js';
import { JsonFileStore } from './storage.js';

describe('JsonFileStore', () => {
  let dir: string;
  let file: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'frigg-store-'));
    file = join(dir, 'workspace.json');
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('arquivo ausente → biblioteca vazia, sem recovered', () => {
    const r = new JsonFileStore(file).loadOrEmpty();
    expect(r.recovered).toBe(false);
    expect(r.library.workspaces.length).toBeGreaterThan(0);
  });

  it('salva de forma atômica e recarrega o mesmo conteúdo', () => {
    const store = new JsonFileStore(file);
    const lib = emptyLibrary();
    store.save(lib);
    expect(readdirSync(dir)).toEqual(['workspace.json']); // sem .tmp sobrando
    const r = store.loadOrEmpty();
    expect(r.recovered).toBe(true);
    expect(r.library).toEqual(JSON.parse(readFileSync(file, 'utf8')));
    expect(r.library.activeId).toBe(lib.activeId);
  });

  it('arquivo corrompido é preservado como .corrupt-* e não perde dados em silêncio', () => {
    writeFileSync(file, '{ não é json');
    const r = new JsonFileStore(file).loadOrEmpty();
    expect(r.recovered).toBe(false);
    const files = readdirSync(dir);
    expect(files.some((f) => f.startsWith('workspace.json.corrupt-'))).toBe(true);
    expect(files).not.toContain('workspace.json');
  });

  it('JSON válido porém irrecuperável também é preservado (não é sobrescrito pelo autosave)', () => {
    const original = JSON.stringify({ version: 2, activeId: 'a', workspaces: [{ id: 'a', name: 'A', nodes: [{ id: 'n', kind: 'futuro', position: { x: 0, y: 0 } }], edges: [] }] });
    writeFileSync(file, original);
    const r = new JsonFileStore(file).loadOrEmpty();
    expect(r.recovered).toBe(false);
    const backup = readdirSync(dir).find((f) => f.startsWith('workspace.json.corrupt-'));
    expect(backup).toBeDefined();
    expect(readFileSync(join(dir, backup!), 'utf8')).toBe(original);
  });

  it('recusa salvar biblioteca inválida', () => {
    expect(() => new JsonFileStore(file).save({ nope: true } as never)).toThrow();
  });
});
