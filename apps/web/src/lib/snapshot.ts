/**
 * Tiny localStorage snapshot cache for TanStack Query `placeholderData`.
 *
 * TanStack's cache is in-memory, so every fresh page load (PWA launch, tab
 * reopen) starts empty and the board shows a loading state for the round-trip.
 * Routes that want to paint instantly on return visits write their last good
 * response here and read it back as placeholder data while the real fetch
 * runs. Scope keys by shopId so a shared device never shows another shop's
 * data; `clearAllSnapshots()` runs on sign-out for the same reason.
 */
const PREFIX = "lift_snapshot:";

export function readSnapshot<T>(key: string): T | undefined {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

export function writeSnapshot(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* quota / private mode — ignore, it's only a cache */
  }
}

export function clearAllSnapshots(): void {
  try {
    const doomed: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(PREFIX)) doomed.push(k);
    }
    for (const k of doomed) window.localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}
