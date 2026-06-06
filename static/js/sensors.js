/* ====================================================
   TELEMETRY & ORBIT DATA
   Uses Flask API locally; client-side fallback on GitHub Pages
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
var tempHistory = [];
for (var ii = 0; ii < 24; ii++) tempHistory.push(26 + Math.sin(ii / 5) * 5 + Math.random() * 2);

var OR = { lat: 22.14, lon: 88.36, alt: 412.6, vel: 7.662, dop: 3.12 };
var GTS = ['Bay of Bengal', 'Tamil Nadu Coast', 'Indian Ocean', 'Arabian Sea', 'Bay of Bengal'];
var gti = 0;
var cdSec = 13620;

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
  tempHistory.push(D.temp);
  if (tempHistory.length > 48) tempHistory.shift();

  function s(id, v) { var e = el(id); if (e) e.textContent = v; }
  function sw(id, pct) { var e = el(id); if (e) e.style.width = Math.max(2, Math.min(100, pct)) + '%'; }

  s('tempHero', D.temp.toFixed(1));
  s('feelsLike', (data.feels_like != null ? data.feels_like : (D.temp + D.hum * 0.04)).toFixed(1));
  s('wxCond', data.wx_cond || wxConds[Math.floor(Math.random() * 2)]);
  s('humHero', Math.round(D.hum));
  sw('humBarHero', D.hum);
  s('presVal', Math.round(D.pres));
  sw('presBar', ((D.pres - 990) / 40 * 100));
  s('windVal', Math.round(D.wind));
  sw('windBar', (D.wind / 60 * 100));
  s('uvVal', D.uv.toFixed(1));
  sw('uvBar', (D.uv / 11 * 100));
  s('aqiVal', Math.round(D.aqi));
  sw('aqiBar', (D.aqi / 300 * 100));
  s('dewVal', D.dew.toFixed(1));
  s('visVal', D.vis.toFixed(1));
  s('cloudVal', Math.round(D.cloud));
  s('rainVal', Math.round(D.rain));
  D.age = 0;
  if (typeof setGaugeTarget === 'function') setGaugeTarget(D.hum);
  if (typeof drawTempSparkline === 'function') drawTempSparkline();
  if (typeof updateIndiaCityPopups === 'function') updateIndiaCityPopups();
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
  if (data.countdown_sec != null) cdSec = data.countdown_sec;
  var deg = '\u00b0';
  function s2(id, v) { var e = el(id); if (e) e.textContent = v; }
  s2('sb-lat', Math.abs(OR.lat).toFixed(2) + deg + (OR.lat >= 0 ? 'N' : 'S'));
  s2('sb-lon', Math.abs(OR.lon).toFixed(2) + deg + (OR.lon >= 0 ? 'E' : 'W'));
  s2('sb-alt', OR.alt.toFixed(1) + ' km');
  s2('sb-vel', OR.vel.toFixed(3) + ' km/s');
  s2('sb-gt', data.ground_track || GTS[gti]);
  s2('rm-alt', Math.round(OR.alt));
  s2('rm-vel', OR.vel.toFixed(1));
  if (typeof updateMttOverlay === 'function') updateMttOverlay();
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
  OR.lat = nudge(OR.lat, 0.15, -85, 85);
  OR.lon = +(OR.lon + 0.4 + (Math.random() - 0.5) * 0.1).toFixed(2);
  if (OR.lon > 180) OR.lon = -180;
  OR.alt = nudge(OR.alt, 0.5, 400, 425);
  OR.vel = nudge(OR.vel, 0.002, 7.6, 7.72);
  OR.dop = nudge(OR.dop, 0.15, -5, 5);
  gti = (gti + 1) % GTS.length;
  applyOrbit({
    lat: OR.lat, lon: OR.lon, alt: OR.alt, vel: OR.vel, dop: OR.dop,
    ground_track: GTS[gti], countdown_sec: cdSec
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
      if (useApi) return;
    } catch (e) { return; }
  }
  updateOrbitClient();
}

setInterval(updateSensors, 3500);
setInterval(updateOrbit, 3500);
setInterval(function () {
  if (cdSec > 0) cdSec--;
  var h = Math.floor(cdSec / 3600);
  var m = Math.floor((cdSec % 3600) / 60);
  var ss = cdSec % 60;
  var st = pad(m) + ':' + pad(ss);
  var e1 = el('sb-np'); if (e1) e1.textContent = pad(h) + ':' + pad(m) + ':' + pad(ss);
  var e2 = el('passCountdown'); if (e2) e2.textContent = 'NEXT ' + st;
  var e3 = el('nextPassLabel'); if (e3) e3.textContent = 'Next Pass: ' + st;
}, 1000);
