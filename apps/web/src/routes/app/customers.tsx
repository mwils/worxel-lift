import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Button,
  Card,
  Center,
  Group,
  Modal,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconPlus, IconSearch } from "@tabler/icons-react";
import { api } from "../../lib/api";
import { notifyError } from "../../lib/notify";
import { formatPhone, relativeTime } from "../../lib/format";
import { CustomerForm } from "../../features/customer/CustomerForm";
import type { CreateCustomerInput } from "@lift/shared/dto";

interface CustomerRow {
  id: string;
  firstName: string;
  lastName: string | null;
  phone: string;
  email: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ListResponse {
  customers: CustomerRow[];
  page: number;
  pageSize: number;
  total: number;
}

export function CustomersRoute() {
  const [q, setQ] = useState("");
  const [opened, { open, close }] = useDisclosure(false);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data, isPending } = useQuery({
    queryKey: ["customers", q],
    queryFn: () =>
      api.get<ListResponse>(`/customers${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  });

  const createMut = useMutation({
    mutationFn: (values: CreateCustomerInput) =>
      api.post<{ customer: CustomerRow }>("/customers", values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      notifications.show({ color: "green", message: "Customer added" });
      close();
    },
    onError: (err) => notifyError(err, { title: "Couldn't add customer" }),
  });

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Customers</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={open}>
          New customer
        </Button>
      </Group>

      <TextInput
        leftSection={<IconSearch size={16} />}
        placeholder="Search by name, phone, email…"
        value={q}
        onChange={(e) => setQ(e.currentTarget.value)}
      />

      <Card withBorder p={0}>
        {isPending ? (
          <Text c="dimmed" p="md">
            Loading…
          </Text>
        ) : !data || data.customers.length === 0 ? (
          <Center p="xl">
            <Stack align="center" gap="xs">
              <Text c="dimmed">
                {q.trim() ? `No customers match “${q.trim()}”.` : "No customers yet."}
              </Text>
              <Button leftSection={<IconPlus size={16} />} onClick={open}>
                {q.trim() ? "Add a customer" : "Add your first customer"}
              </Button>
            </Stack>
          </Center>
        ) : (
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Phone</Table.Th>
                <Table.Th>Email</Table.Th>
                <Table.Th>Added</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.customers.map((c) => (
                <Table.Tr
                  key={c.id}
                  style={{ cursor: "pointer" }}
                  onClick={() => navigate(`/customers/${c.id}`)}
                >
                  <Table.Td>
                    {c.firstName} {c.lastName ?? ""}
                  </Table.Td>
                  <Table.Td>{formatPhone(c.phone)}</Table.Td>
                  <Table.Td>{c.email ?? "—"}</Table.Td>
                  <Table.Td>{relativeTime(c.createdAt)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>

      <Modal opened={opened} onClose={close} title="New customer" centered>
        <CustomerForm
          loading={createMut.isPending}
          onCancel={close}
          onSubmit={async (values) => {
            await createMut.mutateAsync(values);
          }}
        />
      </Modal>
    </Stack>
  );
}
