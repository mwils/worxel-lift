import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ActionIcon, Tooltip } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useQuery } from "@tanstack/react-query";
import {
  Spotlight,
  type SpotlightActionData,
  type SpotlightActionGroupData,
  type SpotlightFilterFunction,
  spotlight,
} from "@mantine/spotlight";
import { IconCar, IconSearch, IconUser } from "@tabler/icons-react";
import { api } from "../../lib/api";
import { formatPhone } from "../../lib/format";

interface LookupCustomer {
  kind: "customer";
  id: string;
  label: string;
  sublabel: string;
}
interface LookupVehicle {
  kind: "vehicle";
  id: string;
  customerId: string;
  label: string;
  sublabel: string;
}
type LookupResult = LookupCustomer | LookupVehicle;
interface LookupResponse {
  results: LookupResult[];
}

/**
 * Spotlight-style global search. Cmd/Ctrl+K (built into Mantine Spotlight)
 * or the header trigger opens it; typing hits GET /lookup with a 200ms debounce.
 */
export function GlobalSearchBar() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [debounced] = useDebouncedValue(query.trim(), 200);

  const { data } = useQuery({
    queryKey: ["lookup", debounced],
    queryFn: () =>
      api.get<LookupResponse>(`/lookup?q=${encodeURIComponent(debounced)}&limit=10`),
    enabled: debounced.length > 0,
    staleTime: 30_000,
  });

  const actions = useMemo<Array<SpotlightActionData | SpotlightActionGroupData>>(() => {
    const results = data?.results ?? [];
    const customers = results.filter((r): r is LookupCustomer => r.kind === "customer");
    const vehicles = results.filter((r): r is LookupVehicle => r.kind === "vehicle");

    const groups: Array<SpotlightActionGroupData> = [];

    if (customers.length > 0) {
      groups.push({
        group: "Customers",
        actions: customers.map((c) => ({
          id: `customer-${c.id}`,
          label: c.label,
          description: formatPhone(c.sublabel),
          leftSection: <IconUser size={18} />,
          onClick: () => navigate(`/customers/${c.id}`),
        })),
      });
    }
    if (vehicles.length > 0) {
      groups.push({
        group: "Vehicles",
        actions: vehicles.map((v) => ({
          id: `vehicle-${v.id}`,
          label: v.label,
          description: v.sublabel,
          leftSection: <IconCar size={18} />,
          onClick: () => navigate(`/vehicles/${v.id}`),
        })),
      });
    }
    return groups;
  }, [data, navigate]);

  // Spotlight filters internally by default; we're already filtering server-side
  // so just pass everything through.
  const passthroughFilter: SpotlightFilterFunction = (_q, items) => items;

  return (
    <>
      <Tooltip label="Search (⌘K)">
        <ActionIcon
          variant="subtle"
          size="lg"
          aria-label="Open search"
          onClick={() => spotlight.open()}
        >
          <IconSearch size={20} />
        </ActionIcon>
      </Tooltip>

      <Spotlight
        actions={actions}
        query={query}
        onQueryChange={setQuery}
        searchProps={{
          leftSection: <IconSearch size={18} />,
          placeholder: "Search customers, plates, VINs…",
        }}
        nothingFound={debounced ? "No matches" : "Type to search by name, phone, plate, or VIN"}
        shortcut={["mod + K", "mod + P"]}
        // Filter server-side; show actions as-is.
        filter={passthroughFilter}
      />
    </>
  );
}

/**
 * Tiny hook the AppShell uses to skip mounting the GlobalSearchBar when
 * the shop has no customers yet (per plan: hide during empty state).
 */
export function useHasCustomers(): boolean {
  const { data } = useQuery({
    queryKey: ["customers-has-any"],
    queryFn: () => api.get<{ total: number }>("/customers?pageSize=1&page=1"),
    staleTime: 60_000,
  });
  return (data?.total ?? 0) > 0;
}
