import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useRegisterSW } from "virtual:pwa-register/react";

// A shop tablet stays open all day; without this the browser only checks for
// a new service worker on navigation, so a deploy never reaches it.
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Applies a waiting build on the next in-app navigation. Navigating already
 * discards the old screen, so the reload can't lose a half-filled form —
 * unlike reloading on tab-hide or the moment the build lands.
 */
export function AutoUpdate() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      const check = () => {
        if (typeof navigator !== "undefined" && navigator.onLine === false) return;
        registration.update().catch(() => {
          /* offline / transient — the next tick retries */
        });
      };
      window.setInterval(check, CHECK_INTERVAL_MS);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") check();
      });
    },
  });

  const { pathname } = useLocation();
  const lastPath = useRef(pathname);

  useEffect(() => {
    if (pathname === lastPath.current) return;
    lastPath.current = pathname;
    if (needRefresh) void updateServiceWorker(true);
  }, [pathname, needRefresh, updateServiceWorker]);

  return null;
}
