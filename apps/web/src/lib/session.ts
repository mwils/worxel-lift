/**
 * Session hint — a localStorage flag that says "this browser has signed in
 * before". It is NOT auth (the HTTP-only cookie is); it only decides whether
 * the app root should block on /auth/me before painting. A first visit with no
 * hint renders /login immediately instead of a multi-second spinner.
 *
 * Set whenever /auth/me succeeds, cleared on sign-out or a 401.
 */
const KEY = "lift_session";

export function hasSessionHint(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function markSessionHint(): void {
  try {
    window.localStorage.setItem(KEY, "1");
  } catch {
    /* private mode / disabled storage — ignore */
  }
}

export function clearSessionHint(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
