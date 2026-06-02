/* ORBIT TRACKER — INTERACTIVE MAPS */
var DEFAULT_SATS = [
  { name: 'VIDYAJYOTI', lon: 88.36, lat: 22.14, color: '#4d9fff', alt: 412, dop: '+3.1kHz', track: 0, speed: 0.28 },
  { name: 'VO-52', lon: -20, lat: 15, color: '#9d6fff', alt: 627, dop: '+205Hz', track: 55, speed: 0.22 },
  { name: 'HO-68', lon: 140, lat: -10, color: '#00e5a0', alt: 7308, dop: '-1.6kHz', track: 120, speed: 0.12 },
  { name: 'SO-50', lon: 60, lat: 35, color: '#ff7c3a', alt: 703, dop: '-533Hz', track: 85, speed: 0.2 },
  { name: 'AO-27', lon: -100, lat: -20, color: '#ffc444', alt: 779, dop: '-2.1kHz', track: 200, speed: 0.18 },
  { name: 'FO-29', lon: 170, lat: 30, color: '#ff4466', alt: 887, dop: '+440Hz', track: 160, speed: 0.15 },
];
var SATS2 = DEFAULT_SATS.slice();
var GS_LAT = 19.08;
var GS_LON = 72.88;
var selectedSatName = 'VIDYAJYOTI';
var satAnimT = 0;
var worldMapReady = false;
var mapMode = 'map';
var worldLeaflet = null;
var satLayers = {};
var globeInstance = null;
var globeReady = false;
var indiaLeaflet = null;
var indiaCityMarkers = {};
var DARK_TILES = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
var OSM_TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
var TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>';

var INDIA_CITIES = [
  { n: 'Mumbai', lon: 72.88, lat: 19.08, t: '31.4C', h: '78%', c: '#ff7c3a' },
  { n: 'Delhi', lon: 77.21, lat: 28.61, t: '38.2C', h: '42%', c: '#ffc444' },
  { n: 'Chennai', lon: 80.27, lat: 13.08, t: '33.1C', h: '84%', c: '#00e5a0' },
  { n: 'Kolkata', lon: 88.36, lat: 22.57, t: '34.5C', h: '76%', c: '#9d6fff' },
  { n: 'Bengaluru', lon: 77.59, lat: 12.97, t: '27.8C', h: '68%', c: '#4d9fff' },
  { n: 'Hyderabad', lon: 78.47, lat: 17.38, t: '32.0C', h: '55%', c: '#ff7c3a' },
];
var indiaMapReady = false;

function configureLeafletAssets() {
  if (typeof L === 'undefined') return false;
  if (L.Icon.Default.prototype._vjConfigured) return true;
  var base = 'vendor/leaflet/images/';
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: base + 'marker-icon-2x.png',
    iconUrl: base + 'marker-icon.png',
    shadowUrl: base + 'marker-shadow.png'
  });
  L.Icon.Default.prototype._vjConfigured = true;
  return true;
}

function setMapHint(msg, show) {
  var hint = el('mapLoadHint');
  if (!hint) return;
  if (msg) hint.textContent = msg;
  hint.classList.toggle('visible', !!show);
}

function whenMapContainerReady(container, cb) {
  var attempts = 0;
  function tryReady() {
    attempts++;
    if (container && container.offsetWidth > 50 && container.offsetHeight > 50) {
      cb();
      return;
    }
    if (attempts > 120) {
      setMapHint('Map area could not be sized. Try refreshing or widening the window.', true);
      return;
    }
    requestAnimationFrame(tryReady);
  }
  tryReady();
}

function scheduleMapResize() {
  [0, 120, 350, 700].forEach(function (ms) {
    setTimeout(function () {
      if (worldLeaflet) worldLeaflet.invalidateSize(true);
      if (indiaLeaflet) indiaLeaflet.invalidateSize(true);
      resizeGlobe();
    }, ms);
  });
}

function addReliableTiles(map) {
  var primary = L.tileLayer(DARK_TILES, { attribution: TILE_ATTR, subdomains: 'abcd', maxZoom: 19 });
  var fallback = L.tileLayer(OSM_TILES, {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19
  });
  primary.addTo(map);
  var errors = 0;
  primary.on('tileerror', function () {
    errors++;
    if (errors >= 2 && map.hasLayer(primary)) {
      map.removeLayer(primary);
      fallback.addTo(map);
    }
  });
  return primary;
}

function findSat(name) {
  for (var i = 0; i < SATS2.length; i++) {
    if (SATS2[i].name === name) return SATS2[i];
  }
  return SATS2[0];
}

function buildTrack(sat, offset) {
  var pts = [];
  var sp = sat.speed;
  for (var lo = -180; lo <= 180; lo += 3) {
    var la = 25 * Math.sin((lo + sat.track + satAnimT * 50 * sp + offset) * Math.PI / 90);
    pts.push([la, lo]);
  }
  return pts;
}

function satPosition(sat) {
  var sp = sat.speed;
  var lon = ((sat.track + satAnimT * 50 * sp) % 360) - 180;
  var lat = 25 * Math.sin(lon * Math.PI / 90);
  return { lat: lat, lon: lon };
}

function footprintRadiusM(sat) { return Math.min(2200000, 350000 + sat.alt * 2800); }

function lookAngles(gsLat, gsLon, satLat, satLon, altKm) {
  var R = 6378.137;
  var lat1 = gsLat * Math.PI / 180;
  var lon1 = gsLon * Math.PI / 180;
  var lat2 = satLat * Math.PI / 180;
  var lon2 = satLon * Math.PI / 180;
  var dLon = lon2 - lon1;
  var az = Math.atan2(
    Math.sin(dLon) * Math.cos(lat2),
    Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
  );
  var cosPsi = Math.sin(lat1) * Math.sin(lat2) + Math.cos(lat1) * Math.cos(lat2) * Math.cos(dLon);
  var psi = Math.acos(Math.min(1, Math.max(-1, cosPsi)));
  var r = R + altKm;
  var el = Math.atan2(Math.cos(psi) - R / r, Math.sin(psi));
  return {
    az: (az * 180 / Math.PI + 360) % 360,
    el: Math.max(0, el * 180 / Math.PI)
  };
}

function satDopplerLabel(sat) {
  if (sat.name === 'VIDYAJYOTI' && typeof OR !== 'undefined') {
    return typeof formatDoppler === 'function' ? formatDoppler(OR.dop) : String(OR.dop);
  }
  return sat.dop || '—';
}

function updateMttOverlay() {
  var sat = findSat(selectedSatName);
  if (!sat) return;
  var pos = sat.name === 'VIDYAJYOTI' && typeof OR !== 'undefined'
    ? { lat: OR.lat, lon: OR.lon }
    : satPosition(sat);
  var alt = sat.name === 'VIDYAJYOTI' && typeof OR !== 'undefined' ? OR.alt : sat.alt;
  var angles = lookAngles(GS_LAT, GS_LON, pos.lat, pos.lon, alt);
  function s(id, v) { var e = el(id); if (e) e.textContent = v; }
  s('mttName', sat.name);
  s('mttAz', angles.az.toFixed(1) + '\u00b0');
  s('mttEl', angles.el.toFixed(1) + '\u00b0');
  s('mttAlt', Math.round(alt) + ' km');
  s('mttDop', satDopplerLabel(sat));
}

function updateSatHighlight() {
  SATS2.forEach(function (sat) {
    var lyr = satLayers[sat.name];
    if (!lyr) return;
    var sel = sat.name === selectedSatName;
    lyr.marker.setStyle({
      radius: sel ? 9 : (sat.name === 'VIDYAJYOTI' ? 7 : 5),
      weight: sel ? 3 : 2
    });
    lyr.trackLine.setStyle({ opacity: sel ? 1 : 0.35, weight: sel ? 3 : 2.2 });
    lyr.prevTrack.setStyle({ opacity: sel ? 0.45 : 0.18 });
    lyr.footprint.setStyle({ fillOpacity: sel ? 0.09 : 0.05 });
  });
}

function selectSatellite(name) {
  selectedSatName = name;
  updateSatHighlight();
  updateMttOverlay();
  var lyr = satLayers[name];
  if (lyr && worldLeaflet && activeTab === 2 && mapMode === 'map') {
    var pos = name === 'VIDYAJYOTI' && typeof OR !== 'undefined'
      ? [OR.lat, OR.lon]
      : (function () { var p = satPosition(lyr.sat); return [p.lat, p.lon]; })();
    lyr.marker.setLatLng(pos);
    lyr.marker.openPopup();
  }
}

function setupWorldMapLayers() {
  var container = el('worldMapLeaflet');
  if (!container) return;
  configureLeafletAssets();
  whenMapContainerReady(container, function () {
    worldLeaflet = L.map(container, {
      zoomControl: true, attributionControl: true, worldCopyJump: true, minZoom: 2, maxZoom: 10
    }).setView([20, 80], 3);
    addReliableTiles(worldLeaflet);
    L.circleMarker([GS_LAT, GS_LON], { radius: 9, color: '#ff7c3a', fillColor: '#ff7c3a', fillOpacity: 0.95, weight: 2 })
      .addTo(worldLeaflet).bindPopup('<b>GS MUMBAI</b><br>Ground Station &middot; Vidyajyoti');
    L.circle([GS_LAT, GS_LON], { radius: 800000, color: '#ff7c3a', fillColor: '#ff7c3a', fillOpacity: 0.04, weight: 1, dashArray: '6 4' }).addTo(worldLeaflet);
    SATS2.forEach(function (sat) {
      var prevTrack = L.polyline([], { color: sat.color, weight: 1, opacity: 0.28, dashArray: '4 8' }).addTo(worldLeaflet);
      var trackLine = L.polyline([], { color: sat.color, weight: 2.2, opacity: 0.75, dashArray: '8 5' }).addTo(worldLeaflet);
      var footprint = L.circle([0, 0], { radius: footprintRadiusM(sat), color: sat.color, fillColor: sat.color, fillOpacity: 0.05, weight: 1, dashArray: '4 6' }).addTo(worldLeaflet);
      var marker = L.circleMarker([0, 0], { radius: sat.name === 'VIDYAJYOTI' ? 7 : 5, color: sat.color, fillColor: sat.color, fillOpacity: 1, weight: 2 }).addTo(worldLeaflet);
      marker.bindPopup(function () {
        var p = sat.name === 'VIDYAJYOTI' && typeof OR !== 'undefined'
          ? { lat: OR.lat, lon: OR.lon }
          : satPosition(sat);
        return '<b>' + sat.name + '</b><br>Lat ' + p.lat.toFixed(2) + '&deg; Lon ' + p.lon.toFixed(2) + '&deg;<br>Alt ' + sat.alt + ' km &middot; ' + satDopplerLabel(sat);
      });
      satLayers[sat.name] = { sat: sat, prevTrack: prevTrack, trackLine: trackLine, marker: marker, footprint: footprint };
    });
    updateSatHighlight();
    updateMttOverlay();
    setMapHint('', false);
    scheduleMapResize();
  });
}

async function initWorldMap() {
  if (worldMapReady) return;
  if (typeof L === 'undefined' || !configureLeafletAssets()) {
    setMapHint('Map library failed to load. Check your network connection and refresh.', true);
    console.error('Leaflet failed to load.');
    return;
  }

  setMapHint('Loading map…', true);
  var sats = DEFAULT_SATS.slice();
  if (typeof useApi !== 'undefined' && useApi) {
    try {
      var res = await fetch('/api/satellites');
      if (res.ok) sats = await res.json();
    } catch (e) { /* use DEFAULT_SATS */ }
  }
  SATS2 = sats;
  worldMapReady = true;
  setupWorldMapLayers();

  function resizeMaps() { scheduleMapResize(); }
  window.addEventListener('resize', resizeMaps);

  function tickOrbitMaps() {
    if (activeTab === 2) satAnimT += 0.003;
    if (activeTab === 2 && mapMode === 'map' && worldLeaflet) {
      SATS2.forEach(function (sat) {
        var lyr = satLayers[sat.name];
        if (!lyr) return;
        lyr.prevTrack.setLatLngs(buildTrack(sat, -0.5));
        lyr.trackLine.setLatLngs(buildTrack(sat, 0));
        var pos = sat.name === 'VIDYAJYOTI' && typeof OR !== 'undefined'
          ? { lat: OR.lat, lon: OR.lon }
          : satPosition(sat);
        lyr.marker.setLatLng([pos.lat, pos.lon]);
        lyr.footprint.setLatLng([pos.lat, pos.lon]);
        lyr.footprint.setRadius(footprintRadiusM(sat));
      });
      updateMttOverlay();
    }
    if (activeTab === 2 && mapMode === 'globe' && globeInstance) updateGlobeData();
    requestAnimationFrame(tickOrbitMaps);
  }
  tickOrbitMaps();
  scheduleMapResize();
}

function resizeGlobe() {
  if (!globeInstance || !globeReady) return;
  var gw = el('globeWrap');
  if (!gw || gw.offsetWidth < 10) return;
  globeInstance.width(gw.offsetWidth).height(gw.offsetHeight);
}

function initGlobe() {
  if (globeReady) return;
  if (typeof Globe === 'undefined') { console.error('Globe.gl failed to load.'); return; }
  globeReady = true;
  var wrap = el('globeWrap');
  globeInstance = Globe()
    .globeImageUrl('https://unpkg.com/three-globe/example/img/earth-night.jpg')
    .backgroundColor('rgba(6,10,18,0)')
    .showAtmosphere(true).atmosphereColor('#4d9fff').atmosphereAltitude(0.18)
    .pointAltitude(function (d) { return d.name === 'VIDYAJYOTI' ? 0.12 : 0.07; })
    .pointRadius(function (d) { return d.name === 'GS MUMBAI' ? 0.35 : 0.28; })
    .pointColor('color').pointLabel('label')
    .arcAltitude(0.06).arcStroke(0.35).arcColor('color')(wrap);
  globeInstance.controls().autoRotate = true;
  globeInstance.controls().autoRotateSpeed = 0.35;
  resizeGlobe();
  updateGlobeData();
}

function updateGlobeData() {
  if (!globeInstance) return;
  var points = [{ lat: GS_LAT, lng: GS_LON, name: 'GS MUMBAI', color: '#ff7c3a', label: '<b>GS MUMBAI</b>' }];
  SATS2.forEach(function (sat) {
    var p = sat.name === 'VIDYAJYOTI' && typeof OR !== 'undefined'
      ? { lat: OR.lat, lon: OR.lon }
      : satPosition(sat);
    points.push({ lat: p.lat, lng: p.lon, name: sat.name, color: sat.color, label: '<b>' + sat.name + '</b><br>' + sat.alt + ' km' });
  });
  globeInstance.pointsData(points);
  var arcs = [];
  SATS2.forEach(function (sat) {
    var pts = buildTrack(sat, 0);
    for (var i = 0; i < pts.length - 1; i += 12) {
      arcs.push({ startLat: pts[i][0], startLng: pts[i][1], endLat: pts[i + 1][0], endLng: pts[i + 1][1], color: sat.color });
    }
  });
  globeInstance.arcsData(arcs);
}

function setMapMode(mode, btn) {
  document.querySelectorAll('.vtbtn').forEach(function (b) { b.classList.remove('active'); });
  btn.classList.add('active');
  mapMode = mode;
  var wl = el('worldMapLeaflet');
  var gw = el('globeWrap');
  if (mode === 'globe') {
    wl.style.display = 'none';
    gw.style.display = 'block';
    initGlobe();
    setTimeout(resizeGlobe, 80);
  } else {
    gw.style.display = 'none';
    wl.style.display = 'block';
    if (worldLeaflet) setTimeout(function () { worldLeaflet.invalidateSize(); }, 80);
  }
}

function cityPopup(ci) { return '<b>' + ci.n + '</b><br>' + ci.t + ' &middot; ' + ci.h; }

function updateIndiaCityPopups() {
  if (!indiaCityMarkers.Mumbai) return;
  indiaCityMarkers.Mumbai.setPopupContent('<b>Mumbai</b><br>' + D.temp.toFixed(1) + '&deg;C &middot; ' + Math.round(D.hum) + '%');
}

function initIndiaMap() {
  if (indiaMapReady) return;
  if (!configureLeafletAssets()) return;
  indiaMapReady = true;
  var container = el('indiaMapLeaflet');
  if (!container) return;
  whenMapContainerReady(container, function () {
    indiaLeaflet = L.map(container, { zoomControl: true, attributionControl: true, scrollWheelZoom: true, minZoom: 4, maxZoom: 8 })
      .fitBounds([[6.5, 68], [35.5, 97.5]], { padding: [14, 14] });
    addReliableTiles(indiaLeaflet);
    INDIA_CITIES.forEach(function (ci) {
      var m = L.circleMarker([ci.lat, ci.lon], { radius: 8, color: ci.c, fillColor: ci.c, fillOpacity: 0.92, weight: 2 }).addTo(indiaLeaflet);
      m.bindPopup(cityPopup(ci));
      indiaCityMarkers[ci.n] = m;
    });
    L.circleMarker([22.14, 88.36], { radius: 6, color: '#4d9fff', fillColor: '#4d9fff', fillOpacity: 1, weight: 2 })
      .addTo(indiaLeaflet).bindPopup('<b>Vidyajyoti SAT-01</b><br>Ground track over India');
    scheduleMapResize();
  });
}

updateSensors();
updateOrbit();
