(function () {
  const { frames, keyframeIndices, config, theme } = window.__CHART_DATA__;
  const { dateLabels, fps, title, subtitle, sourceText, sourceUrl, dateFormat } = config;

  function formatDateLabel(label) {
    if (dateFormat === "YYYY") {
      const m = /^(\d{4})/.exec(label);
      return m ? m[1] : label;
    }
    return label;
  }

  document.getElementById("title").textContent = title || "";
  document.getElementById("subtitle").textContent = subtitle || "";

  const sourceEl = document.getElementById("source");
  if (sourceText) {
    if (sourceUrl) {
      const a = document.createElement("a");
      a.href = sourceUrl;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = sourceText;
      sourceEl.appendChild(a);
    } else {
      sourceEl.textContent = sourceText;
    }
  } else {
    sourceEl.remove();
  }

  const totalFrames = frames.length;
  window.totalFrames = totalFrames;

  const plotArea = document.getElementById("plot-area");
  const svg = d3.select("#chart-svg");
  const scrubberWrap = document.getElementById("scrubber-wrap");
  const scrubberSvg = d3.select("#scrubber-svg");
  const input = document.getElementById("scrubber-input");
  const dateEl = document.getElementById("counter-date");
  const totalEl = document.querySelector("#counter-total .value");
  const playButton = document.getElementById("play-toggle");

  const formatValue = d3.format(",.0f");
  const x = d3.scaleLinear();

  const margin = { top: 36, right: 24, bottom: 0, left: 150 };
  let plotWidth, plotHeight, rowHeight, barHeight;
  let gridG, axisG, barsG;
  let scrub;

  input.max = String(totalFrames - 1);

  function measureMaxNameWidth() {
    const ctx = document.createElement("canvas").getContext("2d");
    ctx.font = `${theme.fontWeight.barLabel} ${theme.fontSize.barLabel}px ${theme.fontFamily.barLabel}`;
    let max = 0;
    for (const frame of frames) {
      for (const bar of frame.bars) {
        const w = ctx.measureText(bar.name).width;
        if (w > max) max = w;
      }
    }
    return max;
  }

  function setupPlot() {
    const rect = plotArea.getBoundingClientRect();
    margin.left = Math.min(260, Math.max(90, Math.round(measureMaxNameWidth()) + 24));
    plotWidth = Math.max(10, rect.width - margin.left - margin.right);
    plotHeight = Math.max(10, rect.height - margin.top - margin.bottom);

    svg.attr("width", rect.width).attr("height", rect.height);
    svg.selectAll("*").remove();

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);
    gridG = g.append("g").attr("class", "grid");
    axisG = g.append("g").attr("class", "axis");
    barsG = g.append("g").attr("class", "bars");

    const topN = Math.max(...frames.map((f) => f.bars.length));
    rowHeight = plotHeight / topN;
    barHeight = rowHeight * 0.62;

    x.range([0, plotWidth]);
  }

  function setupScrubber() {
    const rect = scrubberWrap.getBoundingClientRect();
    scrubberSvg.attr("width", rect.width).attr("height", rect.height);
    scrubberSvg.selectAll("*").remove();

    const trackY = 14;
    const edgePad = 28;
    const xScrub = d3
      .scaleLinear()
      .domain([0, totalFrames - 1])
      .range([edgePad, rect.width - edgePad]);

    scrubberSvg
      .append("line")
      .attr("class", "scrub-track")
      .attr("x1", 0)
      .attr("x2", rect.width)
      .attr("y1", trackY)
      .attr("y2", trackY);

    let ticks = keyframeIndices.map((frameIdx, j) => ({
      frameIdx,
      label: formatDateLabel(dateLabels[j]),
    }));

    // Collapsing to "YYYY" naturally produces duplicate labels (one per
    // original data point within the same year) — keep only the first.
    if (dateFormat === "YYYY") {
      const seen = new Set();
      ticks = ticks.filter((t) => {
        if (seen.has(t.label)) return false;
        seen.add(t.label);
        return true;
      });
    }

    // However many ticks remain, thin them further so labels never overlap
    // at the current track width.
    const minGapPx = dateFormat === "YYYY" ? 40 : 70;
    if (ticks.length > 1) {
      const avgGap = (rect.width - 2 * edgePad) / (ticks.length - 1);
      const stride = Math.max(1, Math.ceil(minGapPx / avgGap));
      if (stride > 1) ticks = ticks.filter((_, i) => i % stride === 0);
    }

    scrubberSvg
      .selectAll("line.tick-line")
      .data(ticks)
      .enter()
      .append("line")
      .attr("class", "tick-line")
      .attr("x1", (d) => xScrub(d.frameIdx))
      .attr("x2", (d) => xScrub(d.frameIdx))
      .attr("y1", trackY - 5)
      .attr("y2", trackY + 5);

    scrubberSvg
      .selectAll("text.tick-label")
      .data(ticks)
      .enter()
      .append("text")
      .attr("class", "tick-label")
      .attr("x", (d) => xScrub(d.frameIdx))
      .attr("y", trackY + 22)
      .text((d) => d.label);

    const handle = scrubberSvg
      .append("path")
      .attr("class", "scrub-handle")
      .attr("d", "M -6,-9 L 6,-9 L 0,1 Z");

    scrub = { xScrub, handle, trackY };
  }

  function renderAxis() {
    const ticks = x.ticks(5).filter((t) => t >= 0);

    const gridSel = gridG.selectAll("line.grid-line").data(ticks, (d) => d);
    gridSel.exit().remove();
    gridSel
      .enter()
      .append("line")
      .attr("class", "grid-line")
      .merge(gridSel)
      .attr("x1", (d) => x(d))
      .attr("x2", (d) => x(d))
      .attr("y1", 0)
      .attr("y2", plotHeight);

    const labelSel = axisG.selectAll("text.axis-label").data(ticks, (d) => d);
    labelSel.exit().remove();
    labelSel
      .enter()
      .append("text")
      .attr("class", "axis-label")
      .merge(labelSel)
      .attr("text-anchor", "middle")
      .attr("x", (d) => x(d))
      .attr("y", -14)
      .text((d) => d3.format(",")(d));
  }

  function renderBars(frame) {
    const groups = barsG.selectAll("g.bar-group").data(frame.bars, (d) => d.name);

    const entering = groups.enter().append("g").attr("class", "bar-group");
    entering.append("rect").attr("class", "bar-rect").attr("rx", 3);
    entering.append("text").attr("class", "bar-name");
    entering.append("text").attr("class", "bar-value");

    const merged = entering.merge(groups);

    merged.attr(
      "transform",
      (d) => `translate(0, ${d.rank * rowHeight + (rowHeight - barHeight) / 2})`
    );

    merged
      .select("rect.bar-rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("height", barHeight)
      .attr("width", (d) => Math.max(0, x(d.value)));

    merged
      .select("text.bar-name")
      .attr("x", -10)
      .attr("y", barHeight / 2 + 5)
      .text((d) => d.name);

    merged
      .select("text.bar-value")
      .attr("x", (d) => x(d.value) + 10)
      .attr("y", barHeight / 2 + 5)
      .text((d) => formatValue(d.value));

    groups.exit().remove();
  }

  function renderCounter(frame) {
    dateEl.textContent = frame.label;
    totalEl.textContent = formatValue(frame.total);
  }

  function renderScrubberHandle(i) {
    const cx = scrub.xScrub(i);
    scrub.handle.attr("transform", `translate(${cx}, ${scrub.trackY})`);
  }

  let currentFrame = 0;

  window.renderFrame = function renderFrame(i) {
    i = Math.max(0, Math.min(i, totalFrames - 1));
    currentFrame = i;
    const frame = frames[i];
    const maxValue = d3.max(frame.bars, (d) => d.value) || 1;
    x.domain([0, maxValue * 1.1]);
    renderAxis();
    renderBars(frame);
    renderCounter(frame);
    renderScrubberHandle(i);
    input.value = String(i);
  };

  setupPlot();
  setupScrubber();
  renderFrame(0);

  window.addEventListener("resize", () => {
    setupPlot();
    setupScrubber();
    renderFrame(currentFrame);
  });

  // Playback controls. The video exporter sets __NO_AUTOPLAY__ and drives
  // renderFrame(i) itself for deterministic, screenshot-safe steps; in a
  // standalone browser the race plays itself and these controls work.
  let playing = false;
  let timer = null;

  function showPauseIcon() {
    playButton.innerHTML = "&#10074;&#10074;";
  }
  function showPlayIcon() {
    playButton.innerHTML = "&#9654;";
  }

  function scheduleNext() {
    timer = setTimeout(() => {
      let next = currentFrame + 1;
      if (next >= totalFrames) next = 0;
      renderFrame(next);
      if (playing) scheduleNext();
    }, 1000 / (fps || 30));
  }

  function play() {
    if (playing) return;
    playing = true;
    showPauseIcon();
    scheduleNext();
  }

  function pause() {
    playing = false;
    showPlayIcon();
    if (timer) clearTimeout(timer);
  }

  playButton.addEventListener("click", () => (playing ? pause() : play()));

  input.addEventListener("input", () => {
    pause();
    renderFrame(Number(input.value));
  });

  if (window.__NO_AUTOPLAY__) {
    // The video/GIF exporter drives renderFrame(i) itself; show the
    // "playing" icon since that's what the recording represents.
    showPauseIcon();
  } else {
    play();
  }
})();
