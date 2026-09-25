import { describe, expect, it, vi } from 'vitest';
import { isSafeShellArg, killProcessTree, planSpawn, resolveExecutable } from './resolve-command.js';

const winFs = (files: string[]) => (p: string): boolean => files.map((f) => f.toLowerCase()).includes(p.toLowerCase());

describe('resolveExecutable', () => {
  const env = { Path: 'C:\\Tools;"C:\\Program Files\\nodejs";relative\\dir', PATHEXT: '.COM;.EXE;.BAT;.CMD' };

  it('aplica PATHEXT no Windows e respeita a ordem do PATH', () => {
    const isFile = winFs(['C:\\Program Files\\nodejs\\claude.cmd', 'C:\\Tools\\codex.exe']);
    expect(resolveExecutable('claude', { platform: 'win32', env, isFile })).toBe('C:\\Program Files\\nodejs\\claude.cmd');
    expect(resolveExecutable('codex', { platform: 'win32', env, isFile })).toBe('C:\\Tools\\codex.exe');
  });

  it('ignora diretórios relativos do PATH (evita sequestro pelo cwd)', () => {
    const isFile = winFs(['relative\\dir\\claude.cmd']);
    expect(resolveExecutable('claude', { platform: 'win32', env, isFile })).toBeNull();
  });

  it('resolve no POSIX sem extensões', () => {
    const isFile = (p: string): boolean => p === '/usr/local/bin/claude';
    expect(resolveExecutable('claude', { platform: 'linux', env: { PATH: '/usr/bin:/usr/local/bin' }, isFile }))
      .toBe('/usr/local/bin/claude');
  });

  it('rejeita nomes que poderiam injetar shell ou caminhos', () => {
    const isFile = (): boolean => true;
    for (const bad of ['node;calc', 'a b', '../x', 'C:\\x.exe', '']) {
      expect(resolveExecutable(bad, { platform: 'win32', env, isFile })).toBeNull();
    }
  });
});

describe('planSpawn', () => {
  const env = { PATH: 'C:\\npm', PATHEXT: '.EXE;.CMD' };
  const isFile = winFs(['C:\\npm\\claude.cmd', 'C:\\npm\\tool.exe']);

  it('usa shell apenas para .cmd e só com argumentos seguros', () => {
    expect(planSpawn('claude', ['-p', '--model', 'sonnet'], { platform: 'win32', env, isFile }))
      .toEqual({ file: '"C:\\npm\\claude.cmd" -p --model sonnet', args: [], shell: true });
    expect(planSpawn('claude', ['-p', 'texto & calc'], { platform: 'win32', env, isFile })).toBeNull();
  });

  it('recusa .cmd cujo caminho tem metacaracteres do cmd.exe (expandem mesmo entre aspas)', () => {
    for (const dir of ['C:\\Users\\a%PATH%b', 'C:\\Users\\hey!x!', 'C:\\A&B', 'C:\\a^b']) {
      const f = `${dir}\\claude.cmd`;
      expect(planSpawn('claude', ['-p'], { platform: 'win32', env: { PATH: dir, PATHEXT: '.CMD' }, isFile: winFs([f]) })).toBeNull();
    }
    const spaced = 'C:\\Program Files\\nodejs';
    expect(planSpawn('claude', ['-p'], { platform: 'win32', env: { PATH: spaced, PATHEXT: '.CMD' }, isFile: winFs([`${spaced}\\claude.cmd`]) }))
      .toEqual({ file: '"C:\\Program Files\\nodejs\\claude.cmd" -p', args: [], shell: true });
  });

  it('executáveis nativos não usam shell e aceitam qualquer argumento', () => {
    expect(planSpawn('tool', ['a b & c'], { platform: 'win32', env, isFile }))
      .toEqual({ file: 'C:\\npm\\tool.exe', args: ['a b & c'], shell: false });
  });

  it('retorna null quando a CLI não existe', () => {
    expect(planSpawn('missing', [], { platform: 'win32', env, isFile })).toBeNull();
  });
});

describe('isSafeShellArg', () => {
  it('bloqueia metacaracteres do cmd.exe', () => {
    for (const bad of ['', 'a b', '%X%', '!X!', 'a^b', 'a&b', 'a|b', 'a<b', 'a>b', 'a"b', "a'b", 'a\nb']) {
      expect(isSafeShellArg(bad)).toBe(false);
    }
    for (const ok of ['app-server', '--output-format', 'stream-json', 'openai/gpt-5', 'sonnet[1m]']) {
      expect(isSafeShellArg(ok)).toBe(true);
    }
  });
});

describe('killProcessTree', () => {
  it('não sinaliza processo já encerrado (PID pode ter sido reutilizado)', () => {
    const kill = vi.fn();
    killProcessTree({ pid: 1, kill, exitCode: 0, signalCode: null }, 'SIGTERM', 'linux');
    expect(kill).not.toHaveBeenCalled();
  });

  it('usa kill direto fora do Windows', () => {
    const kill = vi.fn();
    killProcessTree({ pid: 1, kill, exitCode: null, signalCode: null }, 'SIGINT', 'linux');
    expect(kill).toHaveBeenCalledWith('SIGINT');
  });
});
