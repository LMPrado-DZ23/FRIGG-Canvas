import { describe, expect, it } from 'vitest';
import { isSafeBrowserUrl, isSafeOmniRouteUrl, isTrustedRendererUrl, isValidTerminalSize, normalizeBrowserInput } from './security.js';

describe('fronteira de confiança do renderer', () => {
  it('aceita apenas o renderer empacotado e a origem de desenvolvimento configurada', () => {
    expect(isTrustedRendererUrl('file:///opt/frigg/dist/renderer/index.html')).toBe(true);
    expect(isTrustedRendererUrl('http://localhost:5173/', 'http://localhost:5173')).toBe(true);
    expect(isTrustedRendererUrl('https://attacker.example/', 'http://localhost:5173')).toBe(false);
    expect(isTrustedRendererUrl('file:///tmp/other.html')).toBe(false);
  });
});

describe('navegação do navegador incorporado', () => {
  it('aceita http(s) e rejeita esquemas privilegiados ou executáveis', () => {
    expect(isSafeBrowserUrl('https://example.com')).toBe(true);
    expect(isSafeBrowserUrl('http://localhost:3000')).toBe(true);
    expect(isSafeBrowserUrl('file:///etc/passwd')).toBe(false);
    expect(isSafeBrowserUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeBrowserUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
  });

  it('normaliza domínios e transforma entrada insegura em busca', () => {
    expect(normalizeBrowserInput('example.com')).toBe('https://example.com/');
    expect(normalizeBrowserInput('javascript:alert(1)')).toContain('google.com/search');
    expect(normalizeBrowserInput('')).toBe('https://www.google.com/');
  });
});

describe('dimensões do terminal', () => {
  it('aceita tamanhos usuais e rejeita valores perigosos', () => {
    expect(isValidTerminalSize(80, 24)).toBe(true);
    expect(isValidTerminalSize(Number.NaN, 24)).toBe(false);
    expect(isValidTerminalSize(-1, 24)).toBe(false);
    expect(isValidTerminalSize(100_000, 24)).toBe(false);
  });
});

describe('endpoint OmniRoute', () => {
  it('permite loopback HTTP e HTTPS sem credenciais/query', () => {
    expect(isSafeOmniRouteUrl('http://localhost:20128')).toBe(true);
    expect(isSafeOmniRouteUrl('http://127.0.0.1:20128')).toBe(true);
    expect(isSafeOmniRouteUrl('https://omni.example/v1')).toBe(true);
    expect(isSafeOmniRouteUrl('http://10.0.0.1:20128')).toBe(false);
    expect(isSafeOmniRouteUrl('https://user:secret@omni.example')).toBe(false);
  });
});
