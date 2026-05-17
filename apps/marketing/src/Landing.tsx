import {
  AppShell,
  Box,
  Button,
  Card,
  Container,
  Divider,
  Grid,
  Group,
  List,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
  Anchor,
  Accordion,
  Badge,
} from "@mantine/core";
import {
  IconCheck,
  IconX,
  IconBolt,
  IconDeviceMobile,
  IconMessageBolt,
  IconCreditCard,
} from "@tabler/icons-react";

const APP_URL = import.meta.env.VITE_WEB_APP_URL ?? "https://app.lift.com";
const CTA_PRIMARY = `${APP_URL}/login`;

export function Landing() {
  return (
    <AppShell header={{ height: 64 }}>
      <AppShell.Header>
        <Container size="lg" h="100%">
          <Group h="100%" justify="space-between">
            <Group gap={6}>
              <ThemeIcon variant="filled" size="md" radius="sm">
                <IconBolt size={16} />
              </ThemeIcon>
              <Title order={4}>Lift</Title>
            </Group>
            <Group gap="lg" visibleFrom="sm">
              <Anchor href="#features" c="dark">
                Features
              </Anchor>
              <Anchor href="#pricing" c="dark">
                Pricing
              </Anchor>
              <Anchor href="#faq" c="dark">
                FAQ
              </Anchor>
              <Anchor href={CTA_PRIMARY} c="dark">
                Sign in
              </Anchor>
            </Group>
            <Button component="a" href={CTA_PRIMARY}>
              Start free trial
            </Button>
          </Group>
        </Container>
      </AppShell.Header>

      <AppShell.Main>
        {/* HERO */}
        <Container size="lg" py={{ base: 48, md: 96 }}>
          <Grid gutter="xl" align="center">
            <Grid.Col span={{ base: 12, md: 7 }}>
              <Stack gap="lg">
                <Badge variant="light" size="lg">
                  For 1–3 bay independent shops
                </Badge>
                <Title order={1} size={48}>
                  Stop fielding "is my car ready" calls. Stay in the bay.
                </Title>
                <Text size="xl" c="dimmed">
                  Lift is the shop app for owner-operators. Built around AI that handles your
                  customer texts so you can keep wrenching.
                </Text>
                <Group>
                  <Button component="a" href={CTA_PRIMARY} size="lg">
                    Start your 14-day trial
                  </Button>
                  <Text c="dimmed">$79/mo after · no per-tech fees</Text>
                </Group>
              </Stack>
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 5 }}>
              <PhoneMockup />
            </Grid.Col>
          </Grid>
        </Container>

        {/* WHO IT'S FOR */}
        <Box bg="gray.0" py={64}>
          <Container size="lg">
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing={48}>
              <Stack>
                <Title order={2}>This is for you if…</Title>
                <List
                  spacing="sm"
                  size="md"
                  icon={
                    <ThemeIcon color="green" size={22} radius="xl">
                      <IconCheck size={14} />
                    </ThemeIcon>
                  }
                >
                  <List.Item>You own a 1–3 bay independent shop</List.Item>
                  <List.Item>You're the owner, the tech, <em>and</em> the service advisor</List.Item>
                  <List.Item>You're tired of "is my car ready" texts and phone calls</List.Item>
                  <List.Item>You quote work on paper, lose track, and re-quote later</List.Item>
                  <List.Item>You can't justify $400/mo for Shopmonkey or AutoLeap</List.Item>
                </List>
              </Stack>
              <Stack>
                <Title order={2}>This is NOT for you if…</Title>
                <List
                  spacing="sm"
                  size="md"
                  icon={
                    <ThemeIcon color="red" size={22} radius="xl">
                      <IconX size={14} />
                    </ThemeIcon>
                  }
                >
                  <List.Item>You have multiple locations</List.Item>
                  <List.Item>You employ a dedicated service advisor</List.Item>
                  <List.Item>Most of your revenue is fleet/B2B accounts</List.Item>
                  <List.Item>You're a specialty shop (trans-only, tires-only, body)</List.Item>
                  <List.Item>You're doing more than $1M/yr — get Shopmonkey</List.Item>
                </List>
                <Text c="dimmed" mt="sm">
                  We say no to a lot so the product feels right for the rest.
                </Text>
              </Stack>
            </SimpleGrid>
          </Container>
        </Box>

        {/* THE WEDGE */}
        <Container size="lg" py={96}>
          <Stack align="center" gap="lg" mb="xl">
            <Badge variant="light">The wedge</Badge>
            <Title order={2} ta="center" maw={720}>
              While you were under a hood, Lift answered 4 texts.
            </Title>
            <Text size="lg" c="dimmed" ta="center" maw={720}>
              Customers text the shop number. AI auto-replies to status checks and estimate
              approvals. Anything substantive gets routed to you — with a draft ready to send.
            </Text>
          </Stack>
          <Grid gutter="xl" align="center">
            <Grid.Col span={{ base: 12, md: 6 }}>
              <SmsThreadDemo />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Stack gap="md">
                <FeatureLine
                  icon={<IconMessageBolt size={18} />}
                  title="AI drafts every customer-facing message"
                  body="Estimates, status updates, ready-for-pickup — Lift translates mechanic-speak into plain English. You approve, then send."
                />
                <FeatureLine
                  icon={<IconBolt size={18} />}
                  title="Auto-replies for 'is my car ready'"
                  body="Lift answers status checks with the current state of the RO. You can turn it off — Mike approves every word otherwise."
                />
                <FeatureLine
                  icon={<IconCheck size={18} />}
                  title="One-tap estimate approvals"
                  body="Customer taps a link in the SMS. Approved estimates flip the RO to In Repair automatically."
                />
              </Stack>
            </Grid.Col>
          </Grid>
        </Container>

        {/* FEATURES */}
        <Box id="features" bg="gray.0" py={96}>
          <Container size="lg">
            <Stack align="center" mb="xl">
              <Title order={2}>What's in Lift</Title>
              <Text c="dimmed" size="lg" maw={640} ta="center">
                Just the things a 1–3 bay shop runs on. Nothing else.
              </Text>
            </Stack>
            <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
              <Card padding="lg" radius="md" withBorder>
                <ThemeIcon size={40} radius="md" mb="md">
                  <IconDeviceMobile size={22} />
                </ThemeIcon>
                <Title order={4}>Phone-first</Title>
                <Text c="dimmed" mt="sm">
                  Works on the phone in your pocket. Snap RO photos with the camera. Narrate
                  diagnoses from the bay — AI turns them into line items.
                </Text>
              </Card>
              <Card padding="lg" radius="md" withBorder>
                <ThemeIcon size={40} radius="md" mb="md">
                  <IconMessageBolt size={22} />
                </ThemeIcon>
                <Title order={4}>AI messaging</Title>
                <Text c="dimmed" mt="sm">
                  Dedicated shop SMS number. AI drafts every customer text and auto-replies to
                  the easy ones. You read the rest with a draft ready.
                </Text>
              </Card>
              <Card padding="lg" radius="md" withBorder>
                <ThemeIcon size={40} radius="md" mb="md">
                  <IconCreditCard size={22} />
                </ThemeIcon>
                <Title order={4}>Get paid faster</Title>
                <Text c="dimmed" mt="sm">
                  Pay links sent in SMS. Card on file with pre-authorization. Cars get picked up,
                  payment is already done.
                </Text>
              </Card>
            </SimpleGrid>
          </Container>
        </Box>

        {/* PRICING */}
        <Container id="pricing" size="sm" py={96}>
          <Stack align="center" mb="xl">
            <Title order={2}>One price. No surprises.</Title>
          </Stack>
          <Card padding="xl" radius="md" withBorder>
            <Stack align="center" gap="md">
              <Title order={1}>$79/mo</Title>
              <Text c="dimmed">14-day free trial · no card to start</Text>
              <Divider w="100%" my="sm" />
              <List
                spacing="sm"
                icon={
                  <ThemeIcon color="green" size={20} radius="xl">
                    <IconCheck size={12} />
                  </ThemeIcon>
                }
              >
                <List.Item>Unlimited techs, repair orders, and SMS</List.Item>
                <List.Item>Dedicated shop phone number</List.Item>
                <List.Item>AI-drafted customer messages</List.Item>
                <List.Item>Card-on-file payments via Stripe</List.Item>
                <List.Item>One-click CSV export of all your data</List.Item>
              </List>
              <Button size="lg" fullWidth component="a" href={CTA_PRIMARY}>
                Start your trial
              </Button>
            </Stack>
          </Card>
        </Container>

        {/* FAQ */}
        <Box id="faq" bg="gray.0" py={96}>
          <Container size="md">
            <Title order={2} mb="lg">
              Honest answers
            </Title>
            <Accordion variant="separated">
              <Accordion.Item value="setup">
                <Accordion.Control>Will I waste hours setting it up?</Accordion.Control>
                <Accordion.Panel>
                  No. Onboarding is three screens: shop info, test the SMS number, start the trial.
                  Most owners are sending their first AI-drafted estimate the same afternoon.
                </Accordion.Panel>
              </Accordion.Item>
              <Accordion.Item value="customers">
                <Accordion.Control>Will my customers hate AI texts?</Accordion.Control>
                <Accordion.Panel>
                  You approve every word before it sends. The only auto-replies are short
                  acknowledgements to "is my car ready" — you can switch those off in settings.
                </Accordion.Panel>
              </Accordion.Item>
              <Accordion.Item value="data">
                <Accordion.Control>Can I get my data out?</Accordion.Control>
                <Accordion.Panel>
                  Yes — one-click CSV export of customers, vehicles, ROs, messages, and payments.
                  Whenever you want, with no friction. We don't trap you.
                </Accordion.Panel>
              </Accordion.Item>
              <Accordion.Item value="qb">
                <Accordion.Control>What about QuickBooks?</Accordion.Control>
                <Accordion.Panel>
                  Today: CSV export in QuickBooks import format. Native sync is coming in 2026.
                </Accordion.Panel>
              </Accordion.Item>
              <Accordion.Item value="shopmonkey">
                <Accordion.Control>Why not Shopmonkey or AutoLeap?</Accordion.Control>
                <Accordion.Panel>
                  Those are great for bigger shops. You don't need 90% of what they ship. You do
                  need to stop drowning in customer texts. That's all Lift does — well.
                </Accordion.Panel>
              </Accordion.Item>
            </Accordion>
          </Container>
        </Box>

        {/* FOOTER */}
        <Box py="xl">
          <Container size="lg">
            <Group justify="space-between">
              <Group gap={6}>
                <ThemeIcon variant="filled" size="sm" radius="sm">
                  <IconBolt size={12} />
                </ThemeIcon>
                <Text size="sm" c="dimmed">
                  © {new Date().getFullYear()} Lift
                </Text>
              </Group>
              <Group gap="lg">
                <Anchor href="/terms" c="dimmed" size="sm">
                  Terms
                </Anchor>
                <Anchor href="/privacy" c="dimmed" size="sm">
                  Privacy
                </Anchor>
                <Anchor href="mailto:hello@lift.com" c="dimmed" size="sm">
                  hello@lift.com
                </Anchor>
              </Group>
            </Group>
          </Container>
        </Box>
      </AppShell.Main>
    </AppShell>
  );
}

function FeatureLine({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <Group align="flex-start" gap="md" wrap="nowrap">
      <ThemeIcon variant="light" size={36} radius="md">
        {icon}
      </ThemeIcon>
      <Box>
        <Text fw={600}>{title}</Text>
        <Text c="dimmed" size="sm" mt={4}>
          {body}
        </Text>
      </Box>
    </Group>
  );
}

function PhoneMockup() {
  return (
    <Card
      padding="lg"
      radius="xl"
      withBorder
      style={{ background: "linear-gradient(180deg, #0f4e95 0%, #1f3a73 100%)", color: "white" }}
    >
      <Stack gap="xs">
        <Text size="xs" c="gray.3">
          Lift · 12:42 PM
        </Text>
        <Text fw={600}>AI drafted an estimate for you</Text>
        <Card bg="rgba(255,255,255,0.1)" withBorder={false}>
          <Text size="sm">
            Hi Jess — front brakes need replacing. We'll do pads and a quick rotor turn, total $284.
            Tap below to approve:
          </Text>
          <Text size="xs" c="liftBlue.3" mt="xs">
            lift.com/e/A8FX2K
          </Text>
        </Card>
        <Group justify="space-between">
          <Button size="xs" color="green">
            Send
          </Button>
          <Button size="xs" variant="default">
            Edit
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}

function SmsThreadDemo() {
  return (
    <Card padding="lg" radius="md" withBorder>
      <Stack gap="xs">
        <Bubble from="customer">hey is my car ready</Bubble>
        <Bubble from="ai">
          Hi Jess — we're finishing the brake job now, should be ready by 4pm today. — Mike's Auto
        </Bubble>
        <Badge variant="light" size="xs">
          Auto-replied · status check
        </Badge>
        <Divider my="xs" />
        <Bubble from="customer">yes go ahead with the brakes</Bubble>
        <Bubble from="ai">Got it — approval logged. We'll text you when she's ready.</Bubble>
        <Badge variant="light" size="xs" color="green">
          Auto-approved · estimate
        </Badge>
      </Stack>
    </Card>
  );
}

function Bubble({ from, children }: { from: "customer" | "ai"; children: React.ReactNode }) {
  const isCustomer = from === "customer";
  return (
    <Box style={{ display: "flex", justifyContent: isCustomer ? "flex-start" : "flex-end" }}>
      <Box
        style={{
          maxWidth: "80%",
          padding: "8px 12px",
          borderRadius: 16,
          background: isCustomer ? "#f1f3f5" : "#0f4e95",
          color: isCustomer ? "inherit" : "white",
          fontSize: 14,
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
