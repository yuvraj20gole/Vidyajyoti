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

function pickXAxisTicks(labels, count) {
  var n = labels.length;
  if (!n) return { indices: [0], tickLabels: ['Now'] };
  if (n === 1) return { indices: [0], tickLabels: ['Now'] };
  count = count || 5;
  var indices = [];
  var tickLabels = [];
  for (var i = 0; i < count; i++) {
    var idx = Math.round(i * (n - 1) / (count - 1));
    indices.push(idx);
    tickLabels.push(idx === n - 1 ? 'Now' : (labels[idx] || ''));
  }
  return { indices: indices, tickLabels: tickLabels };
}

function ensureChartTooltip() {
  if (!window._vjChartTip) {
    var tip = document.createElement('div');
    tip.id = 'vjChartTooltip';
    tip.className = 'chart-tooltip';
    tip.hidden = true;
    document.body.appendChild(tip);
    window._vjChartTip = tip;
  }
  return window._vjChartTip;
}

function attachLineChartHover(canvas, getState, tipHtml) {
  if (!canvas || canvas._vjHoverBound) return;
  canvas._vjHoverBound = true;
  var tip = ensureChartTooltip();
  canvas.addEventListener('mousemove', function (e) {
    var st = getState();
    if (!st || !st.area || !st.N || st.N < 2) {
      tip.hidden = true;
      return;
    }
    var rect = canvas.getBoundingClientRect();
    var scaleX = canvas.width / rect.width;
    var x = (e.clientX - rect.left) * scaleX;
    if (x < st.area.left || x > st.area.left + st.area.width) {
      tip.hidden = true;
      if (st.hoverIdx != null) {
        st.hoverIdx = null;
        if (st.redraw) st.redraw();
      }
      return;
    }
    var idx = Math.round(((x - st.area.left) / st.area.width) * (st.N - 1));
    idx = Math.max(0, Math.min(st.N - 1, idx));
    if (st.hoverIdx !== idx) {
      st.hoverIdx = idx;
      if (st.redraw) st.redraw();
    }
    tip.innerHTML = tipHtml(idx, st);
    tip.hidden = false;
    var left = e.clientX + 14;
    if (left + 180 > window.innerWidth) left = e.clientX - 190;
    tip.style.left = left + 'px';
    tip.style.top = (e.clientY - 12) + 'px';
  });
  canvas.addEventListener('mouseleave', function () {
    tip.hidden = true;
    var st = getState();
    if (st && st.hoverIdx != null) {
      st.hoverIdx = null;
      if (st.redraw) st.redraw();
    }
  });
}

function formatClimateTooltip(idx, st) {
  var label = st.labels && st.labels[idx] ? st.labels[idx] : '';
  if (idx === st.N - 1) label = label ? label + ' (Now)' : 'Now';
  var pres = st.P2[idx] + 1000;
  return '<b>' + label + ' IST</b><br>' +
    'Temp: ' + st.T[idx].toFixed(1) + ' \u00b0C<br>' +
    'Humidity: ' + Math.round(st.H2[idx]) + '%<br>' +
    'Pressure: ' + pres.toFixed(0) + ' hPa';
}

function formatSparklineTooltip(idx, st) {
  var label = st.labels && st.labels[idx] ? st.labels[idx] : '';
  if (idx === st.N - 1) label = label ? label + ' (Now)' : 'Now';
  return '<b>' + label + ' IST</b><br>Temp: ' + st.data[idx].toFixed(1) + ' \u00b0C';
}

function drawClimateHoverMarker(ctx, area, idx, N, yPoints, colors) {
  var x = area.left + (idx / (N - 1)) * area.width;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(x, area.top);
  ctx.lineTo(x, area.bottom);
  ctx.stroke();
  ctx.setLineDash([]);
  yPoints.forEach(function (y, i) {
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = colors[i];
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  });
  ctx.restore();
}

function chartCanvasWidth(canvas, fallback) {
  fallback = fallback || 400;
  var wrap = canvas.parentElement;
  var w = wrap ? wrap.clientWidth : 0;
  if (w < 10) w = canvas.offsetWidth || 0;
  if (w < 10 && canvas.offsetParent === null) return 0;
  return w >= 10 ? w : fallback;
}

function drawChartLoading(canvas, message) {
  if (!canvas) return;
  var W = chartCanvasWidth(canvas, 400);
  if (W < 10) return;
  canvas.width = W;
  canvas.height = CLIMATE_CHART_HEIGHT;
  var ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, CLIMATE_CHART_HEIGHT);
  ctx.fillStyle = vjTheme().labelMid;
  ctx.font = CHART_FONT;
  ctx.textAlign = 'center';
  ctx.fillText(message || 'Loading climate data…', W / 2, CLIMATE_CHART_HEIGHT / 2);
}

function drawDualClimateChart(state) {
  var canvas = state.canvas;
  var T = state.T;
  var H2 = state.H2;
  var P2 = state.P2;
  var labels = state.labels;
  if (!canvas || !T || !T.length) return;
  var W = chartCanvasWidth(canvas, 400);
  if (W < 10) {
    state._pendingDraw = true;
    return;
  }
  state._pendingDraw = false;
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

  var xTicks = pickXAxisTicks(labels, 5);
  drawXAxis(ctx, areaL, xTicks.indices, xTicks.tickLabels, T.length, 'Time (IST, last 24h)');

  state.area = areaL;
  state.N = T.length;

  if (state.hoverIdx != null && T.length > 1) {
    drawClimateHoverMarker(ctx, areaL, state.hoverIdx, T.length, [
      tyT(T[state.hoverIdx]),
      tyH(H2[state.hoverIdx]),
      tyP(pDisplay[state.hoverIdx])
    ], [th.org, th.grn, th.pur]);
  }
}

function createClimateChartState(canvas, data) {
  return {
    canvas: canvas,
    T: (data.temp || []).slice(),
    H2: (data.hum || []).slice(),
    P2: (data.pressure || []).slice(),
    labels: (data.labels || []).slice(),
    N: 0,
    area: null,
    hoverIdx: null,
    redraw: null
  };
}

function bindClimateChart(state) {
  state.redraw = function () { drawDualClimateChart(state); };
  if (!state._hoverBound) {
    state._hoverBound = true;
    attachLineChartHover(state.canvas, function () { return state; }, formatClimateTooltip);
  }
  drawDualClimateChart(state);
}

function drawTempSparkline() {
  var c = el('tempSparkline');
  var data = window._sparklineData;
  var labels = window._sparklineLabels || [];
  if (!c || !data || data.length < 2) return;
  c.height = 48;
  c.width = c.parentElement.offsetWidth || 300;
  var ctx = c.getContext('2d');
  var W = c.width, H = c.height;
  var area = chartPlotArea(W, H, { top: 6, right: 8, bottom: 16, left: 30 });
  ctx.clearRect(0, 0, W, H);

  var mn = Math.min.apply(null, data);
  var mx = Math.max.apply(null, data);
  var sc = niceTicks(mn, mx, 3);
  var xTicks = pickXAxisTicks(labels.length ? labels : data.map(function (_, i) { return String(i); }), 3);

  drawYAxis(ctx, area, sc.min, sc.max, sc.ticks, '\u00b0C');
  drawXAxis(ctx, area, xTicks.indices, xTicks.tickLabels, data.length, 'Time (IST)');

  window._sparklineState = {
    canvas: c,
    data: data,
    labels: labels,
    area: area,
    N: data.length,
    hoverIdx: window._sparklineState ? window._sparklineState.hoverIdx : null,
    sc: sc,
    redraw: null
  };
  var st = window._sparklineState;
  st.redraw = function () { drawTempSparkline(); };

  if (!c._vjHoverBound) {
    c._vjHoverBound = true;
    attachLineChartHover(c, function () { return window._sparklineState; }, formatSparklineTooltip);
  }

  var th = vjTheme();
  function ty(v) { return area.bottom - ((v - sc.min) / (sc.max - sc.min)) * area.height; }
  var grad = ctx.createLinearGradient(0, area.top, 0, area.bottom);
  grad.addColorStop(0, th.org + '73');
  grad.addColorStop(1, th.org + '00');
  ctx.beginPath();
  data.forEach(function (v, i) {
    var x = area.left + (i / (data.length - 1)) * area.width;
    i === 0 ? ctx.moveTo(x, ty(v)) : ctx.lineTo(x, ty(v));
  });
  ctx.lineTo(area.left + area.width, area.bottom);
  ctx.lineTo(area.left, area.bottom);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.beginPath();
  data.forEach(function (v, i) {
    var x = area.left + (i / (data.length - 1)) * area.width;
    i === 0 ? ctx.moveTo(x, ty(v)) : ctx.lineTo(x, ty(v));
  });
  ctx.strokeStyle = th.org;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  if (st.hoverIdx != null) {
    var hx = area.left + (st.hoverIdx / (data.length - 1)) * area.width;
    ctx.beginPath();
    ctx.arc(hx, ty(data[st.hoverIdx]), 4, 0, Math.PI * 2);
    ctx.fillStyle = th.org;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
}

async function parseOpenMeteoHistoryPayload(payload) {
  var hourly = payload.hourly || {};
  var times = hourly.time || [];
  var temps = hourly.temperature_2m || [];
  var hums = hourly.relative_humidity_2m || [];
  var pres = hourly.surface_pressure || [];
  if (!times.length || !temps.length) return null;

  var nowParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false
  }).formatToParts(new Date());
  function part(type) {
    var p = nowParts.find(function (x) { return x.type === type; });
    return p ? p.value : '00';
  }
  var curKey = part('year') + '-' + part('month') + '-' + part('day') + 'T' + part('hour') + ':00';
  var idx = times.indexOf(curKey);
  if (idx < 0) idx = times.length - 1;
  var start = Math.max(0, idx - 23);
  var sTimes = times.slice(start, idx + 1);
  var sTemps = temps.slice(start, idx + 1);
  var sHums = hums.slice(start, idx + 1);
  var sPres = pres.slice(start, idx + 1);
  var nowLabel = part('hour') + ':' + part('minute') + ' (Now)';
  var labels = sTimes.map(function (t, i) {
    if (i === sTimes.length - 1) return nowLabel;
    try { return t.split('T')[1].slice(0, 5); } catch (e) { return '--:--'; }
  });
  return {
    labels: labels,
    temp: sTemps.map(function (v) { return Math.round(v * 10) / 10; }),
    hum: sHums.map(function (v) { return Math.round(v * 10) / 10; }),
    pressure: sPres.map(function (v) { return Math.round((v - 1000) * 10) / 10; }),
    source: 'Open-Meteo',
    location: 'Mumbai',
    updated_at: new Date().toISOString(),
    window_start: sTimes[0] || null,
    window_end: sTimes[sTimes.length - 1] || null
  };
}

async function fetchOpenMeteoHistoryDirect() {
  var q = [
    'latitude=19.08',
    'longitude=72.88',
    'hourly=temperature_2m,relative_humidity_2m,surface_pressure',
    'timezone=Asia%2FKolkata',
    'past_days=1',
    'forecast_days=1'
  ].join('&');
  var res = await fetch('https://api.open-meteo.com/v1/forecast?' + q);
  if (!res.ok) return null;
  return parseOpenMeteoHistoryPayload(await res.json());
}

async function fetchTelemetryHistory() {
  if (typeof useApi !== 'undefined' && useApi) {
    try {
      var res = typeof apiFetch === 'function'
        ? await apiFetch('/api/telemetry/history')
        : await fetch('/api/telemetry/history', { credentials: 'same-origin' });
      if (res && res.ok) return await res.json();
    } catch (e) { /* try direct Open-Meteo below */ }
  }
  try {
    return await fetchOpenMeteoHistoryDirect();
  } catch (e) { /* ignore */ }
  return null;
}

function formatHistoryMeta(data) {
  if (!data) return 'Open-Meteo';
  var updated = '';
  if (data.updated_at) {
    try {
      updated = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false
      }).format(new Date(data.updated_at));
    } catch (e) { /* ignore */ }
  }
  var range = '';
  if (data.window_start && data.window_end) {
    try {
      var a = data.window_start.split('T')[1].slice(0, 5);
      var b = data.window_end.split('T')[1].slice(0, 5);
      range = ' \u00b7 ' + a + '\u2013' + b + ' IST';
    } catch (e) { /* ignore */ }
  }
  return 'Open-Meteo \u00b7 Mumbai' + range + (updated ? ' \u00b7 Updated ' + updated + ' IST' : '');
}

function updateChartMetaLabels(data) {
  var txt = formatHistoryMeta(data);
  ['climChartMeta', 'dashChartMeta'].forEach(function (id) {
    var e = el(id);
    if (e) e.textContent = txt;
  });
}

function applyHistoryToCharts(data) {
  if (!data || !data.temp || !data.temp.length) return false;
  window._telemetryHistory = data;
  window._sparklineData = data.temp.slice();
  window._sparklineLabels = (data.labels || []).slice();
  updateChartMetaLabels(data);

  var clim = el('climChart');
  if (clim) {
    window._climChartState = createClimateChartState(clim, data);
    bindClimateChart(window._climChartState);
  }

  var dash = el('dashChart');
  if (dash) {
    window._dashChartState = createClimateChartState(dash, data);
    if (dash.offsetParent !== null) bindClimateChart(window._dashChartState);
    else window._dashChartState._pendingDraw = true;
  }

  drawTempSparkline();
  if (typeof updateDashStatCards === 'function') updateDashStatCards(data);
  return true;
}

window.updateDashStatCards = function (data, live) {
  live = live || (typeof D !== 'undefined' ? D : null);
  function s(id, v) { var e = el(id); if (e) e.textContent = v; }
  if (data && data.temp && data.temp.length) {
    var sum = 0;
    for (var i = 0; i < data.temp.length; i++) sum += data.temp[i];
    s('dashTempVal', (sum / data.temp.length).toFixed(1) + '\u00b0');
  } else if (live) {
    s('dashTempVal', live.temp.toFixed(1) + '\u00b0');
  }
  if (live) {
    s('dashHumVal', Math.round(live.hum) + '%');
    s('dashPresVal', Math.round(live.pres));
    s('dashUvVal', live.uv.toFixed(1));
  }
};

window.syncSparklineLiveTemp = function (temp) {
  syncHistoryLiveReading({ temp: temp, hum: typeof D !== 'undefined' ? D.hum : null, pres: typeof D !== 'undefined' ? D.pres : null });
};

window.syncHistoryLiveReading = function (live) {
  if (!live || !window._telemetryHistory || !window._telemetryHistory.temp.length) return;
  var h = window._telemetryHistory;
  var i = h.temp.length - 1;
  if (live.temp != null) {
    h.temp[i] = live.temp;
    if (window._sparklineData && window._sparklineData.length) window._sparklineData[i] = live.temp;
  }
  if (live.hum != null) h.hum[i] = live.hum;
  if (live.pres != null) h.pressure[i] = Math.round((live.pres - 1000) * 10) / 10;

  function patchState(st) {
    if (!st) return;
    st.T = h.temp.slice();
    st.H2 = h.hum.slice();
    st.P2 = h.pressure.slice();
    st.labels = h.labels.slice();
    drawDualClimateChart(st);
  }
  patchState(window._climChartState);
  patchState(window._dashChartState);
  drawTempSparkline();
};

window.redrawVjCharts = function () {
  window._vjThemeCache = null;
  if (window._climChartState) drawDualClimateChart(window._climChartState);
  if (window._dashChartState) drawDualClimateChart(window._dashChartState);
  drawTempSparkline();
};

window.refreshVjClimateCharts = function () {
  if (window._climChartState && window._climChartState._pendingDraw) {
    drawDualClimateChart(window._climChartState);
  }
  if (window._dashChartState && window._dashChartState._pendingDraw) {
    drawDualClimateChart(window._dashChartState);
  }
  redrawVjCharts();
};

async function loadTelemetryHistoryCharts(silent) {
  var clim = el('climChart');
  var dash = el('dashChart');
  if (!silent) {
    if (clim) drawChartLoading(clim, 'Loading climate data…');
    if (dash && dash.offsetParent !== null) drawChartLoading(dash, 'Loading climate data…');
  }

  var data = await fetchTelemetryHistory();
  if (applyHistoryToCharts(data)) {
    if (typeof D !== 'undefined') syncHistoryLiveReading(D);
    return;
  }

  if (!silent) {
    if (clim) drawChartLoading(clim, 'Climate data unavailable');
    if (dash) drawChartLoading(dash, 'Climate data unavailable');
  }
  drawTempSparkline();
}

async function loadClimateHistory() {
  if (!el('climChart')) return;
  await loadTelemetryHistoryCharts();
  if (!window._climResizeBound) {
    window._climResizeBound = true;
    window.addEventListener('resize', function () {
      if (window._climChartState) drawDualClimateChart(window._climChartState);
      if (window._dashChartState) drawDualClimateChart(window._dashChartState);
      drawTempSparkline();
    });
  }
}
loadClimateHistory();

setInterval(function () {
  loadTelemetryHistoryCharts(true);
}, 10 * 60 * 1000);

var dashChartReady = false;
window.loadDashClimateHistory = async function () {
  var c = el('dashChart');
  if (!c) return;
  if (!window._telemetryHistory) {
    await loadTelemetryHistoryCharts();
  } else if (window._dashChartState && window._dashChartState._pendingDraw) {
    bindClimateChart(window._dashChartState);
  } else if (window._telemetryHistory) {
    applyHistoryToCharts(window._telemetryHistory);
  }
  initIndiaMap();
  dashChartReady = true;
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
    if (typeof window.setGaugeTarget === 'function') {
      window.setGaugeTarget(signalTarget);
    }
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

function initDashChart() {
  if (typeof window.loadDashClimateHistory === 'function') {
    window.loadDashClimateHistory();
    return;
  }
  initIndiaMap();
  dashChartReady = true;
}

(function () {
  var c = el('gaugeCanvas');
  if (!c) return;
  c.width = 180;
  c.height = 88;
  var ctx = c.getContext('2d');
  var val = 0;
  var target = 20;
  var cx = 90, cy = 82, R = 68;
  var tip = ensureChartTooltip();

  function setGaugeTarget(h) {
    if (h != null && !isNaN(h)) target = Math.max(0, Math.min(100, h));
  }
  window.setGaugeTarget = setGaugeTarget;

  function gaugeHoverActive(e) {
    var rect = c.getBoundingClientRect();
    var mx = (e.clientX - rect.left) * (c.width / rect.width);
    var my = (e.clientY - rect.top) * (c.height / rect.height);
    var dx = mx - cx;
    var dy = my - cy;
    var dist = Math.sqrt(dx * dx + dy * dy);
    return my <= cy + 6 && dist >= R * 0.4 && dist <= R * 1.08;
  }

  c.style.cursor = 'crosshair';
  c.addEventListener('mousemove', function (e) {
    if (!gaugeHoverActive(e)) {
      tip.hidden = true;
      return;
    }
    tip.innerHTML = '<b>Signal quality</b><br>' + Math.round(val) + '%';
    tip.hidden = false;
    var left = e.clientX + 14;
    if (left + 160 > window.innerWidth) left = e.clientX - 170;
    tip.style.left = left + 'px';
    tip.style.top = (e.clientY - 12) + 'px';
  });
  c.addEventListener('mouseleave', function () { tip.hidden = true; });

  function draw() {
    val += (target - val) * 0.04;
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
