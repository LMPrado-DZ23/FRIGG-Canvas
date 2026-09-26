import { describe, expect, it } from 'vitest';
import { shouldCheckForUpdates } from './updater.js';

describe('shouldCheckForUpdates', () => {
  const withFeed = (p: string): boolean => p.replaceAll('\\', '/').endsWith('/res/app-update.yml');

  it('só verifica na versão instalada, que tem app-update.yml', () => {
    expect(shouldCheckForUpdates({ isPackaged: true, resourcesPath: '/res', disabled: false, exists: withFeed })).toBe(true);
  });

  it('portátil (sem feed), dev e opt-out nunca verificam', () => {
    expect(shouldCheckForUpdates({ isPackaged: true, resourcesPath: '/res', disabled: false, exists: () => false })).toBe(false);
    expect(shouldCheckForUpdates({ isPackaged: false, resourcesPath: '/res', disabled: false, exists: withFeed })).toBe(false);
    expect(shouldCheckForUpdates({ isPackaged: true, resourcesPath: '/res', disabled: true, exists: withFeed })).toBe(false);
  });
});
