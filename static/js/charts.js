/* CHARTS & CANVAS VISUALIZATIONS */

function vjTheme() {
  var key = document.documentElement.getAttribute('data-theme') || 'dark';
  if (window._vjThemeCache && window._vjThemeCacheKey === key) return window._vjThemeCache;
  var s = getComputedStyle(document.documentElement);
  var t = {
    grid: s.getPropertyValue('--chart-grid').trim(),
    axis: s.getPropertyValue('--chart-axis').trim(),
    label: s.getPropertyValue('--chart-label').trim(),
    labelMid: s.getPropertyValue('--chart-label-mid').trim(),
    labelStrong: s.getPropertyValue('--chart-label-strong').trim(),
    heading: s.getPropertyValue('--white').trim(),
    acc: s.getPropertyValue('--acc').trim(),
    grn: s.getPropertyValue('--grn').trim(),
    org: s.getPropertyValue('--org').trim(),
    pur: s.getPropertyValue('--pur').trim()
  };
  window._vjThemeCache = t;
  window._vjThemeCacheKey = key;
  return t;
}

var CHART_FONT = '9px JetBrains Mono, monospace';
var CHART_FONT_SM = '7px JetBrains Mono, monospace';
var CHART_PAD = { top: 18, right: 12, bottom: 26, left: 38 };
var CLIMATE_CHART_HEIGHT = 200;

function chartPlotArea(W, H, pad) {
  pad = pad || CHART_PAD;
  return {
    pad: pad,
    left: pad.left,
    top: pad.top,
    width: W - pad.left - pad.right,
    height: H - pad.top - pad.bottom,
    bottom: H - pad.bottom,
    right: W - pad.right
  };
}

function niceTicks(min, max, count) {
  var span = max - min || 1;
  var step = Math.pow(10, Math.floor(Math.log10(span / count)));
  var err = span / step / count;
  if (err >= 7.5) step *= 10;
  else if (err >= 3.5) step *= 5;
  else if (err >= 1.5) step *= 2;
  var lo = Math.floor(min / step) * step;
  var hi = Math.ceil(max / step) * step;
  var ticks = [];
  for (var v = lo; v <= hi + step * 0.001; v += step) ticks.push(+v.toFixed(2));
  return { ticks: ticks, min: lo, max: hi };
}

function drawGrid(ctx, area, yTicks, xTickCount) {
  ctx.strokeStyle = vjTheme().grid;
  ctx.lineWidth = 0.5;
  yTicks.forEach(function () {
    /* grid drawn with y mapping in caller */
  });
  for (var i = 0; i <= xTickCount; i++) {
    var x = area.left + (i / xTickCount) * area.width;
    ctx.beginPath();
    ctx.moveTo(x, area.top);
    ctx.lineTo(x, area.bottom);
    ctx.stroke();
  }
}

function drawYAxis(ctx, area, yMin, yMax, ticks, label, labelColor) {
  var th = vjTheme();
  ctx.strokeStyle = th.axis;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(area.left, area.top);
  ctx.lineTo(area.left, area.bottom);
  ctx.stroke();

  ctx.fillStyle = labelColor || th.labelMid;
  ctx.font = CHART_FONT_SM;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ticks.forEach(function (v) {
    var y = area.bottom - ((v - yMin) / (yMax - yMin)) * area.height;
    ctx.strokeStyle = th.grid;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(area.left, y);
    ctx.lineTo(area.left + area.width, y);
    ctx.stroke();
    ctx.fillStyle = th.label;
    ctx.fillText(String(Math.round(v * 10) / 10), area.left - 4, y);
  });

  ctx.save();
  ctx.translate(10, area.top + area.height / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.fillStyle = th.labelStrong;
  ctx.font = CHART_FONT_SM;
  ctx.fillText(label, 0, 0);
  ctx.restore();
}

function drawXAxis(ctx, area, tickIndices, tickLabels, N, xLabel) {
  var th = vjTheme();
  ctx.strokeStyle = th.axis;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(area.left, area.bottom);
  ctx.lineTo(area.left + area.width, area.bottom);
  ctx.stroke();

  ctx.fillStyle = th.label;
  ctx.font = CHART_FONT_SM;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  tickIndices.forEach(function (dataIdx, j) {
    var x = area.left + (dataIdx / (N - 1)) * area.width;
    ctx.fillText(tickLabels[j], x, area.bottom + 4);
  });

  ctx.textAlign = 'center';
  ctx.fillStyle = th.labelStrong;
  ctx.textBaseline = 'top';
  ctx.fillText(xLabel, area.left + area.width / 2, area.bottom + 14);
}

function drawSeriesLine(ctx, area, data, yMin, yMax, color, fill, closed) {
  var N = data.length;
  function tx(i) { return area.left + (i / (N - 1)) * area.width; }
  function ty(v) { return area.bottom - ((v - yMin) / (yMax - yMin)) * area.height; }

  ctx.beginPath();
  data.forEach(function (v, i) {
    i === 0 ? ctx.moveTo(tx(i), ty(v)) : ctx.lineTo(tx(i), ty(v));
  });
  if (closed) {
    ctx.lineTo(tx(N - 1), area.bottom);
    ctx.lineTo(tx(0), area.bottom);
    ctx.closePath();
    if (fill) {
      var gr = ctx.createLinearGradient(0, area.top, 0, area.bottom);
      gr.addColorStop(0, fill);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gr;
      ctx.fill();
    }
    ctx.beginPath();
    data.forEach(function (v, i) {
      i === 0 ? ctx.moveTo(tx(i), ty(v)) : ctx.lineTo(tx(i), ty(v));
    });
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.8;
  ctx.stroke();
}

function drawDualClimateChart(canvas, T, H2, P2, labels) {
  if (!canvas) return;
  var wrap = canvas.parentElement;
  var W = (wrap && wrap.clientWidth) ? wrap.clientWidth : (canvas.parentElement.offsetWidth || 400);
  if (W < 10) {
    requestAnimationFrame(function () { drawDualClimateChart(canvas, T, H2, P2, labels); });
    return;
  }
  var H = CLIMATE_CHART_HEIGHT;
  canvas.width = W;
  canvas.height = H;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  var ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  var areaL = chartPlotArea(W, H, { top: 12, right: 48, bottom: 36, left: 40 });

  var tScale = niceTicks(Math.min.apply(null, T), Math.max.apply(null, T), 4);
  var hScale = niceTicks(Math.min.apply(null, H2), Math.max.apply(null, H2), 4);

  drawYAxis(ctx, areaL, tScale.min, tScale.max, tScale.ticks, 'Temp (°C)');

  var th = vjTheme();
  /* Right Y — humidity */
  ctx.strokeStyle = th.grn;
  ctx.globalAlpha = 0.45;
  ctx.beginPath();
  ctx.moveTo(areaL.right, areaL.top);
  ctx.lineTo(areaL.right, areaL.bottom);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = th.grn;
  ctx.globalAlpha = 0.75;
  ctx.font = CHART_FONT_SM;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  hScale.ticks.forEach(function (v) {
    var y = areaL.bottom - ((v - hScale.min) / (hScale.max - hScale.min)) * areaL.height;
    ctx.fillText(String(Math.round(v)), areaL.right + 4, y);
  });
  ctx.save();
  ctx.translate(W - 8, areaL.top + areaL.height / 2);
  ctx.rotate(Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.globalAlpha = 1;
  ctx.fillStyle = th.grn;
  ctx.fillText('Humidity (%)', 0, 0);
  ctx.restore();

  /* Pressure uses left axis scale offset — plot P2+990 as hPa on left secondary ticks in legend only; draw on temp axis normalized */
  var pDisplay = P2.map(function (p) { return p + 1000; });
  var pScale = niceTicks(Math.min.apply(null, pDisplay), Math.max.apply(null, pDisplay), 3);

  function txL(i) { return areaL.left + (i / (T.length - 1)) * areaL.width; }
  function tyT(v) { return areaL.bottom - ((v - tScale.min) / (tScale.max - tScale.min)) * areaL.height; }
  function tyH(v) { return areaL.bottom - ((v - hScale.min) / (hScale.max - hScale.min)) * areaL.height; }
  function tyP(v) { return areaL.bottom - ((v - pScale.min) / (pScale.max - pScale.min)) * areaL.height; }

  /* Temp line */
  ctx.beginPath();
  T.forEach(function (v, i) { i === 0 ? ctx.moveTo(txL(i), tyT(v)) : ctx.lineTo(txL(i), tyT(v)); });
  ctx.strokeStyle = th.org; ctx.lineWidth = 2; ctx.stroke();

  /* Humidity line */
  ctx.beginPath();
  H2.forEach(function (v, i) { i === 0 ? ctx.moveTo(txL(i), tyH(v)) : ctx.lineTo(txL(i), tyH(v)); });
  ctx.strokeStyle = th.grn; ctx.lineWidth = 1.8; ctx.stroke();

  /* Pressure hPa */
  ctx.beginPath();
  pDisplay.forEach(function (v, i) { i === 0 ? ctx.moveTo(txL(i), tyP(v)) : ctx.lineTo(txL(i), tyP(v)); });
  ctx.strokeStyle = th.pur; ctx.lineWidth = 1.8; ctx.setLineDash([5, 3]); ctx.stroke(); ctx.setLineDash([]);

  drawXAxis(ctx, areaL, [0, 6, 12, 18, 23], ['23:00', '18:00', '12:00', '06:00', 'Now'], T.length, 'Time (UTC, last 24h)');
}

function drawTempSparkline() {
  var c = el('tempSparkline');
  if (!c || tempHistory.length < 2) return;
  c.height = 48;
  c.width = c.parentElement.offsetWidth;
  var ctx = c.getContext('2d');
  var W = c.width, H = c.height;
  var area = chartPlotArea(W, H, { top: 6, right: 8, bottom: 16, left: 30 });
  ctx.clearRect(0, 0, W, H);

  var mn = Math.min.apply(null, tempHistory);
  var mx = Math.max.apply(null, tempHistory);
  var sc = niceTicks(mn, mx, 3);

  drawYAxis(ctx, area, sc.min, sc.max, sc.ticks, '°C');
  drawXAxis(ctx, area, [0, Math.floor(tempHistory.length / 2), tempHistory.length - 1], ['−24h', '−12h', 'Now'], tempHistory.length, 'Time');

  var th = vjTheme();
  var grad = ctx.createLinearGradient(0, area.top, 0, area.bottom);
  grad.addColorStop(0, th.org + '73');
  grad.addColorStop(1, th.org + '00');
  ctx.beginPath();
  tempHistory.forEach(function (v, i) {
    var x = area.left + (i / (tempHistory.length - 1)) * area.width;
    var y = area.bottom - ((v - sc.min) / (sc.max - sc.min)) * area.height;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.lineTo(area.left + area.width, area.bottom);
  ctx.lineTo(area.left, area.bottom);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.beginPath();
  tempHistory.forEach(function (v, i) {
    var x = area.left + (i / (tempHistory.length - 1)) * area.width;
    var y = area.bottom - ((v - sc.min) / (sc.max - sc.min)) * area.height;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.strokeStyle = th.org;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

window.redrawVjCharts = function () {
  window._vjThemeCache = null;
  drawTempSparkline();
  if (window._climChartState) {
    var st = window._climChartState;
    drawDualClimateChart(st.canvas, st.T, st.H2, st.P2, st.labels);
  }
  if (window._dashChartState && dashChartReady) {
    var st2 = window._dashChartState;
    drawDualClimateChart(st2.canvas, st2.T, st2.H2, st2.P2, st2.labels);
  }
};
drawTempSparkline();

async function loadClimateHistory() {
  var c = el('climChart');
  if (!c) return;
  var labels = [], T = [], H2 = [], P2 = [];
  if (typeof useApi !== 'undefined' && useApi) {
    try {
      var res = typeof apiFetch === 'function'
        ? await apiFetch('/api/telemetry/history')
        : await fetch('/api/telemetry/history', { credentials: 'same-origin' });
      if (res && res.ok) {
        var data = await res.json();
        labels = data.labels || [];
        T = data.temp || [];
        H2 = data.hum || [];
        P2 = data.pressure || [];
      }
    } catch (e) { /* fallback below */ }
  }
  if (!T.length) {
    for (var i = 0; i < 24; i++) {
      labels.push(String(i).padStart(2, '0') + ':00');
      T.push(28);
      H2.push(70);
      P2.push(8);
    }
  }
  window._climChartState = { canvas: c, T: T, H2: H2, P2: P2, labels: labels };
  drawDualClimateChart(c, T, H2, P2, labels);
  window.addEventListener('resize', function () {
    if (window._climChartState) {
      var st = window._climChartState;
      drawDualClimateChart(st.canvas, st.T, st.H2, st.P2, st.labels);
    }
  });
}
loadClimateHistory();

window.loadDashClimateHistory = async function () {
  var c = el('dashChart');
  if (!c || dashChartReady) return;
  dashChartReady = true;
  var labels = [], T2 = [], H3 = [], P3 = [];
  if (typeof useApi !== 'undefined' && useApi) {
    try {
      var res = typeof apiFetch === 'function'
        ? await apiFetch('/api/telemetry/history')
        : await fetch('/api/telemetry/history', { credentials: 'same-origin' });
      if (res && res.ok) {
        var data = await res.json();
        labels = data.labels || [];
        T2 = data.temp || [];
        H3 = data.hum || [];
        P3 = data.pressure || [];
      }
    } catch (e) { /* ignore */ }
  }
  if (!T2.length) {
    for (var i = 0; i < 24; i++) {
      labels.push(String(i).padStart(2, '0') + ':00');
      T2.push(28); H3.push(70); P3.push(8);
    }
  }
  window._dashChartState = { canvas: c, T: T2, H2: H3, P2: P3, labels: labels };
  drawDualClimateChart(c, T2, H3, P3, labels);
  if (!window._dashChartResize) {
    window._dashChartResize = true;
    window.addEventListener('resize', function () {
      if (window._dashChartState) {
        var st = window._dashChartState;
        drawDualClimateChart(st.canvas, st.T, st.H2, st.P2, st.labels);
      }
    });
  }
  initIndiaMap();
};

(function () {
  var c = el('sigCanvas');
  if (!c) return;
  var W = 300, H = 120;
  c.width = W;
  c.height = H;
  var ctx = c.getContext('2d');
  var history2 = [];
  for (var i = 0; i < 60; i++) history2.push(20);
  var area = chartPlotArea(W, H, { top: 10, right: 8, bottom: 22, left: 32 });
  var signalTarget = 20;

  window.setSignalTarget = function (elDeg) {
    if (elDeg == null || isNaN(elDeg)) return;
    signalTarget = Math.max(5, Math.min(95, elDeg * 3.2));
  };

  function draw() {
    if (activeTab !== 2) {
      requestAnimationFrame(draw);
      return;
    }
    ctx.clearRect(0, 0, W, H);
    var yTicks = [0, 25, 50, 75, 100];
    drawYAxis(ctx, area, 0, 100, yTicks, 'Signal %');
    drawXAxis(ctx, area, [0, 30, 59], ['-60s', '-30s', 'Now'], 60, 'Time');

    var noise = Math.sin(Date.now() * 0.004) * 4;
    history2.push(Math.max(0, Math.min(100, signalTarget + noise + (Math.random() - 0.5) * 3)));
    if (history2.length > 60) history2.shift();

    var th = vjTheme();
    var gr = ctx.createLinearGradient(0, area.top, 0, area.bottom);
    gr.addColorStop(0, th.acc + '8c');
    gr.addColorStop(1, th.acc + '00');
    ctx.beginPath();
    history2.forEach(function (v, i) {
      var x = area.left + (i / 59) * area.width;
      var y = area.bottom - (v / 100) * area.height;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.lineTo(area.left + area.width, area.bottom);
    ctx.lineTo(area.left, area.bottom);
    ctx.closePath();
    ctx.fillStyle = gr;
    ctx.fill();
    ctx.beginPath();
    history2.forEach(function (v, i) {
      var x = area.left + (i / 59) * area.width;
      var y = area.bottom - (v / 100) * area.height;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.strokeStyle = th.acc;
    ctx.lineWidth = 1.4;
    ctx.stroke();

    requestAnimationFrame(draw);
  }
  draw();
})();

(function () {
  var c = el('polarCanvas');
  if (!c) return;
  c.width = 200;
  c.height = 200;
  var ctx = c.getContext('2d');
  var polarAz = 180;
  var polarEl = 25;
  var displayAz = 180;
  var displayEl = 25;

  window.setPolarTarget = function (az, el) {
    if (az != null && !isNaN(az)) polarAz = az;
    if (el != null && !isNaN(el)) polarEl = el;
  };

  function draw() {
    if (activeTab !== 2) {
      requestAnimationFrame(draw);
      return;
    }
    displayAz += (polarAz - displayAz) * 0.08;
    displayEl += (polarEl - displayEl) * 0.08;
    var W = 200, H = 200, cx = 100, cy = 100, R = 72;
    var th = vjTheme();
    ctx.clearRect(0, 0, W, H);

    ctx.font = CHART_FONT_SM;
    [1, 0.67, 0.33].forEach(function (f, i) {
      ctx.beginPath();
      ctx.arc(cx, cy, R * f, 0, Math.PI * 2);
      ctx.strokeStyle = th.grid;
      ctx.globalAlpha = 0.55 + i * 0.15;
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.globalAlpha = 1;
      var elDeg = Math.round(90 * f);
      ctx.fillStyle = th.label;
      ctx.fillText(elDeg + '°', cx + R * f + 2, cy - 2);
    });

    ctx.strokeStyle = th.grid;
    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();
    ctx.fillStyle = th.labelMid;
    ctx.fillText('N', cx, cy - R - 3);
    ctx.fillText('S', cx, cy + R + 8);
    ctx.fillText('W', cx - R - 4, cy + 3);
    ctx.fillText('E', cx + R + 4, cy + 3);

    var elFrac = Math.min(1, displayEl / 90);
    var azRad = displayAz * Math.PI / 180;
    var px = cx + R * elFrac * Math.sin(azRad);
    var py = cy - R * elFrac * Math.cos(azRad);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(px, py);
    ctx.strokeStyle = th.acc;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.shadowColor = th.acc;
    ctx.shadowBlur = (typeof vjIsLightTheme === 'function' && vjIsLightTheme()) ? 4 : 8;
    ctx.beginPath();
    ctx.arc(px, py, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = th.acc;
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = th.labelMid;
    ctx.font = CHART_FONT_SM;
    ctx.textAlign = 'center';
    ctx.fillText('Az ' + displayAz.toFixed(0) + '\u00b0  El ' + displayEl.toFixed(1) + '\u00b0', cx, H - 6);

    requestAnimationFrame(draw);
  }
  draw();
})();

var dashChartReady = false;
function initDashChart() {
  if (typeof window.loadDashClimateHistory === 'function') {
    window.loadDashClimateHistory();
    return;
  }
  dashChartReady = true;
  var c = el('dashChart');
  if (!c) return;
  initIndiaMap();
}

(function () {
  var c = el('gaugeCanvas');
  if (!c) return;
  c.width = 180;
  c.height = 88;
  var ctx = c.getContext('2d');
  var val = 0;
  var target = 78;

  function setGaugeTarget(h) {
    if (h != null && !isNaN(h)) target = Math.max(0, Math.min(100, h));
  }
  window.setGaugeTarget = setGaugeTarget;

  function draw() {
    if (activeTab !== 3) {
      requestAnimationFrame(draw);
      return;
    }
    val += (target - val) * 0.04;
    var cx = 90, cy = 82, R = 68;
    ctx.clearRect(0, 0, 180, 88);

    var th = vjTheme();
    ctx.beginPath();
    ctx.arc(cx, cy, R, Math.PI, 0);
    ctx.strokeStyle = th.grid;
    ctx.lineWidth = 10;
    ctx.stroke();

    var gr3 = ctx.createLinearGradient(cx - R, cy, cx + R, cy);
    gr3.addColorStop(0, th.acc);
    gr3.addColorStop(0.5, th.grn);
    gr3.addColorStop(1, th.grn);
    ctx.beginPath();
    ctx.arc(cx, cy, R, Math.PI, Math.PI + (val / 100) * Math.PI);
    ctx.strokeStyle = gr3;
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.fillStyle = th.heading;
    ctx.font = 'bold 18px Syne,sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(Math.round(val) + '%', cx, cy - 12);

    ctx.fillStyle = th.label;
    ctx.font = CHART_FONT_SM;
    ctx.fillText('0%', cx - R + 4, cy + 4);
    ctx.fillText('100%', cx + R - 12, cy + 4);

    ctx.textAlign = 'left';
    requestAnimationFrame(draw);
  }
  draw();
})();
