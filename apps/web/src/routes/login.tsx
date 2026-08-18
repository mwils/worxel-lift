import { useEffect, useState } from "react";
import { Button, Container, Paper, Stack, Text, TextInput, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { notifyError } from "../lib/notify";

// Phone sign-in is hidden until the AWS End User Messaging 10DLC campaign
// is approved. Re-introduce the SegmentedControl + phone branch when ready.
export function LoginRoute() {
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    // Captures the cold-email tracking id forwarded from lift.worxel.com.
    // Survives magic-link → verify → onboard on the same browser; cleared in onboarding.
    const pid = new URLSearchParams(window.location.search).get("pid");
    if (pid && /^[a-fA-F0-9]{24}$/.test(pid)) {
      try {
        localStorage.setItem("lift_pid", pid);
      } catch { /* private mode / disabled storage — ignore */ }
    }
  }, []);

  const form = useForm({
    initialValues: { email: "" },
  });

  async function onSubmit(values: typeof form.values) {
    setSending(true);
    try {
      const res = await api.post<{ ok: true; signedIn?: boolean }>("/auth/magic-link", {
        email: values.email,
      });
      if (res.signedIn) {
        // Brand-new account — the API set the session cookie directly, no
        // email round-trip. Refetch `me` so the route guards see it, then
        // straight into onboarding.
        await qc.invalidateQueries({ queryKey: ["me"] });
        navigate("/onboarding", { replace: true });
        return;
      }
      setSent(true);
    } catch (err) {
      notifyError(err, { title: "Couldn't send", fallback: "Try again in a second." });
    } finally {
      setSending(false);
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
                disabled={sending}
                {...form.getInputProps("email")}
              />
              <Button
                type="submit"
                fullWidth
                loading={sending}
                loaderProps={{ type: "bars" }}
              >
                {sending ? "One sec…" : "Continue"}
              </Button>
              <Text c="dimmed" size="xs" ta="center">
                {sending
                  ? "Hang tight — this takes a couple seconds."
                  : "New here? You'll go straight to setup. Already have an account? We'll email you a sign-in link."}
              </Text>
            </Stack>
          </form>
        )}
      </Paper>
    </Container>
  );
}
