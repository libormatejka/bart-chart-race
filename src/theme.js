import { readFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";

const DEFAULT_FONT_STACK = "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const FG = "#ffffff";
const MUTED = "rgba(255, 255, 255, 0.75)";

// Every one of these component keys can be set independently in
// fontFamily / fontSize / fontWeight / color below.
const COMPONENTS = [
  "title",
  "subtitle",
  "axisLabel",
  "barLabel",
  "barValue",
  "counterDate",
  "counterTotal",
  "counterTotalValue", // the bold number inside "Total: <value>"
  "tickLabel",
  "source",
  "sourceLink", // the clickable part when sourceUrl is set
];

function sameForAllComponents(value) {
  return Object.fromEntries(COMPONENTS.map((key) => [key, value]));
}

export const DEFAULT_THEME = {
  // Same font for every text element by default; override any key to set
  // a different font just for that element (e.g. a serif title but a
  // sans-serif everything else).
  fontFamily: sameForAllComponents(DEFAULT_FONT_STACK),
  fontSize: {
    title: 34,
    subtitle: 18,
    axisLabel: 14,
    barLabel: 16,
    barValue: 16,
    counterDate: 52,
    counterTotal: 26,
    counterTotalValue: 26,
    tickLabel: 13,
    source: 13,
    sourceLink: 13,
  },
  fontWeight: {
    title: 800,
    subtitle: 500,
    axisLabel: 400,
    barLabel: 400,
    barValue: 600,
    counterDate: 800,
    counterTotal: 500,
    counterTotalValue: 800,
    tickLabel: 400,
    source: 400,
    sourceLink: 400,
  },
  // Text/fill color per component — independent from the structural
  // "colors" below (background, bar fill, grid/scrubber chrome).
  color: {
    title: FG,
    subtitle: MUTED,
    axisLabel: MUTED,
    barLabel: FG,
    barValue: FG,
    counterDate: FG,
    counterTotal: FG,
    counterTotalValue: FG,
    tickLabel: MUTED,
    source: MUTED,
    sourceLink: FG,
  },
  // Structural colors shared across the chart chrome (not text).
  colors: {
    background: "#c6303e",
    foreground: FG, // scrub handle, play button icon, default text color
    muted: MUTED, // scrub track, tick lines
    barFill: "#fbdfe2",
    gridLine: "rgba(255, 255, 255, 0.45)",
    accent: "#ffe27a",
  },
  // Self-hosted font files to embed, e.g.
  // [{ "family": "Inter", "path": "fonts/Inter-Bold.woff2", "weight": 700 }]
  // Reference "family" from fontFamily above. Embedded as base64 into the
  // generated HTML, so there's no dependency on fonts being installed on
  // whatever machine opens the file or renders the video.
  fonts: [],
};

const MERGEABLE_GROUPS = ["fontFamily", "fontSize", "fontWeight", "color", "colors"];

/**
 * Loads a theme JSON file and deep-merges it over DEFAULT_THEME, so a
 * partial override file only needs to set the keys it wants to change.
 */
export function loadTheme(path) {
  if (!path) return DEFAULT_THEME;
  const override = JSON.parse(readFileSync(path, "utf8"));
  const theme = mergeTheme(DEFAULT_THEME, override);
  theme.fonts = resolveFonts(override.fonts, dirname(path));
  return theme;
}

const FONT_MIME_TYPES = {
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
};

const FONT_FORMATS = {
  ".woff2": "woff2",
  ".woff": "woff",
  ".ttf": "truetype",
  ".otf": "opentype",
};

// Font file paths in the theme JSON are relative to that file, so a theme
// (and the fonts it ships with) stays portable as one self-contained folder.
function resolveFonts(fonts, themeDir) {
  if (!fonts || fonts.length === 0) return [];
  return fonts.map(({ family, path, weight, style }) => {
    const ext = extname(path).toLowerCase();
    const bytes = readFileSync(join(themeDir, path));
    return {
      family,
      weight: weight || "normal",
      style: style || "normal",
      format: FONT_FORMATS[ext] || "woff2",
      dataUri: `data:${FONT_MIME_TYPES[ext] || "font/woff2"};base64,${bytes.toString("base64")}`,
    };
  });
}

/**
 * Renders @font-face rules that embed each font file as a base64 data URI
 * — no network request, so these fonts are always available, including
 * inside the headless browser that renders the video/GIF frames.
 */
export function fontsToCssFaces(fonts) {
  return fonts
    .map(
      (f) => `@font-face {
  font-family: "${f.family}";
  src: url("${f.dataUri}") format("${f.format}");
  font-weight: ${f.weight};
  font-style: ${f.style};
  font-display: block;
}`
    )
    .join("\n");
}

function mergeTheme(base, override) {
  const merged = { ...base, ...override };
  for (const group of MERGEABLE_GROUPS) {
    // A plain string for "fontFamily" (the old single-font shorthand)
    // applies that font to every element.
    const overrideGroup =
      group === "fontFamily" && typeof override.fontFamily === "string"
        ? Object.fromEntries(Object.keys(base.fontFamily).map((key) => [key, override.fontFamily]))
        : override[group] || {};
    merged[group] = { ...base[group], ...overrideGroup };
  }
  return merged;
}

/**
 * Renders a theme object as a `:root { --var: value; }` block. The main
 * stylesheet reads every visual value through one of these custom
 * properties, so this is the only place that needs to know their names.
 */
export function themeToCssVars(theme) {
  const vars = {
    "--bg": theme.colors.background,
    "--fg": theme.colors.foreground,
    "--muted": theme.colors.muted,
    "--bar-fill": theme.colors.barFill,
    "--grid-line": theme.colors.gridLine,
    "--accent": theme.colors.accent,
  };

  for (const key of COMPONENTS) {
    const cssKey = key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
    vars[`--font-family-${cssKey}`] = theme.fontFamily[key];
    vars[`--font-size-${cssKey}`] = `${theme.fontSize[key]}px`;
    vars[`--font-weight-${cssKey}`] = theme.fontWeight[key];
    vars[`--color-${cssKey}`] = theme.color[key];
  }

  const body = Object.entries(vars)
    .map(([name, value]) => `  ${name}: ${value};`)
    .join("\n");

  return `:root {\n${body}\n}`;
}
