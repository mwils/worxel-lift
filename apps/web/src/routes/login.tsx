import { useState } from "react";
import { Button, Container, Paper, Stack, Text, TextInput, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { api } from "../lib/api";

// Phone sign-in is hidden until the AWS End User Messaging 10DLC campaign
// is approved. Re-introduce the SegmentedControl + phone branch when ready.
export function LoginRoute() {
  const [sent, setSent] = useState(false);

  const form = useForm({
    initialValues: { email: "" },
  });

  async function onSubmit(values: typeof form.values) {
    try {
      await api.post("/auth/magic-link", { email: values.email });
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
      <Stack align="center" mb="xl" gap="xs">
        <Title order={1}>Lift</Title>
        <Text c="dimmed" size="sm" ta="center">
          Sign in — or start a 14-day free trial. No password, no card.
        </Text>
      </Stack>

      <Paper p="lg" withBorder radius="md">
        {sent ? (
          <Stack>
            <Title order={3}>Check your inbox</Title>
            <Text c="dimmed">
              We sent a sign-in link. It expires in 15 minutes.
            </Text>
            <Button variant="subtle" onClick={() => setSent(false)}>
              Use a different email
            </Button>
          </Stack>
        ) : (
          <form onSubmit={form.onSubmit(onSubmit)}>
            <Stack>
              <TextInput
                label="Email"
                placeholder="mike@shopname.com"
                type="email"
                required
                {...form.getInputProps("email")}
              />
              <Button type="submit" fullWidth>
                Email me a link
              </Button>
              <Text c="dimmed" size="xs" ta="center">
                New here? We'll create your shop after you confirm.
              </Text>
            </Stack>
          </form>
        )}
      </Paper>
    </Container>
  );
}
