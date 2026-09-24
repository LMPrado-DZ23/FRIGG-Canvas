import { describe, expect, it } from 'vitest';
import { buildAgentEnv } from './agent-env.js';

describe('agent environment', () => {
  it('mantém apenas variáveis explicitamente permitidas', () => {
    const env = buildAgentEnv({ PATH: '/bin', HOME: '/home/test', AWS_SECRET_ACCESS_KEY: 'do-not-copy', FRIGG_INTERNAL: 'do-not-copy' });
    expect(env.PATH).toBe('/bin');
    expect(env.HOME).toBe('/home/test');
    expect(env.AWS_SECRET_ACCESS_KEY).toBeUndefined();
    expect(env.FRIGG_INTERNAL).toBeUndefined();
  });
});
