import { createTheme, MantineColorsTuple } from "@mantine/core";

const liftBlue: MantineColorsTuple = [
  "#eef5ff",
  "#dbe6f9",
  "#b3cbef",
  "#88aee6",
  "#6395dc",
  "#4b84d7",
  "#3d7bd5",
  "#2e69bd",
  "#235da8",
  "#0f4e95",
];

export const theme = createTheme({
  primaryColor: "liftBlue",
  colors: { liftBlue },
  defaultRadius: "md",
  fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
});
