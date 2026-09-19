import { describe, it, expect } from 'vitest';
import { OmniRouteClient, healthLabel, type FetchLike } from './omniroute-client.js';

const client = (fetchImpl: FetchLike) =>
  new OmniRouteClient({ baseUrl: 'http://127.0.0.1:8787/', fetchImpl, now: () => 1000 });

describe('OmniRouteClient.probeHealth', () => {
  it('HTTP OK -> reachable', async () => {
    const c = client(async () => ({ ok: true, status: 200 }));
    const r = await c.probeHealth();
    expect(r.status).toBe('reachable');
  });

  it('HTTP não-OK -> unavailable (não simula saúde)', async () => {
    const c = client(async () => ({ ok: false, status: 503 }));
    const r = await c.probeHealth();
    expect(r.status).toBe('unavailable');
    expect(r.detail).toContain('503');
  });

  it('erro de rede (serviço ausente) -> unavailable', async () => {
    const c = client(async () => {
      throw new Error('ECONNREFUSED');
    });
    const r = await c.probeHealth();
    expect(r.status).toBe('unavailable');
    expect(r.detail).toContain('ECONNREFUSED');
  });

  it('sonda o path de gerenciamento correto', async () => {
    let seen = '';
    const c = client(async (url) => {
      seen = url;
      return { ok: true, status: 200 };
    });
    await c.probeHealth();
    expect(seen).toBe('http://127.0.0.1:8787/api/monitoring/health');
  });
});

describe('healthLabel', () => {
  it('unknown nunca é rotulado como saudável', () => {
    expect(healthLabel('unknown')).not.toMatch(/conectado/i);
  });
  it('unavailable é explícito', () => {
    expect(healthLabel('unavailable')).toMatch(/indispon/i);
  });
});
