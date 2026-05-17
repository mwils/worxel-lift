import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Center, Loader, Stack, Text, Title, Container, TextInput, Button, Paper } from "@mantine/core";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

export function VerifyRoute() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const token = params.get("token");
  const email = params.get("email");
  const phone = params.get("phone");

  const [state, setState] = useState<"verifying" | "needCode" | "error">("verifying");
  const [errMsg, setErrMsg] = useState("");
  const [code, setCode] = useState("");

  useEffect(() => {
    async function run() {
      if (token && email) {
        try {
          const res = await api.post<{ ok: true; needsOnboarding: boolean }>("/auth/verify", {
            token,
            email,
          });
          await qc.invalidateQueries({ queryKey: ["me"] });
          navigate(res.needsOnboarding ? "/onboarding" : "/", { replace: true });
        } catch (err) {
          setState("error");
          setErrMsg((err as Error).message);
        }
      } else if (phone) {
        setState("needCode");
      } else {
        setState("error");
        setErrMsg("Missing token");
      }
    }
    run();
  }, [token, email, phone, navigate, qc]);

  async function submitCode() {
    try {
      const res = await api.post<{ ok: true; needsOnboarding: boolean }>("/auth/verify", {
        phone,
        code,
      });
      await qc.invalidateQueries({ queryKey: ["me"] });
      navigate(res.needsOnboarding ? "/onboarding" : "/", { replace: true });
    } catch (err) {
      setErrMsg((err as Error).message);
    }
  }

  if (state === "verifying") {
    return (
      <Center h="100vh">
        <Stack align="center">
          <Loader />
          <Text c="dimmed">Signing you in…</Text>
        </Stack>
      </Center>
    );
  }

  if (state === "needCode") {
    return (
      <Container size={420} py="xl">
        <Paper p="lg" withBorder>
          <Stack>
            <Title order={3}>Enter your code</Title>
            <Text c="dimmed">We sent a 6-digit code to {phone}.</Text>
            <TextInput
              label="Code"
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={6}
            />
            {errMsg && <Text c="red">{errMsg}</Text>}
            <Button onClick={submitCode}>Verify</Button>
          </Stack>
        </Paper>
      </Container>
    );
  }

  return (
    <Center h="100vh">
      <Stack align="center">
        <Title order={3}>Something went wrong</Title>
        <Text c="red">{errMsg}</Text>
        <Button onClick={() => navigate("/login")}>Try again</Button>
      </Stack>
    </Center>
  );
}
