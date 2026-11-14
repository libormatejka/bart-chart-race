#!/usr/bin/env node
import { writeFileSync, mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Command } from "commander";
import { loadWideCsv } from "../src/data.js";
import { buildFrames } from "../src/frames.js";
import { buildChartHtml } from "../src/buildHtml.js";
import { exportVideo } from "../src/exportVideo.js";
import { loadTheme } from "../src/theme.js";

const program = new Command();

program
  .name("bar-chart-race")
  .description(
    "Generate a bar chart race from a wide-format CSV as standalone HTML and/or video/GIF."
  )
  .argument(
    "[input.csv]",
    "wide CSV: local path or http(s) URL (can also be set as \"csv\" in --config)"
  )
  .option(
    "-c, --config <path.json>",
    "JSON file with run settings (csv, title, subtitle, theme, ...) so you don't have to repeat flags every time"
  )
  .option("-o, --output <path>", "output file base name (no extension)", "chart-race")
  .option("-f, --format <type>", "html | video | gif | both", "both")
  .option("-n, --top-n <n>", "number of bars shown at once", "12")
  .option("-t, --title <text>", "chart title", "")
  .option("-s, --subtitle <text>", "chart subtitle", "")
  .option("--source-text <text>", "footer attribution text, e.g. \"Source: example.com\"", "")
  .option("--source-url <url>", "optional link for the footer attribution text")
  .option("--fps <n>", "frames per second for video/animation", "30")
  .option("--duration <seconds>", "transition time between data points, in seconds", "0.5")
  .option("--width <px>", "chart/video width in pixels", "1600")
  .option("--height <px>", "chart/video height in pixels", "900")
  .option(
    "--date-format <format>",
    "how to show dates on the timeline: YYYY or YYYY-MM",
    "YYYY-MM"
  )
  .option(
    "--theme <path.json>",
    "JSON file overriding font/colors/sizes (see theme.sample.json)"
  )
  .action(async (inputArg, opts) => {
    try {
      await run(inputArg, opts);
    } catch (err) {
      console.error(`Error: ${err.message}`);
      process.exitCode = 1;
    }
  });

program.parse();

async function run(inputArg, opts) {
  const runConfig = opts.config
    ? JSON.parse(readFileSync(resolve(opts.config), "utf8"))
    : {};

  // A config file sets the baseline; an explicitly passed CLI flag (not
  // just its default value) always wins over the config file.
  function pick(name, configKey = name) {
    const fromCli = program.getOptionValueSource(name) === "cli";
    if (fromCli) return opts[name];
    if (runConfig[configKey] !== undefined) return runConfig[configKey];
    return opts[name];
  }

  const csvSource = inputArg || runConfig.csv;
  if (!csvSource) {
    throw new Error(
      'No CSV input given. Pass it as an argument, or set "csv" (a path or URL) in --config.'
    );
  }

  const format = pick("format");
  if (!["html", "video", "gif", "both"].includes(format)) {
    throw new Error(`Invalid --format "${format}". Use html, video, gif, or both.`);
  }

  const dateFormat = pick("dateFormat");
  if (!["YYYY", "YYYY-MM"].includes(dateFormat)) {
    throw new Error(`Invalid --date-format "${dateFormat}". Use YYYY or YYYY-MM.`);
  }

  const topN = Number(pick("topN"));
  const fps = Number(pick("fps"));
  const duration = Number(pick("duration"));
  // libx264 requires even dimensions; round down so HTML and video match.
  const width = Math.floor(Number(pick("width")) / 2) * 2;
  const height = Math.floor(Number(pick("height")) / 2) * 2;
  const output = pick("output");
  const themePath = pick("theme");

  const isUrl = /^https?:\/\//i.test(csvSource);
  const parsed = await loadWideCsv(isUrl ? csvSource : resolve(csvSource));
  const { frames, keyframeIndices } = buildFrames(parsed, { topN, fps, duration });
  const config = {
    width,
    height,
    title: pick("title"),
    subtitle: pick("subtitle"),
    sourceText: pick("sourceText"),
    sourceUrl: pick("sourceUrl"),
    dateLabels: parsed.dateLabels,
    dateFormat,
    fps,
  };

  const theme = loadTheme(themePath ? resolve(themePath) : undefined);

  const html = buildChartHtml({ frames, keyframeIndices, config, theme });

  const outputBase = resolve(output);
  const htmlPath = `${outputBase}.html`;

  const needsHtmlFile = format === "html" || format === "both";
  const needsVideoOrGif = format === "video" || format === "gif" || format === "both";

  if (needsHtmlFile) {
    writeFileSync(htmlPath, html, "utf8");
    console.log(`Wrote ${htmlPath}`);
  }

  if (needsVideoOrGif) {
    // The video exporter needs the HTML on disk even if --format wasn't
    // "html"/"both"; use a throwaway temp file in that case.
    const tempDir = needsHtmlFile ? null : mkdtempSync(join(tmpdir(), "bar-chart-race-"));
    const sourceHtmlPath = needsHtmlFile ? htmlPath : join(tempDir, "chart.html");
    if (!needsHtmlFile) writeFileSync(sourceHtmlPath, html, "utf8");

    try {
      if (format === "both" || format === "video") {
        const videoPath = `${outputBase}.mp4`;
        await exportVideo({
          htmlPath: sourceHtmlPath,
          outputPath: videoPath,
          width,
          height,
          fps,
          format: "video",
        });
        console.log(`Wrote ${videoPath}`);
      }
      if (format === "gif") {
        const gifPath = `${outputBase}.gif`;
        await exportVideo({
          htmlPath: sourceHtmlPath,
          outputPath: gifPath,
          width,
          height,
          fps,
          format: "gif",
        });
        console.log(`Wrote ${gifPath}`);
      }
    } finally {
      if (tempDir) rmSync(tempDir, { recursive: true, force: true });
    }
  }
}
