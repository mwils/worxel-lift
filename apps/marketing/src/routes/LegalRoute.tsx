import { Anchor, Box, Container, Divider, List, Stack, Text, Title } from "@mantine/core";
import { Link } from "react-router-dom";
import type { ReactNode } from "react";

/**
 * Combined Privacy Policy & Terms of Service, served at both /privacy and
 * /terms. Referenced by the 10DLC campaign registration for Lift — the SMS
 * section carries the carrier-required disclosures (consent, STOP/HELP,
 * no third-party marketing sharing). Keep those clauses intact when editing.
 */

const EFFECTIVE_DATE = "August 18, 2026";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Stack gap="xs">
      <Title order={3}>{title}</Title>
      {children}
    </Stack>
  );
}

export function LegalRoute() {
  return (
    <Box py="xl" style={{ background: "#f4eedf", minHeight: "100vh" }}>
      <Container size="sm" px="md">
        <Stack gap="lg">
          <Stack gap={4}>
            <Anchor component={Link} to="/" size="sm">
              ← Back to Lift
            </Anchor>
            <Title order={1}>Privacy Policy &amp; Terms of Service</Title>
            <Text c="dimmed" size="sm">
              Lift is a product of AICHEETAH IO LLC (doing business as Worxel), 3148 Cannon Rd,
              Greer, SC 29651. Effective {EFFECTIVE_DATE}.
            </Text>
          </Stack>

          <Section title="What Lift is">
            <Text>
              Lift is shop-management software for independent auto repair shops. Shops use Lift
              to manage repair orders and to send service-related text messages (SMS) and emails
              to their own customers — estimates, repair status updates, pickup notifications,
              and payment links.
            </Text>
          </Section>

          <Section title="Information we collect">
            <List spacing="xs">
              <List.Item>
                <b>Shop account data</b> — name, email address, shop name and address, and
                billing details for the shops that subscribe to Lift.
              </List.Item>
              <List.Item>
                <b>Customer records entered by shops</b> — names, phone numbers, email
                addresses, vehicle information, and repair-order details that a shop enters
                about its own customers in order to serve them.
              </List.Item>
              <List.Item>
                <b>Messages</b> — the content of texts sent and received through Lift, retained
                so shops have a record of their customer conversations.
              </List.Item>
            </List>
          </Section>

          <Section title="SMS / text messaging program">
            <Text>
              Lift sends <b>transactional service messages only</b> on behalf of repair shops:
              repair estimates, approval requests, status updates, vehicle-ready notifications,
              payment links, and replies to customer-initiated questions. Lift does not send
              marketing or promotional messages.
            </Text>
            <Text>
              <b>Consent.</b> A customer's phone number is collected in person by the repair
              shop at the service counter when the vehicle is written up, with the customer's
              agreement to receive text messages about their repair order. Message frequency
              varies with repair activity. Message and data rates may apply.
            </Text>
            <Text>
              <b>Opting out.</b> Reply <b>STOP</b> to any message to opt out — no further
              messages will be sent. Reply <b>HELP</b> for help, or contact{" "}
              <Anchor href="mailto:lift@worxel.com">lift@worxel.com</Anchor>.
            </Text>
            <Text>
              <b>No mobile information will be shared with third parties or affiliates for
              marketing or promotional purposes.</b> Text messaging originator opt-in data and
              consent are not shared with any third parties, except service providers acting on
              our behalf solely to deliver the messages.
            </Text>
          </Section>

          <Section title="How information is used and shared">
            <Text>
              Customer information entered by a shop is used only to provide the service to that
              shop — it is never sold, and never used to market to a shop's customers. We share
              data only with the service providers required to operate Lift (cloud hosting and
              messaging delivery via Amazon Web Services, payment processing via Stripe), each
              bound to use it solely on our behalf. We may disclose information if required by
              law.
            </Text>
          </Section>

          <Section title="Data retention and deletion">
            <Text>
              Shop and customer records are retained while a shop's account is active. A shop
              may request deletion of its account and associated data at any time by emailing{" "}
              <Anchor href="mailto:lift@worxel.com">lift@worxel.com</Anchor>.
            </Text>
          </Section>

          <Divider my="sm" />

          <Section title="Terms of service">
            <List spacing="xs">
              <List.Item>
                <b>Service.</b> Lift is provided on a subscription basis at $79/month per shop
                after a free trial. You may cancel at any time; cancellation stops future
                billing.
              </List.Item>
              <List.Item>
                <b>Acceptable use.</b> Shops may message only their own customers about actual
                service business, with the customer's consent. Marketing blasts, messages to
                purchased lists, and any unlawful content are prohibited and grounds for
                termination.
              </List.Item>
              <List.Item>
                <b>Your data.</b> Shops own their customer records. We act as a processor of
                that data on the shop's behalf.
              </List.Item>
              <List.Item>
                <b>Disclaimer.</b> Lift is provided "as is." To the maximum extent permitted by
                law, AICHEETAH IO LLC disclaims all warranties and is not liable for indirect,
                incidental, or consequential damages. Our total liability is limited to the
                fees paid in the twelve months preceding the claim.
              </List.Item>
              <List.Item>
                <b>Governing law.</b> These terms are governed by the laws of the State of South
                Carolina, USA.
              </List.Item>
              <List.Item>
                <b>Changes.</b> We may update this document; material changes will be posted
                here with a new effective date.
              </List.Item>
            </List>
          </Section>

          <Text c="dimmed" size="sm">
            Questions? <Anchor href="mailto:lift@worxel.com">lift@worxel.com</Anchor>
          </Text>
        </Stack>
      </Container>
    </Box>
  );
}
