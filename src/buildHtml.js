import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { themeToCssVars } from "./theme.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const templateDir = join(__dirname, "template");

function resolveD3Source() {
  // Resolve against this package's own node_modules so the output HTML
  // never depends on a CDN or any other third-party service at runtime.
  // d3's package.json "exports" map doesn't expose ./dist/d3.min.js, so
  // resolve its main entry and use the minified file next to it instead.
  const d3MainPath = fileURLToPath(import.meta.resolve("d3"));
  const d3Path = join(dirname(d3MainPath), "d3.min.js");
  return readFileSync(d3Path, "utf8");
}

/**
 * Builds a single self-contained HTML string: D3 and the chart script are
 * inlined, and the frame data is embedded as JSON. The result has no
 * external references and works fully offline.
 */
export function buildChartHtml({ frames, keyframeIndices, config, theme }) {
  const html = readFileSync(join(templateDir, "chart.html"), "utf8");
  const style = readFileSync(join(templateDir, "chart.css"), "utf8");
  const chartScript = readFileSync(join(templateDir, "chart.js"), "utf8");
  const d3Source = resolveD3Source();
  const themeVars = themeToCssVars(theme);

  const dataJson = JSON.stringify({ frames, keyframeIndices, config, theme });

  return html
    .replace("{{TITLE}}", () => escapeHtml(config.title || "Bar Chart Race"))
    .replace("{{THEME_VARS}}", () => themeVars)
    .replace("{{STYLE}}", () => style)
    .replace("{{D3_SOURCE}}", () => escapeScriptClose(d3Source))
    .replace("{{DATA_JSON}}", () => escapeScriptClose(dataJson))
    .replace("{{CHART_SCRIPT}}", () => escapeScriptClose(chartScript));
}

// Prevents an embedded "</script>" substring from prematurely closing the
// surrounding inline <script> tag.
function escapeScriptClose(str) {
  return str.replace(/<\/script/gi, "<\\/script");
}

function escapeHtml(str) {
  return str.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}
