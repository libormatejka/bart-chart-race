/**
 * Builds the frame-by-frame animation data from parsed wide-CSV series.
 *
 * Between every pair of known data points we insert `stepsPerSegment - 1`
 * linearly interpolated in-between frames, so the race looks continuous
 * instead of jumping from one known date to the next.
 *
 * Each frame is { label, total, bars } where bars is the top-N entries for
 * that frame, sorted descending by value, each with its rank (0-based), and
 * total is the sum across *all* series (not just the displayed top-N).
 *
 * Also returns `keyframeIndices`: for each original dateLabels[j], the
 * index into `frames` where that exact date lands — used to place ticks
 * on the scrubber and let it seek to an exact known date.
 */
export function buildFrames({ dateLabels, series }, { topN, fps, duration }) {
  const stepsPerSegment = Math.max(1, Math.round(fps * duration));
  const segmentCount = dateLabels.length - 1;

  const frames = [];
  const keyframeIndices = [];

  for (let seg = 0; seg < Math.max(segmentCount, 1); seg++) {
    const fromIdx = seg;
    const toIdx = Math.min(seg + 1, dateLabels.length - 1);
    const isLastSegment = seg === Math.max(segmentCount, 1) - 1;
    const stepCount = segmentCount === 0 ? 1 : stepsPerSegment;

    for (let step = 0; step < stepCount; step++) {
      // Skip the very last in-between step except on the final segment,
      // so the known date lands exactly on a frame instead of being
      // duplicated by the next segment's first frame.
      if (!isLastSegment && step === stepCount - 1) continue;

      if (step === 0) keyframeIndices.push(frames.length);

      const t = stepCount === 1 ? 0 : step / (stepCount - 1 || 1);
      const label = interpolateLabel(dateLabels[fromIdx], dateLabels[toIdx], t);

      const allValues = series.map(({ name, values }) => ({
        name,
        value: lerp(values[fromIdx], values[toIdx], t),
      }));

      const total = allValues.reduce((sum, d) => sum + d.value, 0);

      const bars = allValues
        .sort((a, b) => b.value - a.value)
        .slice(0, topN)
        .map((bar, rank) => ({ ...bar, rank }));

      frames.push({ label, total, bars });
    }
  }

  // The very last frame always lands exactly on the final known date.
  if (segmentCount >= 1) keyframeIndices.push(frames.length - 1);

  return { frames, keyframeIndices };
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function interpolateLabel(from, to, t) {
  const a = Number(from);
  const b = Number(to);
  if (Number.isNaN(a) || Number.isNaN(b)) return t < 0.5 ? from : to;
  return String(Math.round(lerp(a, b, t)));
}
