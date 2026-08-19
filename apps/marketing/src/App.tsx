import { BrowserRouter, Route, Routes, Link } from "react-router-dom";
import { Center, Container, Stack, Text, Title, Button } from "@mantine/core";
import { Landing } from "./Landing";
import { BookRoute } from "./routes/BookRoute";
import { ManageBookingRoute } from "./routes/ManageBookingRoute";
import { LegalRoute } from "./routes/LegalRoute";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/book/:slug" element={<BookRoute />} />
        <Route path="/booking/:token" element={<ManageBookingRoute />} />
        <Route path="/privacy" element={<LegalRoute />} />
        <Route path="/terms" element={<LegalRoute />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

function NotFound() {
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
