import { spawn } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
import puppeteer from "puppeteer";

/**
 * Renders every frame of the given standalone chart HTML with a headless
 * browser and encodes the frames into an .mp4 (or .gif) using a locally
 * bundled ffmpeg binary — no system ffmpeg install and no external
 * service required.
 */
export async function exportVideo({ htmlPath, outputPath, width, height, fps, format }) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width, height });
    await page.evaluateOnNewDocument(() => {
      window.__NO_AUTOPLAY__ = true;
    });
    await page.goto(`file://${htmlPath}`, { waitUntil: "load" });
    // Embedded @font-face fonts load asynchronously; without this, early
    // frames could be captured with the fallback font instead.
    await page.evaluate(() => document.fonts.ready);

    const totalFrames = await page.evaluate(() => window.totalFrames);

    if (format === "gif") {
      await encodeGif({ page, totalFrames, outputPath, width, height, fps });
    } else {
      await encodeVideo({ page, totalFrames, outputPath, width, height, fps });
    }
  } finally {
    await browser.close();
  }
}

async function encodeVideo({ page, totalFrames, outputPath, width, height, fps }) {
  const ffmpeg = spawn(ffmpegPath, [
    "-y",
    "-f", "image2pipe",
    "-framerate", String(fps),
    "-i", "-",
    "-vf", `scale=${width}:${height}`,
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    outputPath,
  ]);

  await pipeFrames({ page, totalFrames, ffmpeg });
}

async function encodeGif({ page, totalFrames, outputPath, width, height, fps }) {
  const ffmpeg = spawn(ffmpegPath, [
    "-y",
    "-f", "image2pipe",
    "-framerate", String(fps),
    "-i", "-",
    "-vf",
    `scale=${width}:${height}:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`,
    outputPath,
  ]);

  await pipeFrames({ page, totalFrames, ffmpeg });
}

function pipeFrames({ page, totalFrames, ffmpeg }) {
  return new Promise((resolve, reject) => {
    let stderr = "";
    let settled = false;
    const fail = (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    };

    ffmpeg.on("error", fail);
    // If ffmpeg exits (e.g. on bad input params) before we're done writing,
    // further stdin writes raise EPIPE; swallow it so the real ffmpeg error
    // from "close" is what gets reported instead of an unhandled crash.
    ffmpeg.stdin.on("error", () => {});
    ffmpeg.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    ffmpeg.on("close", (code) => {
      if (settled) return;
      settled = true;
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}:\n${stderr}`));
    });

    (async () => {
      try {
        for (let i = 0; i < totalFrames; i++) {
          if (settled) return;
          await page.evaluate((frameIndex) => window.renderFrame(frameIndex), i);
          const buffer = await page.screenshot({ type: "png" });
          if (settled) return;
          const ok = ffmpeg.stdin.write(buffer);
          if (!ok) await new Promise((r) => ffmpeg.stdin.once("drain", r));
        }
        if (!settled) ffmpeg.stdin.end();
      } catch (err) {
        fail(err);
      }
    })();
  });
}
