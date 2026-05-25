import { notifications } from "@mantine/notifications";

/**
 * Mike-voice error notification. Always shows a title naming the action that
 * failed; falls back to a plain message if the raw error is empty or technical.
 * Use this instead of `notifications.show({ color: "red", ... })` directly.
 */
export function notifyError(
  err: unknown,
  options?: { title?: string; fallback?: string }
) {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  notifications.show({
    color: "red",
    title: options?.title ?? "Something didn't work",
    message: raw || options?.fallback || "Try again in a second.",
  });
}

export function notifySuccess(message: string, title?: string) {
  notifications.show({ color: "green", title, message });
}
