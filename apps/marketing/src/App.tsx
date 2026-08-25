import { BrowserRouter, Route, Routes, Link } from "react-router-dom";
import { useNoindex } from "./seo";
import { Center, Container, Stack, Text, Title, Button } from "@mantine/core";
import { Landing } from "./Landing";
import { BookRoute } from "./routes/BookRoute";
import { ManageBookingRoute } from "./routes/ManageBookingRoute";
import { LegalRoute } from "./routes/LegalRoute";

/** Routes without a router — the SSR pre-render wraps these in MemoryRouter. */
export function AppRoutes() {
  return (
    <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/book/:slug" element={<BookRoute />} />
        <Route path="/booking/:token" element={<ManageBookingRoute />} />
        <Route path="/privacy" element={<LegalRoute />} />
        <Route path="/terms" element={<LegalRoute />} />
        <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

function NotFound() {
  // Soft-404 mitigation: the static host returns 200 for unknown paths, so
  // tell crawlers explicitly not to index them.
  useNoindex();
  return (
    <Center h="100vh">
      <Container size="sm">
        <Stack align="center" gap="md">
          <Title order={1}>404</Title>
          <Text c="dimmed">That page doesn't exist.</Text>
          <Button component={Link} to="/" variant="default">
            Back to Lift
          </Button>
        </Stack>
      </Container>
    </Center>
  );
}
