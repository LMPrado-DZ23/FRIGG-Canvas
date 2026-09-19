import { describe, it, expect } from 'vitest';
import {
  canBeManagedGraphNode,
  PTY_TERMINAL_CAPABILITIES,
  type HarnessCapabilities,
} from './harness-adapter.js';

describe('capacidades de harness (G2)', () => {
  it('terminal PTY puro NÃO pode ser nó gerenciado do grafo', () => {
    expect(canBeManagedGraphNode(PTY_TERMINAL_CAPABILITIES)).toBe(false);
  });

  it('adaptador com conclusão estruturada + cancelamento confirmado pode', () => {
    const caps: HarnessCapabilities = {
      structuredCompletion: true,
      approvals: true,
      confirmedCancel: true,
      resume: true,
      omniRouteRouting: 'unverified',
    };
    expect(canBeManagedGraphNode(caps)).toBe(true);
  });

  it('conclusão estruturada sem cancelamento confirmado não basta', () => {
    const caps: HarnessCapabilities = {
      structuredCompletion: true,
      approvals: false,
      confirmedCancel: false,
      resume: false,
      omniRouteRouting: 'unsupported',
    };
    expect(canBeManagedGraphNode(caps)).toBe(false);
  });
});
