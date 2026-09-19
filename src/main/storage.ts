/**
 * FRIGG — persistência do workspace em JSON (sem dependência nativa).
 * D09: recuperação sem perda silenciosa — arquivo corrompido não apaga nada,
 * cai para vazio e sinaliza `recovered:false` com backup do original.
 */
import { readFileSync, writeFileSync, existsSync, renameSync } from 'node:fs';
import { parseWorkspace, emptyWorkspace, type WorkspaceDoc } from '../core/workspace.js';

export interface LoadResult {
  readonly doc: WorkspaceDoc;
  /** true quando carregou um documento válido do disco; false quando caiu p/ vazio. */
  readonly recovered: boolean;
}

export class JsonFileStore {
  constructor(private readonly path: string) {}

  loadOrEmpty(): LoadResult {
    if (!existsSync(this.path)) return { doc: emptyWorkspace(), recovered: false };
    try {
      const raw = readFileSync(this.path, 'utf8');
      const doc = parseWorkspace(JSON.parse(raw));
      return { doc, recovered: true };
    } catch {
      // Preserva o arquivo problemático em vez de sobrescrever.
      try {
        renameSync(this.path, `${this.path}.corrupt-${Date.now()}`);
      } catch {
        /* ignore */
      }
      return { doc: emptyWorkspace(), recovered: false };
    }
  }

  save(doc: WorkspaceDoc): void {
    const valid = parseWorkspace(doc); // valida antes de gravar
    const tmp = `${this.path}.tmp`;
    writeFileSync(tmp, JSON.stringify(valid, null, 2), 'utf8');
    renameSync(tmp, this.path); // gravação atômica
  }
}
