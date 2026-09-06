import { Link } from "react-router-dom";
import { Badge, Card, Collapse, Group, Stack, Text, UnstyledButton } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconChevronDown, IconChevronRight } from "@tabler/icons-react";
import { RO_STATUS_LABELS } from "@lift/shared/constants";
import { formatMoney, formatRoNumber, relativeTime } from "../../lib/format";

interface LineItem {
  id: string;
  kind: "labor" | "part" | "fee";
  description: string;
  hours: number | null;
  rate: number | null;
  qty: number | null;
  unitPrice: number | null;
  total: number;
}

interface RepairOrder {
  id: string;
  number: number;
  status: string;
  concern: string | null;
  diagnosis: string | null;
  total: number;
  paymentStatus: string;
  balanceCents?: number;
  completedAt: string | Date | null;
  createdAt: string | Date;
  lineItems: LineItem[];
}

function LineRow({ li }: { li: LineItem }) {
  const sub: string[] = [];
  if (li.kind === "labor" && li.hours != null && li.rate != null) {
    sub.push(`${li.hours}h × ${formatMoney(li.rate)}`);
  }
  if (li.kind !== "labor" && li.qty != null && li.unitPrice != null) {
    sub.push(`${li.qty} × ${formatMoney(li.unitPrice)}`);
  }
  return (
    <Group justify="space-between" wrap="nowrap" align="flex-start">
      <Stack gap={0} style={{ minWidth: 0, flex: 1 }}>
        <Text size="sm" lineClamp={2}>
          {li.description}
        </Text>
        {sub.length > 0 && (
          <Text size="xs" c="dimmed">
            {sub.join(" · ")}
          </Text>
        )}
      </Stack>
      <Text size="sm" fw={500}>
        {formatMoney(li.total)}
      </Text>
    </Group>
  );
}

export function RepairOrderTimelineCard({ ro }: { ro: RepairOrder }) {
  const [opened, { toggle }] = useDisclosure(false);
  const hasLines = ro.lineItems.length > 0;
  const visitDate = ro.completedAt ?? ro.createdAt;

  return (
    <Card withBorder padding="sm">
      <Stack gap="xs">
        <Group justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Text
              component={Link as any}
              to={`/ro/${ro.id}`}
              fw={600}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              {formatRoNumber(ro.number)}
            </Text>
            <Badge variant="light" size="sm">
              {(RO_STATUS_LABELS as Record<string, string>)[ro.status] ?? ro.status}
            </Badge>
            {ro.paymentStatus === "paid" && (
              <Badge variant="light" color="green" size="sm">
                paid
              </Badge>
            )}
            {ro.paymentStatus === "partial" && (
              <Badge variant="light" color="orange" size="sm">
                partial{ro.balanceCents ? ` · ${formatMoney(ro.balanceCents)} due` : ""}
              </Badge>
            )}
          </Group>
          <Text fw={600}>{formatMoney(ro.total)}</Text>
        </Group>

        <Text size="xs" c="dimmed">
          {relativeTime(visitDate)}
        </Text>

        {ro.concern && <Text size="sm">"{ro.concern}"</Text>}

        {hasLines && (
          <>
            <UnstyledButton
              onClick={toggle}
              style={{ minHeight: 44, display: "flex", alignItems: "center" }}
            >
              <Group gap={4}>
                {opened ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
                <Text size="sm" c="blue">
                  {opened ? "Hide work done" : `View work done (${ro.lineItems.length})`}
                </Text>
              </Group>
            </UnstyledButton>
            <Collapse in={opened}>
              <Stack gap="xs" pl="md">
                {ro.lineItems.map((li) => (
                  <LineRow key={li.id} li={li} />
                ))}
              </Stack>
            </Collapse>
          </>
        )}
      </Stack>
    </Card>
  );
}
