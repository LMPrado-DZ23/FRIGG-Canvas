const SEARCH_URL = 'https://www.google.com/search?q=';

export function isSafeBrowserUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export function isSafeOmniRouteUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.username || url.password || url.search || url.hash) return false;
    if (url.protocol === 'http:') return ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function normalizeBrowserInput(input: string): string {
  const value = input.trim();
  if (!value) return 'https://www.google.com/';

  const candidate = /^https?:\/\//i.test(value)
    ? value
    : /^[\w-]+(\.[\w-]+)+(?:[/:?#]|$)/.test(value)
      ? `https://${value}`
      : '';

  if (candidate && isSafeBrowserUrl(candidate)) return new URL(candidate).toString();
  return `${SEARCH_URL}${encodeURIComponent(value)}`;
}

export function isValidTerminalSize(cols: number, rows: number): boolean {
  return Number.isInteger(cols) && cols >= 2 && cols <= 500
    && Number.isInteger(rows) && rows >= 1 && rows <= 300;
}

export function isTrustedRendererUrl(candidate: string, devOrigin?: string, packagedUrl?: string): boolean {
  try {
    const url = new URL(candidate);
    if (devOrigin) {
      const allowed = new URL(devOrigin);
      if (url.origin === allowed.origin) return true;
    }
    if (packagedUrl) return url.href === new URL(packagedUrl).href;
    return url.protocol === 'file:' && /\/dist\/renderer\/index\.html$/.test(url.pathname);
  } catch {
    return false;
  }
}

// Extensões que o SO executa em vez de abrir para leitura (shell.openPath roda o arquivo).
const EXECUTABLE_EXTENSIONS = new Set([
  'exe', 'com', 'bat', 'cmd', 'ps1', 'psm1', 'vbs', 'vbe', 'js', 'jse', 'wsf', 'wsh', 'msi', 'msp', 'scr',
  'pif', 'lnk', 'url', 'hta', 'cpl', 'jar', 'reg', 'inf', 'scf', 'appref-ms', 'application', 'gadget',
  'sh', 'command', 'app', 'desktop', 'run', 'bin', 'appimage',
]);

/** true quando abrir o caminho com o app padrão do SO executaria código. */
export function isExecutablePath(path: string): boolean {
  const name = path.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? '';
  // Windows ignora pontos/espaços finais ("x.exe." abre como x.exe).
  const trimmed = name.replace(/[. ]+$/, '');
  const dot = trimmed.lastIndexOf('.');
  if (dot < 0) return false;
  return EXECUTABLE_EXTENSIONS.has(trimmed.slice(dot + 1).toLowerCase());
}
