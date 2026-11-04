/** Tiny TTL cache so repeated explanations/translations don't spend model credits twice. */
interface Entry {
  value: string;
  expiresAt: number;
}

const store = new Map<string, Entry>();
const MAX_ENTRIES = 300;

export function cacheGet(key: string): string | null {
  const hit = store.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    store.delete(key);
    return null;
  }
  return hit.value;
}

export function cacheSet(key: string, value: string, ttlMs = 60 * 60 * 1000): void {
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}
