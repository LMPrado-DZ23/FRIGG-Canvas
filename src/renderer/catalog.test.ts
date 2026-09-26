import { describe, expect, it } from 'vitest';
import { terminalShellFlavor } from './cli-catalog.js';
import { nodeTitle } from './node-label.js';
import { TEAM_TEMPLATES } from './templates.js';
import { roleById } from '../core/roles.js';
import type { WorkspaceNode } from '../core/workspace.js';

const node = (kind: WorkspaceNode['kind'], data: Record<string, unknown>): WorkspaceNode => ({ id: 'n', kind, position: { x: 0, y: 0 }, data });

describe('terminalShellFlavor', () => {
  it('PowerShell no Windows, POSIX no resto', () => {
    expect(terminalShellFlavor('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Electron/44')).toBe('powershell');
    expect(terminalShellFlavor('Mozilla/5.0 (X11; Linux x86_64) Electron/44')).toBe('posix');
    expect(terminalShellFlavor('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Electron/44')).toBe('posix');
  });
});

describe('nodeTitle', () => {
  it('nome custom > papel do agente > título > texto > tipo', () => {
    expect(nodeTitle(node('agent', { name: 'Minha Dev', role: 'developer' }))).toBe('Minha Dev');
    expect(nodeTitle(node('agent', { role: 'reviewer' }))).toBe('🔍 Revisor');
    expect(nodeTitle(node('terminal', { title: 'Build' }))).toBe('Build');
    expect(nodeTitle(node('note', { text: 'x'.repeat(40) }))).toBe('x'.repeat(30));
    expect(nodeTitle(node('draw', {}))).toBe('draw');
  });
});

describe('TEAM_TEMPLATES', () => {
  it('só usa papéis que existem e ids únicos', () => {
    const ids = TEAM_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of TEAM_TEMPLATES) {
      expect(t.nodes.length).toBeGreaterThan(0);
      for (const n of t.nodes) expect(roleById(String(n.data['role']))).toBeDefined();
    }
  });
});
