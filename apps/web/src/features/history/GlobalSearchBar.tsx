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
import {
  IconArrowRight,
  IconCar,
  IconClipboardList,
  IconSearch,
  IconUser,
} from "@tabler/icons-react";
import { api } from "../../lib/api";
import { formatPhone } from "../../lib/format";

/** Per-group cap. The API applies the same number per type, not overall. */
const GROUP_LIMIT = 5;

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
interface LookupRo {
  kind: "ro";
  id: string;
  number: number;
  status: string;
  label: string;
  sublabel: string;
}
type LookupResult = LookupCustomer | LookupVehicle | LookupRo;
interface LookupResponse {
  results: LookupResult[];
  counts?: { customers: number; vehicles: number; ros: number };
  groupLimit?: number;
}

/** "Customers" → "Customers (12)". Only shown once there's more than one hit. */
function groupLabel(name: string, count: number): string {
  return count > 1 ? `${name} (${count})` : name;
}

/**
 * Spotlight-style global search. Cmd/Ctrl+K (built into Mantine Spotlight)
 * or the header trigger opens it; typing hits GET /lookup with a 200ms debounce.
 *
 * Results are grouped by type — Repair orders, Customers, Vehicles — with a
 * per-group cap and a count in the group heading. When a group is truncated the
 * last row is a "See all N …" action into the fuller list, so at 800 customers
 * "Smith" is a short list plus one door out instead of an undifferentiated
 * scroll. Keyboard navigation is Spotlight's: the overflow row is a normal
 * action, so arrow keys + Enter reach it like any other.
 */
export function GlobalSearchBar() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [debounced] = useDebouncedValue(query.trim(), 200);

  const { data } = useQuery({
    queryKey: ["lookup", debounced],
    queryFn: () =>
      api.get<LookupResponse>(
        `/lookup?q=${encodeURIComponent(debounced)}&limit=${GROUP_LIMIT}`
      ),
    enabled: debounced.length > 0,
    staleTime: 30_000,
  });

  const actions = useMemo<Array<SpotlightActionData | SpotlightActionGroupData>>(() => {
    const results = data?.results ?? [];
    const customers = results.filter((r): r is LookupCustomer => r.kind === "customer");
    const vehicles = results.filter((r): r is LookupVehicle => r.kind === "vehicle");
    const ros = results.filter((r): r is LookupRo => r.kind === "ro");
    const counts = data?.counts;
    const cap = data?.groupLimit ?? GROUP_LIMIT;
    const q = encodeURIComponent(debounced);

    const customerCount = counts?.customers ?? customers.length;
    const vehicleCount = counts?.vehicles ?? vehicles.length;
    const roCount = counts?.ros ?? ros.length;

    /** "+N more" row, when the group has more matches than we're showing. */
    function overflow(
      idPrefix: string,
      total: number,
      shown: number,
      to: string
    ): SpotlightActionData[] {
      if (total <= shown || shown < cap) return [];
      return [
        {
          id: `${idPrefix}-more`,
          label: `+${total - shown} more`,
          description: "See the full list",
          leftSection: <IconArrowRight size={18} />,
          onClick: () => navigate(to),
        },
      ];
    }

    const groups: Array<SpotlightActionGroupData> = [];

    // Repair orders lead: an RO-number hit means the owner typed the number on
    // purpose, and it's the one exact match in the set.
    if (ros.length > 0) {
      groups.push({
        group: groupLabel("Repair orders", roCount),
        actions: [
          ...ros.map((r) => ({
            id: `ro-${r.id}`,
            label: r.label,
            description: r.sublabel,
            leftSection: <IconClipboardList size={18} />,
            onClick: () => navigate(`/ro/${r.id}`),
          })),
          ...overflow("ro", roCount, ros.length, `/ros?q=${q}`),
        ],
      });
    }

    if (customers.length > 0) {
      groups.push({
        group: groupLabel("Customers", customerCount),
        actions: [
          ...customers.map((c) => ({
            id: `customer-${c.id}`,
            label: c.label,
            description: formatPhone(c.sublabel),
            leftSection: <IconUser size={18} />,
            onClick: () => navigate(`/customers/${c.id}`),
          })),
          ...overflow("customer", customerCount, customers.length, `/customers?q=${q}`),
        ],
      });
    }

    if (vehicles.length > 0) {
      groups.push({
        // No standalone vehicles list to page into, so the count is the whole
        // story here — the plate/VIN search that found them is already exact.
        group: groupLabel("Vehicles", vehicleCount),
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
  }, [data, debounced, navigate]);

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
          placeholder: "Search customers, plates, VINs, RO numbers…",
        }}
        nothingFound={
          debounced
            ? `Nothing matches “${debounced}”.`
            : "Type to search by name, phone, plate, VIN, or RO number"
        }
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
