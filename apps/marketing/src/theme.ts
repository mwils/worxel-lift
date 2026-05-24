import { createTheme, MantineColorsTuple } from "@mantine/core";

// "Service Counter" palette — newsprint cream, warm ink, Snap-On enamel red, stamp blue.
const ink: MantineColorsTuple = [
  "#f6f3ed",
  "#e7e2d6",
  "#cfc8b8",
  "#b3a98f",
  "#8c8270",
  "#605849",
  "#3f3a32",
  "#2a2622",
  "#1f1c19",
  "#1a1714",
];

const enamel: MantineColorsTuple = [
  "#fdecea",
  "#fad2cf",
  "#f3a59f",
  "#ec7770",
  "#e64f47",
  "#d63a31",
  "#c8261d",
  "#aa1d16",
  "#8b1612",
  "#6d0e0a",
];

const liftBlue: MantineColorsTuple = [
  "#eef2f8",
  "#d6dfee",
  "#a9bcd9",
  "#7d99c4",
  "#587bb2",
  "#3f67a4",
  "#345d9d",
  "#284c86",
  "#1e3a6b",
  "#142c54",
];

export const theme = createTheme({
  primaryColor: "enamel",
  primaryShade: 6,
  colors: { ink, enamel, liftBlue },
  white: "#f4eedf",
  black: "#1a1714",
  defaultRadius: 0,
  fontFamily:
    'Spectral, "Iowan Old Style", Georgia, "Times New Roman", serif',
  fontFamilyMonospace:
    '"Space Mono", "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
  headings: {
    fontFamily:
      '"Archivo Black", "Helvetica Neue", Helvetica, Arial, sans-serif',
    fontWeight: "900",
    sizes: {
      h1: { fontSize: "4.25rem", lineHeight: "1.02" },
      h2: { fontSize: "2.75rem", lineHeight: "1.05" },
      h3: { fontSize: "1.5rem", lineHeight: "1.15" },
    },
  },
});
