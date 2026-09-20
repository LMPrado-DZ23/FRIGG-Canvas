import { describe, expect, it } from 'vitest';
import { isCliAvailable } from './cli-availability.js';

describe('isCliAvailable', () => {
  it('detecta o Node atual sem usar shell', async () => {
    await expect(isCliAvailable(process.execPath)).resolves.toBe(false);
    await expect(isCliAvailable('node')).resolves.toBe(true);
  });

  it('rejeita nomes que poderiam injetar shell', async () => {
    await expect(isCliAvailable('node;echo injected')).resolves.toBe(false);
  });
});
