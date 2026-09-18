/**
 * GA4 events + campaign attribution for the signup funnel.
 *
 * The marketing site forwards utm_* (and the cold-email `pid`) on the /login
 * link. Magic-link sign-in bounces through email, so the URL params are gone
 * by the time onboarding runs — we stash them in localStorage at /login and
 * read them back when the shop is created (see onboarding.tsx). The same
 * params ride along on every funnel event so GA can attribute activation
 * ("first RO created", "first estimate sent") to the campaign, not just the
 * registration.
 */

export const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
export type UtmKey = (typeof UTM_KEYS)[number];
export type Utm = Partial<Record<UtmKey, string>>;

const UTM_STORAGE_KEY = "lift_utm";

/** Read utm_* from the current URL and persist them (only when present). */
export function captureUtmFromUrl(): void {
  if (typeof window === "undefined") return;
  const search = new URLSearchParams(window.location.search);
  const utm: Utm = {};
  for (const k of UTM_KEYS) {
    const v = search.get(k);
    if (v) utm[k] = v.slice(0, 200);
  }
  if (Object.keys(utm).length === 0) return;
  try {
    localStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(utm));
  } catch {
    /* private mode / disabled storage — ignore */
  }
}

export function readUtm(): Utm | null {
  try {
    const raw = localStorage.getItem(UTM_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const utm: Utm = {};
    for (const k of UTM_KEYS) {
      if (typeof parsed[k] === "string") utm[k] = parsed[k] as string;
    }
    return Object.keys(utm).length ? utm : null;
  } catch {
    return null;
  }
}

export function clearUtm(): void {
  try {
    localStorage.removeItem(UTM_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Fire a GA4 event if gtag.js is loaded (index.html). Never throws. */
export function track(name: string, params: Record<string, string | number | boolean> = {}): void {
  if (typeof window === "undefined") return;
  const g = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
  if (typeof g !== "function") return;
  try {
    g("event", name, { ...(readUtm() ?? {}), ...params });
  } catch {
    /* analytics must never break the app */
  }
}

/**
 * Fire `name` once per browser. Used for activation milestones ("first RO
 * created") where the client has no cheap server-side count to consult.
 */
export function trackOnce(name: string, params: Record<string, string | number | boolean> = {}): void {
  const key = `lift_tracked_${name}`;
  try {
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, new Date().toISOString());
  } catch {
    /* storage unavailable — fall through and fire anyway */
  }
  track(name, params);
}
