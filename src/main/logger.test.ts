import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createFileLogger } from './logger.js';

describe('createFileLogger', () => {
  let base: string;
  afterEach(() => rmSync(base, { recursive: true, force: true }));

  it('cria a pasta e acrescenta linhas com timestamp', () => {
    base = mkdtempSync(join(tmpdir(), 'frigg-log-'));
    const dir = join(base, 'logs');
    const log = createFileLogger(dir, 1_000, () => new Date('2026-01-01T00:00:00Z'));
    log('um');
    log('dois');
    expect(readFileSync(join(dir, 'main.log'), 'utf8')).toBe('[2026-01-01T00:00:00.000Z] um\n[2026-01-01T00:00:00.000Z] dois\n');
  });

  it('rotaciona ao passar do limite e mantém só um arquivo antigo', () => {
    base = mkdtempSync(join(tmpdir(), 'frigg-log-'));
    const log = createFileLogger(base, 60);
    for (let i = 0; i < 10; i++) log(`linha ${i} ${'x'.repeat(20)}`);
    expect(readdirSync(base).sort()).toEqual(['main.log', 'main.log.1']);
    expect(readFileSync(join(base, 'main.log'), 'utf8')).toContain('linha 9');
  });
});
