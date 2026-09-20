const SEARCH_URL = 'https://www.google.com/search?q=';

export function isSafeBrowserUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
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
