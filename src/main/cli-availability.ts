import { spawn } from 'node:child_process';
import { planSpawn } from './resolve-command.js';

/** Verifica uma CLI sem shell arbitrário e sem instalar ou modificar a máquina. */
export function isCliAvailable(command: string, timeoutMs = 5_000): Promise<boolean> {
  const plan = planSpawn(command, ['--version']);
  if (!plan) return Promise.resolve(false);
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
      child = spawn(plan.file, plan.args, { shell: plan.shell, windowsHide: true, stdio: 'ignore' });
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
