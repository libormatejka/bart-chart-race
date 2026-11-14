import { readFileSync } from "node:fs";

const DEFAULT_FONT_STACK = "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export const DEFAULT_THEME = {
  // Same font for every text element by default; override any key to set
  // a different font just for that element (e.g. a serif title but a
  // sans-serif everything else).
  fontFamily: {
    title: DEFAULT_FONT_STACK,
    subtitle: DEFAULT_FONT_STACK,
    axisLabel: DEFAULT_FONT_STACK,
    barLabel: DEFAULT_FONT_STACK,
    barValue: DEFAULT_FONT_STACK,
    counterDate: DEFAULT_FONT_STACK,
    counterTotal: DEFAULT_FONT_STACK,
    tickLabel: DEFAULT_FONT_STACK,
    source: DEFAULT_FONT_STACK,
  },
  colors: {
    background: "#c6303e",
    foreground: "#ffffff",
    muted: "rgba(255, 255, 255, 0.75)",
    barFill: "#fbdfe2",
    gridLine: "rgba(255, 255, 255, 0.45)",
    accent: "#ffe27a",
  },
  fontSize: {
    title: 34,
    subtitle: 18,
    axisLabel: 14,
    barLabel: 16,
    barValue: 16,
    counterDate: 52,
    counterTotal: 26,
    tickLabel: 13,
    source: 13,
  },
  fontWeight: {
    title: 800,
    subtitle: 500,
    barLabel: 400,
    barValue: 600,
    counterDate: 800,
    counterTotal: 500,
  },
};

const MERGEABLE_GROUPS = ["fontFamily", "colors", "fontSize", "fontWeight"];

/**
 * Loads a theme JSON file and deep-merges it over DEFAULT_THEME, so a
 * partial override file only needs to set the keys it wants to change.
 */
export function loadTheme(path) {
  if (!path) return DEFAULT_THEME;
  const override = JSON.parse(readFileSync(path, "utf8"));
  return mergeTheme(DEFAULT_THEME, override);
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
    "--font-family-title": theme.fontFamily.title,
    "--font-family-subtitle": theme.fontFamily.subtitle,
    "--font-family-axis-label": theme.fontFamily.axisLabel,
    "--font-family-bar-label": theme.fontFamily.barLabel,
    "--font-family-bar-value": theme.fontFamily.barValue,
    "--font-family-counter-date": theme.fontFamily.counterDate,
    "--font-family-counter-total": theme.fontFamily.counterTotal,
    "--font-family-tick-label": theme.fontFamily.tickLabel,
    "--font-family-source": theme.fontFamily.source,
    "--bg": theme.colors.background,
    "--fg": theme.colors.foreground,
    "--muted": theme.colors.muted,
    "--bar-fill": theme.colors.barFill,
    "--grid-line": theme.colors.gridLine,
    "--accent": theme.colors.accent,
    "--font-size-title": `${theme.fontSize.title}px`,
    "--font-size-subtitle": `${theme.fontSize.subtitle}px`,
    "--font-size-axis-label": `${theme.fontSize.axisLabel}px`,
    "--font-size-bar-label": `${theme.fontSize.barLabel}px`,
    "--font-size-bar-value": `${theme.fontSize.barValue}px`,
    "--font-size-counter-date": `${theme.fontSize.counterDate}px`,
    "--font-size-counter-total": `${theme.fontSize.counterTotal}px`,
    "--font-size-tick-label": `${theme.fontSize.tickLabel}px`,
    "--font-size-source": `${theme.fontSize.source}px`,
    "--font-weight-title": theme.fontWeight.title,
    "--font-weight-subtitle": theme.fontWeight.subtitle,
    "--font-weight-bar-label": theme.fontWeight.barLabel,
    "--font-weight-bar-value": theme.fontWeight.barValue,
    "--font-weight-counter-date": theme.fontWeight.counterDate,
    "--font-weight-counter-total": theme.fontWeight.counterTotal,
  };

  const body = Object.entries(vars)
    .map(([name, value]) => `  ${name}: ${value};`)
    .join("\n");

  return `:root {\n${body}\n}`;
}
