import { useEffect, useRef } from "react";
import { Button, Group, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useRegisterSW } from "virtual:pwa-register/react";

const NOTIFICATION_ID = "pwa-update";
// A shop tablet stays open all day; without this the browser only checks for
// a new service worker on navigation, so a deploy never reaches it.
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Service-worker registration + "New version available" toast.
 *
 * `registerType: "prompt"` (vite.config.ts) means a new build installs and
 * waits instead of taking over. We surface a persistent notification; the
 * owner taps Refresh when they're between jobs and `updateServiceWorker(true)`
 * activates the waiting worker, which reloads the page. Also re-checks hourly
 * and whenever the tab becomes visible again.
 */
export function UpdatePrompt() {
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

  const shown = useRef(false);

  useEffect(() => {
    if (!needRefresh) return;
    const show = () => {
      if (shown.current) return;
      shown.current = true;
      notifications.show({
        id: NOTIFICATION_ID,
        color: "blue",
        autoClose: false,
        withCloseButton: true,
        onClose: () => {
          shown.current = false;
        },
        title: "New version available",
        message: (
          <Group justify="space-between" wrap="nowrap">
            <Text size="sm">Refresh to pick up the latest fixes.</Text>
            <Button size="xs" onClick={() => void updateServiceWorker(true)}>
              Refresh
            </Button>
          </Group>
        ),
      });
    };
    show();
    // If the owner dismissed it mid-job, bring it back the next time they
    // come back to the tab — the waiting build is still there.
    const onVisible = () => {
      if (document.visibilityState === "visible") show();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [needRefresh, updateServiceWorker]);

  return null;
}
