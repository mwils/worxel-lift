/**
 * SSR entry used ONLY by scripts/prerender.mjs at build time — never deployed.
 * Mirrors main.tsx's provider stack with a MemoryRouter pinned to one path,
 * so the pre-rendered HTML matches what the client renders and hydrates over.
 */
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { MantineProvider } from "@mantine/core";
import { AppRoutes } from "./App";
import { theme } from "./theme";

export function render(path: string): string {
  return renderToString(
    <MantineProvider theme={theme} defaultColorScheme="light">
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </MantineProvider>
  );
}
