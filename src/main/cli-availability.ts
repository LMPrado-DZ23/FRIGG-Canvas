import { spawn } from 'node:child_process';

/** Verifica uma CLI sem shell e sem instalar ou modificar a máquina. */
export function isCliAvailable(command: string, timeoutMs = 5_000): Promise<boolean> {
  if (!/^[a-zA-Z0-9_.-]+$/.test(command)) return Promise.resolve(false);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (available: boolean): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(available);
    };
    let child;
    try {
      child = spawn(command, ['--version'], { shell: false, windowsHide: true, stdio: 'ignore' });
    } catch {
      resolve(false);
      return;
    }
    const timer = setTimeout(() => {
      child.kill();
      finish(false);
    }, timeoutMs);
    child.once('error', () => finish(false));
    child.once('close', (code) => finish(code === 0));
  });
}
