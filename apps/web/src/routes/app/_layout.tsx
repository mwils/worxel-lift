import { useState } from "react";
import { Alert, AppShell, Button, Group, Title, NavLink, Burger, Box, Loader } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconLayoutBoard,
  IconUsers,
  IconMessage2,
  IconSettings,
  IconLogout,
  IconClipboardList,
  IconHistory,
  IconMailExclamation,
  IconNews,
} from "@tabler/icons-react";
import { NavLink as RouterLink, Outlet, useLocation } from "react-router-dom";
import { notifications } from "@mantine/notifications";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { notifyError } from "../../lib/notify";
import { clearSessionHint } from "../../lib/session";
import { clearAllSnapshots } from "../../lib/snapshot";
import { GlobalSearchBar, useHasCustomers } from "../../features/history/GlobalSearchBar";

/** Shown until an instant-signup account clicks its confirmation link.
 *  Outbound sends (texts, estimates, pay links) 403 until then. */
function ConfirmEmailBanner({ email }: { email: string }) {
  const [resending, setResending] = useState(false);

  async function resend() {
    setResending(true);
    try {
      await api.post("/auth/magic-link", { email });
      notifications.show({ color: "green", message: `Confirmation link sent to ${email}.` });
    } catch (err) {
      notifyError(err, { title: "Couldn't resend", fallback: "Try again in a minute." });
    } finally {
      setResending(false);
    }
  }

  return (
    <Alert
      color="yellow"
      variant="light"
      icon={<IconMailExclamation size={18} />}
      title="Confirm your email to text customers"
      mb="md"
    >
      <Group justify="space-between" gap="sm">
        <Box>
          We sent a link to <b>{email}</b>. Until you tap it, sending texts, estimates, and pay
          links is locked.
        </Box>
        <Button size="compact-sm" variant="light" color="yellow" onClick={resend} loading={resending}>
          Resend link
        </Button>
      </Group>
    </Alert>
  );
}

const NAV = [
  { to: "/", label: "Board", icon: IconLayoutBoard, end: true },
  { to: "/ros", label: "History", icon: IconHistory },
  { to: "/customers", label: "Customers", icon: IconUsers },
  { to: "/messages", label: "Messages", icon: IconMessage2 },
  { to: "/templates", label: "Saved jobs", icon: IconClipboardList },
  { to: "/settings", label: "Settings", icon: IconSettings },
];

export function AppLayout() {
  const [opened, { toggle, close }] = useDisclosure();
  const location = useLocation();
  const hasCustomers = useHasCustomers();
  const [loggingOut, setLoggingOut] = useState(false);
  const { me } = useAuth();

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    // Best-effort: await the Set-Cookie response so the browser drops the
    // session cookie before we navigate. If the API hiccups, still bounce.
    try {
      await api.post("/auth/logout");
    } catch {
      // intentionally swallow — don't trap Mike on the app shell
    }
    // Drop the "signed in before" hint so /login paints instantly, and the
    // board snapshot so a shared device doesn't flash this shop's jobs.
    clearSessionHint();
    clearAllSnapshots();
    // Hard reload to /login. Bypasses all in-memory React + TanStack Query
    // state — guarantees the next page load sees a fresh /auth/me against
    // the now-cleared cookie. Avoids the brief "app shell with stale `me`"
    // flash that a soft navigate causes.
    window.location.href = "/login";
  }

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: 240, breakpoint: "sm", collapsed: { mobile: !opened } }}
      padding={{ base: "sm", sm: "md" }}
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" aria-label={opened ? "Close menu" : "Open menu"} />
            <Title order={3}>Lift</Title>
          </Group>
          {hasCustomers && <GlobalSearchBar />}
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="sm">
        <Box style={{ flex: 1 }}>
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              component={RouterLink as any}
              to={item.to}
              end={item.end}
              label={item.label}
              leftSection={<item.icon size={18} />}
              active={
                item.end
                  ? location.pathname === item.to
                  : location.pathname.startsWith(item.to)
              }
              onClick={close}
            />
          ))}
          {me?.user.isCompanyAdmin && (
            <NavLink
              component={RouterLink as any}
              to="/admin/blog"
              label="Blog admin"
              leftSection={<IconNews size={18} />}
              active={location.pathname.startsWith("/admin/blog")}
              onClick={close}
            />
          )}
        </Box>
        <NavLink
          label={loggingOut ? "Signing out…" : "Sign out"}
          leftSection={loggingOut ? <Loader size="xs" /> : <IconLogout size={18} />}
          onClick={logout}
          disabled={loggingOut}
        />
      </AppShell.Navbar>

      <AppShell.Main>
        {me && me.user.emailVerified === false && <ConfirmEmailBanner email={me.user.email} />}
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
