import { useState } from "react";
import { AppShell, Group, Title, NavLink, Burger, Box, Loader } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconLayoutBoard,
  IconUsers,
  IconMessage2,
  IconSettings,
  IconLogout,
  IconClipboardList,
} from "@tabler/icons-react";
import { NavLink as RouterLink, Outlet, useLocation } from "react-router-dom";
import { api } from "../../lib/api";
import { GlobalSearchBar, useHasCustomers } from "../../features/history/GlobalSearchBar";

const NAV = [
  { to: "/", label: "Board", icon: IconLayoutBoard, end: true },
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
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
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
        </Box>
        <NavLink
          label={loggingOut ? "Signing out…" : "Sign out"}
          leftSection={loggingOut ? <Loader size="xs" /> : <IconLogout size={18} />}
          onClick={logout}
          disabled={loggingOut}
        />
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
