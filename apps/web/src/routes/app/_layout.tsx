import { AppShell, Group, Title, NavLink, Burger, Box } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconLayoutBoard,
  IconUsers,
  IconMessage2,
  IconSettings,
  IconLogout,
  IconClipboardList,
} from "@tabler/icons-react";
import { NavLink as RouterLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
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
  const navigate = useNavigate();
  const qc = useQueryClient();
  const hasCustomers = useHasCustomers();

  async function logout() {
    await api.post("/auth/logout");
    qc.clear();
    navigate("/login", { replace: true });
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
        <NavLink label="Sign out" leftSection={<IconLogout size={18} />} onClick={logout} />
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
