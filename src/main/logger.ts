/**
 * FRIGG — log do processo main em um arquivo único com rotação simples
 * (main.log → main.log.1 ao passar do limite). Antes: um arquivo por PID no
 * diretório temporário, que se acumulava para sempre. Falhas de IO são ignoradas.
 */
import { appendFileSync, existsSync, mkdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const MAX_LOG_BYTES = 1_000_000;

export function createFileLogger(dir: string, maxBytes = MAX_LOG_BYTES, now: () => Date = () => new Date()): (msg: string) => void {
  const file = join(dir, 'main.log');
  let ready = false;
  return (msg: string) => {
    try {
      if (!ready) {
        mkdirSync(dir, { recursive: true });
        ready = true;
      }
      if (existsSync(file) && statSync(file).size >= maxBytes) {
        rmSync(`${file}.1`, { force: true });
        renameSync(file, `${file}.1`);
      }
      appendFileSync(file, `[${now().toISOString()}] ${msg}\n`);
    } catch {
      /* log nunca derruba o app */
    }
  };
}
