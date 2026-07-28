/* ====================================================
   TELEMETRY & ORBIT DATA — live APIs via Flask backend
==================================================== */
var useApi = !location.hostname.endsWith('github.io');

function redirectToLogin() {
  window.location.replace('/login');
}

function apiFetch(url) {
  return fetch(url, { credentials: 'same-origin' }).then(function (res) {
    if (res.status === 401) {
      redirectToLogin();
      return null;
    }
    return res;
  });
}

var D = { temp: 31.4, hum: 78, pres: 1008, wind: 18, uv: 7.2, aqi: 142, dew: 24.1, vis: 6.2, cloud: 68, rain: 2, age: 0 };
var wxConds = ['Partly Cloudy', 'Mostly Sunny', 'Overcast', 'Hazy', 'Humid'];
var OR = { lat: 20, lon: 78, alt: 412.6, vel: 7.662, dop: 3.12 };
var GTS = ['Bay of Bengal', 'Tamil Nadu Coast', 'Indian Ocean', 'Arabian Sea', 'Bay of Bengal'];
var gti = 0;

/** Latest ESP32 GPS snapshot for Orbit Tracker status bar. */
window.latestSensorGps = {
  connected: false,
  gps_fixed: false,
  gps_lat: null,
  gps_lon: null,
  gps_alt: null,
  gps_speed: null,
  gps_sats: null
};

function hasLiveGpsFix() {
  var g = window.latestSensorGps;
  return !!(g && g.connected && g.gps_fixed && g.gps_lat != null && g.gps_lon != null);
}

function formatGpsCoord(value, posSuffix, negSuffix) {
  if (value == null || isNaN(Number(value))) return '--';
  var n = Number(value);
  return Math.abs(n).toFixed(4) + '\u00b0' + (n >= 0 ? posSuffix : negSuffix);
}

function setGpsStatusIndicator(state) {
  var wrap = el('sb-gps-status');
  var dot = el('sb-gps-dot');
  var label = el('sb-gps-label');
  if (!wrap || !dot || !label) return;
  wrap.classList.remove('lock', 'searching', 'offline');
  if (state === 'lock') {
    wrap.classList.add('lock');
    dot.className = 'sdot g';
    label.textContent = 'GPS LOCK';
  } else if (state === 'searching') {
    wrap.classList.add('searching');
    dot.className = 'sdot w';
    label.textContent = 'GPS SEARCHING';
  } else {
    wrap.classList.add('offline');
    dot.className = 'sdot off';
    label.textContent = 'NO SENSOR';
  }
}

function syncOrbitTrackerGpsBar() {
  var g = window.latestSensorGps || {};
  var connected = !!g.connected;
  var fixed = !!(g.gps_fixed && g.gps_lat != null && g.gps_lon != null);

  if (!connected) {
    setGpsStatusIndicator('offline');
  } else if (fixed) {
    setGpsStatusIndicator('lock');
  } else {
    setGpsStatusIndicator('searching');
  }

  var simBadge = el('vjSimBadge');
  if (simBadge) {
    if (fixed) {
      simBadge.hidden = false;
      simBadge.textContent = 'Live GPS';
    } else {
      // Maps overlay may still show simulated badge for Vidyajyoti; restore default label.
      simBadge.textContent = 'Simulated telemetry';
    }
  }

  if (!fixed) return;

  function s(id, v) { var e = el(id); if (e) e.textContent = v; }
  s('sb-lat', formatGpsCoord(g.gps_lat, 'N', 'S'));
  s('sb-lon', formatGpsCoord(g.gps_lon, 'E', 'W'));
  s('sb-alt', g.gps_alt != null && !isNaN(Number(g.gps_alt))
    ? Number(g.gps_alt).toFixed(1) + ' m'
    : '--');
  s('sb-vel', g.gps_speed != null && !isNaN(Number(g.gps_speed))
    ? Number(g.gps_speed).toFixed(1) + ' km/h'
    : '--');
  s('sb-gt', g.gps_sats != null
    ? 'ESP32 GPS · ' + Math.round(Number(g.gps_sats)) + ' sats'
    : 'ESP32 GPS');
}

function applyTelemetry(data) {
  D.temp = data.temp;
  D.hum = data.hum;
  D.pres = data.pres;
  D.wind = data.wind;
  D.uv = data.uv;
  D.aqi = data.aqi;
  D.dew = data.dew;
  D.vis = data.vis;
  D.cloud = data.cloud;
  D.rain = data.rain;
  if (typeof syncHistoryLiveReading === 'function') syncHistoryLiveReading(D);

  function s(id, v) { var e = el(id); if (e) e.textContent = v; }
  function sw(id, pct) { var e = el(id); if (e) e.style.width = Math.max(2, Math.min(100, pct)) + '%'; }

  s('tempHero', D.temp.toFixed(1));
  s('feelsLike', (data.feels_like != null ? data.feels_like : (D.temp + D.hum * 0.04)).toFixed(1));
  s('wxCond', data.wx_cond || 'Partly Cloudy');
  s('humHero', Math.round(D.hum));
  sw('humBarHero', D.hum);
  s('presVal', Math.round(D.pres));
  sw('presBar', ((D.pres - 990) / 40 * 100));
  s('windVal', Math.round(D.wind));
  sw('windBar', (D.wind / 60 * 100));
  s('uvVal', D.uv.toFixed(1));
  sw('uvBar', (D.uv / 11 * 100));
  var aqiLabel = data.aqi_label || 'Mod';
  s('aqiVal', Math.round(D.aqi));
  var aqiUnit = el('aqiUnit');
  if (aqiUnit) aqiUnit.textContent = aqiLabel;
  sw('aqiBar', (D.aqi / 300 * 100));
  s('dewVal', D.dew.toFixed(1));
  s('visVal', D.vis.toFixed(1));
  s('cloudVal', Math.round(D.cloud));
  s('rainVal', Math.round(D.rain));
  D.age = 0;
  if (typeof updateDashStatCards === 'function') updateDashStatCards(window._telemetryHistory, D);
  if (typeof drawTempSparkline === 'function' && window._sparklineData) drawTempSparkline();
}

function formatGpsSpeedKmh(speed) {
  if (speed == null || isNaN(Number(speed))) return '--';
  return Number(speed).toFixed(1);
}

function formatGpsAltM(alt) {
  if (alt == null || isNaN(Number(alt))) return '--';
  return Number(alt).toFixed(1);
}

function syncEsp32GpsMetrics(g) {
  g = g || window.latestSensorGps || {};
  function s(id, v) { var e = el(id); if (e) e.textContent = v; }
  s('esp32LatVal', formatGpsCoord(g.gps_lat, 'N', 'S'));
  s('esp32LonVal', formatGpsCoord(g.gps_lon, 'E', 'W'));
  s('esp32AltVal', formatGpsAltM(g.gps_alt));
  s('esp32SpeedVal', formatGpsSpeedKmh(g.gps_speed));
}

function pickSensorNumber(data, keys) {
  for (var i = 0; i < keys.length; i++) {
    var v = data[keys[i]];
    if (v != null && v !== '' && !isNaN(Number(v))) return Number(v);
  }
  return null;
}

function applyEsp32Sensor(data) {
  var dot = el('esp32ConnDot');
  var connLabel = el('esp32ConnLabel');
  var ageLabel = el('esp32AgeLabel');
  var empty = el('esp32EmptyState');
  var grid = el('esp32MetricsGrid');

  var connected = !!(data && data.connected);
  var hasReading = !!(data && data.received_at != null);
  var gpsFixed = !!(data && (data.gps_fixed === true || data.gps_fixed === 1 || data.gps_fixed === '1'));

  window.latestSensorGps = {
    connected: connected,
    gps_fixed: gpsFixed,
    gps_lat: pickSensorNumber(data || {}, ['gps_lat', 'lat']),
    gps_lon: pickSensorNumber(data || {}, ['gps_lon', 'lon', 'lng']),
    gps_alt: pickSensorNumber(data || {}, ['gps_alt', 'altitude', 'alt']),
    gps_speed: pickSensorNumber(data || {}, ['gps_speed', 'speed']),
    gps_sats: pickSensorNumber(data || {}, ['gps_sats', 'sats', 'satellites'])
  };
  syncOrbitTrackerGpsBar();
  syncEsp32GpsMetrics(window.latestSensorGps);

  if (!dot || !empty || !grid) return;

  dot.className = 'sdot ' + (connected ? 'g' : 'off');
  if (connLabel) connLabel.textContent = connected ? 'Connected' : 'Offline';

  if (!hasReading || !connected) {
    if (ageLabel) ageLabel.textContent = 'No live sensor data yet';
    empty.hidden = false;
    grid.hidden = true;
    return;
  }

  empty.hidden = true;
  grid.hidden = false;

  syncEsp32GpsMetrics(window.latestSensorGps);

  if (ageLabel) {
    var age = data.age_seconds;
    ageLabel.textContent = age != null
      ? 'Last updated ' + (age < 1 ? '<1' : Math.round(age)) + 's ago'
      : 'Last updated just now';
  }
}

async function updateEsp32Sensor() {
  if (!useApi) {
    applyEsp32Sensor({ connected: false, received_at: null });
    return;
  }
  try {
    var res = await apiFetch('/api/sensor');
    if (res && res.ok) {
      applyEsp32Sensor(await res.json());
      return;
    }
  } catch (e) { /* ignore */ }
  applyEsp32Sensor({ connected: false, received_at: null });
}

function formatDoppler(dop) {
  if (typeof dop === 'string') return dop;
  var sign = dop >= 0 ? '+' : '';
  return sign + (Math.abs(dop) >= 1 ? dop.toFixed(1) + ' kHz' : (dop * 1000).toFixed(0) + ' Hz');
}

function applyOrbit(data) {
  OR.lat = data.lat;
  OR.lon = data.lon;
  OR.alt = data.alt;
  OR.vel = data.vel;
  OR.dop = data.dop;
  var deg = '\u00b0';
  function s2(id, v) { var e = el(id); if (e) e.textContent = v; }
  // Prefer live ESP32 GPS on the Orbit Tracker bar when a fix is available.
  if (typeof hasLiveGpsFix === 'function' && hasLiveGpsFix()) {
    syncOrbitTrackerGpsBar();
  } else {
    s2('sb-lat', Math.abs(OR.lat).toFixed(2) + deg + (OR.lat >= 0 ? 'N' : 'S'));
    s2('sb-lon', Math.abs(OR.lon).toFixed(2) + deg + (OR.lon >= 0 ? 'E' : 'W'));
    s2('sb-alt', OR.alt.toFixed(1) + ' km');
    s2('sb-vel', OR.vel.toFixed(3) + ' km/s');
    s2('sb-gt', data.ground_track || GTS[gti]);
  }
  s2('rm-alt', Math.round(OR.alt));
  s2('rm-vel', OR.vel.toFixed(1));
  if (typeof selectedSatName !== 'undefined' && selectedSatName === 'VIDYAJYOTI' && typeof updateMttOverlay === 'function') {
    updateMttOverlay();
  }
}

function updateSensorsClient() {
  D.temp = nudge(D.temp, 0.4, 26, 38);
  D.hum = nudge(D.hum, 1.5, 55, 95);
  D.pres = nudge(D.pres, 1, 995, 1020);
  D.wind = nudge(D.wind, 1.5, 5, 45);
  D.uv = nudge(D.uv, 0.3, 0, 11);
  D.aqi = nudge(D.aqi, 4, 50, 200);
  D.dew = nudge(D.dew, 0.3, 18, 30);
  D.vis = nudge(D.vis, 0.2, 2, 12);
  D.cloud = nudge(D.cloud, 3, 10, 100);
  D.rain = nudge(D.rain, 1, 0, 100);
  applyTelemetry({
    temp: D.temp, hum: D.hum, pres: D.pres, wind: D.wind, uv: D.uv,
    aqi: D.aqi, dew: D.dew, vis: D.vis, cloud: D.cloud, rain: D.rain,
    feels_like: D.temp + D.hum * 0.04,
    wx_cond: wxConds[Math.floor(Math.random() * 2)]
  });
}

function updateOrbitClient() {
  if (typeof VjOrbit !== 'undefined') {
    var p = VjOrbit.propagate('VIDYAJYOTI', new Date());
    if (p) {
      gti = (gti + 1) % GTS.length;
      applyOrbit({
        lat: p.lat, lon: p.lon, alt: p.alt_km, vel: p.velocity, dop: OR.dop,
        ground_track: GTS[gti], is_simulated: true
      });
      return;
    }
  }
  OR.lat = nudge(OR.lat, 0.15, 8, 35);
  OR.lon = nudge(OR.lon, 0.15, 68, 92);
  OR.alt = nudge(OR.alt, 0.5, 400, 425);
  OR.vel = nudge(OR.vel, 0.002, 7.6, 7.72);
  OR.dop = nudge(OR.dop, 0.15, -5, 5);
  gti = (gti + 1) % GTS.length;
  applyOrbit({
    lat: OR.lat, lon: OR.lon, alt: OR.alt, vel: OR.vel, dop: OR.dop,
    ground_track: GTS[gti], is_simulated: true
  });
}

async function updateSensors() {
  if (useApi) {
    try {
      var res = await apiFetch('/api/telemetry');
      if (res && res.ok) {
        applyTelemetry(await res.json());
        return;
      }
      if (useApi) return;
    } catch (e) { return; }
  }
  updateSensorsClient();
}

async function updateOrbit() {
  if (useApi) {
    try {
      var res = await apiFetch('/api/orbit');
      if (res && res.ok) {
        applyOrbit(await res.json());
        return;
      }
    } catch (e) { /* use client fallback */ }
  }
  updateOrbitClient();
}

async function loadPasses() {
  if (!useApi) return;
  try {
    var res = await apiFetch('/api/passes');
    if (res && res.ok && typeof renderPassTable === 'function') {
      renderPassTable(await res.json());
      if (typeof updateRightPanel === 'function' && selectedSatName) {
        updateRightPanel(selectedSatName);
      }
      return;
    }
  } catch (e) { /* ignore */ }
  if (typeof renderPassTable === 'function') {
    var fallback = [
      { name: 'VIDYAJYOTI', is_simulated: true, az: '-', el: '-', dir: 'SIM', next_pass: 'Simulated', footprint: '-', alt_km: 412, doppler: '-', orbit_min: 92, color: '#4d9fff', status: 'simulated' },
      { name: 'VO-52', is_simulated: false, az: '-', el: '-', dir: '-', next_pass: 'Loading...', footprint: '-', alt_km: '-', doppler: '-', orbit_min: '-', color: '#9d6fff', status: 'unknown' },
      { name: 'SO-50', is_simulated: false, az: '-', el: '-', dir: '-', next_pass: 'Loading...', footprint: '-', alt_km: '-', doppler: '-', orbit_min: '-', color: '#ff7c3a', status: 'unknown' },
      { name: 'AO-27', is_simulated: false, az: '-', el: '-', dir: '-', next_pass: 'Loading...', footprint: '-', alt_km: '-', doppler: '-', orbit_min: '-', color: '#ffc444', status: 'unknown' },
      { name: 'FO-29', is_simulated: false, az: '-', el: '-', dir: '-', next_pass: 'Loading...', footprint: '-', alt_km: '-', doppler: '-', orbit_min: '-', color: '#ff4466', status: 'unknown' },
      { name: 'HO-68', is_simulated: false, az: '-', el: '-', dir: '-', next_pass: 'Loading...', footprint: '-', alt_km: '-', doppler: '-', orbit_min: '-', color: '#00e5a0', status: 'unknown' }
    ];
    renderPassTable(fallback);
  }
}

window.updatePassCountdown = function () {
  var name = typeof selectedSatName !== 'undefined' ? selectedSatName : 'VIDYAJYOTI';
  var row = null;
  if (typeof passRows !== 'undefined') {
    for (var i = 0; i < passRows.length; i++) {
      if (passRows[i].name === name) { row = passRows[i]; break; }
    }
  }
  var label = 'Next Pass: --:--:--';
  var shortLabel = 'NEXT --:--';
  if (row && row.next_pass_iso) {
    var diff = Math.max(0, Math.floor((new Date(row.next_pass_iso).getTime() - Date.now()) / 1000));
    var h = Math.floor(diff / 3600);
    var m = Math.floor((diff % 3600) / 60);
    var ss = diff % 60;
    label = 'Next Pass: ' + pad(h) + ':' + pad(m) + ':' + pad(ss);
    shortLabel = 'NEXT ' + pad(m) + ':' + pad(ss);
  } else if (row && row.is_simulated) {
    label = 'Next Pass: Simulated';
    shortLabel = 'NEXT SIM';
  } else if (row && row.next_pass) {
    label = 'Next Pass: ' + row.next_pass + ' UTC';
    shortLabel = 'NEXT ' + row.next_pass;
  }
  var e1 = el('sb-np'); if (e1) e1.textContent = label.replace('Next Pass: ', '');
  var e2 = el('passCountdown'); if (e2) e2.textContent = shortLabel;
  var e3 = el('nextPassLabel'); if (e3) e3.textContent = label;
};

setInterval(updateSensors, 60000);
setInterval(updateEsp32Sensor, 3000);
setInterval(updateOrbit, 3500);
setInterval(loadPasses, 300000);
setInterval(function () {
  if (typeof updatePassCountdown === 'function') updatePassCountdown();
}, 1000);

updateSensors();
updateEsp32Sensor();
updateOrbit();
