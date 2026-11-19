export function authReturnPath(value: unknown): string {
  if (typeof value !== 'string' || value.length > 1024 || !value.startsWith('/') || value.startsWith('//') || /[\\\x00-\x20]/.test(value)) return '/dashboard';
  const base = 'https://sadhana.invalid';
  const url = new URL(value, base);
  if (url.origin !== base || url.pathname.startsWith('//') || /^\/(login|register|forgot-password|reset-password)\/?$/.test(url.pathname)) {
    return '/dashboard';
  }
  return url.pathname + url.search + url.hash;
}
