/**
 * FRIGG — persistência da biblioteca de workspaces em JSON (sem dependência nativa).
 * D09: recuperação sem perda silenciosa. Migra automaticamente o formato antigo
 * (v1, doc único) para o novo (v2, biblioteca) via parseLibrary.
 */
import { readFileSync, writeFileSync, existsSync, renameSync } from 'node:fs';
import { parseLibrary, emptyLibrary, type WorkspaceLibrary } from '../core/workspace.js';

export interface LoadResult {
  readonly library: WorkspaceLibrary;
  /** true quando carregou algo válido do disco; false quando caiu para vazio. */
  readonly recovered: boolean;
}

export class JsonFileStore {
  constructor(private readonly path: string) {}

  loadOrEmpty(): LoadResult {
    if (!existsSync(this.path)) return { library: emptyLibrary(), recovered: false };
    try {
      const raw = readFileSync(this.path, 'utf8');
      const library = parseLibrary(JSON.parse(raw)); // aceita v1 (migra) e v2
      return { library, recovered: true };
    } catch {
      try {
        renameSync(this.path, `${this.path}.corrupt-${Date.now()}`);
      } catch {
        /* ignore */
      }
      return { library: emptyLibrary(), recovered: false };
    }
  }

  save(library: WorkspaceLibrary): void {
    const valid = parseLibrary(library); // normaliza/valida antes de gravar
    const tmp = `${this.path}.tmp`;
    writeFileSync(tmp, JSON.stringify(valid, null, 2), 'utf8');
    renameSync(tmp, this.path);
  }
}
