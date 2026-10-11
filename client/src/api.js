const KEY = 'ledgerly_token', BASE = (import.meta.env.VITE_API_URL || '') + '/api';
export const tok = { get: () => localStorage.getItem(KEY), set: t => (t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY)) };
export async function api(path, { method = 'GET', body } = {}) {
  const r = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', ...(tok.get() ? { Authorization: 'Bearer ' + tok.get() } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (r.status === 401 && tok.get()) { tok.set(null); window.dispatchEvent(new Event('ledgerly:logout')); }
    throw new Error(d.error || 'Request failed');
  }
  return d;
}
