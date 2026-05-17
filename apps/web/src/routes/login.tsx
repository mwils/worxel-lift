import { useState } from "react";
import { Button, Container, Paper, SegmentedControl, Stack, Text, TextInput, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { api } from "../lib/api";

type Method = "email" | "sms";

export function LoginRoute() {
  const [method, setMethod] = useState<Method>("email");
  const [sent, setSent] = useState(false);

  const form = useForm({
    initialValues: { email: "", phone: "" },
  });

  async function onSubmit(values: typeof form.values) {
    try {
      if (method === "email") {
        await api.post("/auth/magic-link", { email: values.email });
      } else {
        await api.post("/auth/sms-code", { phone: values.phone });
      }
      setSent(true);
    } catch (err) {
      notifications.show({
        color: "red",
        title: "Couldn't send",
        message: (err as Error).message,
      });
    }
  }

  return (
    <Container size={420} py="xl">
      <Stack align="center" mb="xl">
        <Title order={1}>Lift</Title>
        <Text c="dimmed" size="sm">
          The shop app for 1–3 bay independents.
        </Text>
      </Stack>

      <Paper p="lg" withBorder radius="md">
        {sent ? (
          <Stack>
            <Title order={3}>Check your {method === "email" ? "inbox" : "phone"}</Title>
            <Text c="dimmed">
              We sent a {method === "email" ? "sign-in link" : "6-digit code"}. It expires in{" "}
              {method === "email" ? "15" : "5"} minutes.
            </Text>
            <Button variant="subtle" onClick={() => setSent(false)}>
              Use a different {method === "email" ? "email" : "phone"}
            </Button>
          </Stack>
        ) : (
          <form onSubmit={form.onSubmit(onSubmit)}>
            <Stack>
              <SegmentedControl
                value={method}
                onChange={(v) => setMethod(v as Method)}
                data={[
                  { label: "Email", value: "email" },
                  { label: "Phone", value: "sms" },
                ]}
                fullWidth
              />
              {method === "email" ? (
                <TextInput
                  label="Email"
                  placeholder="mike@shopname.com"
                  type="email"
                  required
                  {...form.getInputProps("email")}
                />
              ) : (
                <TextInput
                  label="Phone"
                  placeholder="+15551234567"
                  type="tel"
                  required
                  {...form.getInputProps("phone")}
                />
              )}
              <Button type="submit" fullWidth>
                Send sign-in {method === "email" ? "link" : "code"}
              </Button>
            </Stack>
          </form>
        )}
      </Paper>
    </Container>
  );
}
