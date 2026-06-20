/* ORBIT TRACKER — real TLE propagation via VjOrbit + Leaflet + Globe.gl */

var SATS2 = [];
var GS_LAT = 19.08;
var GS_LON = 72.88;
var selectedSatName = 'VIDYAJYOTI';
var worldMapReady = false;
var mapMode = 'map';
var worldLeaflet = null;
var satLayers = {};
var globeInstance = null;
var globeReady = false;
var indiaLeaflet = null;
var indiaCityMarkers = {};
var indiaCityData = {};
var passRows = [];
var orbitDataBanner = '';
var trackRefreshAt = 0;
var globeTrackRefreshAt = 0;

var FALLBACK_SATS = [
  { name: 'VIDYAJYOTI', norad_id: null, color: '#4d9fff', is_simulated: true, status: 'simulated', tle_available: false },
  { name: 'VO-52', norad_id: 32791, color: '#9d6fff', is_simulated: false, status: 'unknown', tle_available: false },
  { name: 'SO-50', norad_id: 27607, color: '#ff7c3a', is_simulated: false, status: 'unknown', tle_available: false },
  { name: 'AO-27', norad_id: 22825, color: '#ffc444', is_simulated: false, status: 'unknown', tle_available: false },
  { name: 'FO-29', norad_id: 24278, color: '#ff4466', is_simulated: false, status: 'unknown', tle_available: false },
  { name: 'HO-68', norad_id: 36122, color: '#00e5a0', is_simulated: false, status: 'unknown', tle_available: false }
];

var SAT_META = {
  VIDYAJYOTI: { code: 'SAT-01 \u00b7 LEO \u00b7 SIMULATED', label: 'VIDYAJYOTI<br>SAT-01', purpose: 'Earth Observation \u00b7 Climate Monitoring \u00b7 Amateur Radio (simulated)' },
  'VO-52': { code: 'HAMSAT \u00b7 LEO \u00b7 CelesTrak', label: 'VO-52<br>HAMSAT', purpose: 'Amateur radio communications \u00b7 India' },
  'SO-50': { code: 'SaudiSat \u00b7 LEO \u00b7 CelesTrak', label: 'SO-50<br>SaudiSat-1C', purpose: 'Amateur radio repeater satellite' },
  'AO-27': { code: 'AMRAD \u00b7 LEO \u00b7 CelesTrak', label: 'AO-27<br>AMRAD-OSCAR', purpose: 'Amateur radio communications' },
  'FO-29': { code: 'FujiSat \u00b7 LEO \u00b7 CelesTrak', label: 'FO-29<br>Fuji-OSCAR', purpose: 'Amateur radio \u00b7 Store-and-forward' },
  'HO-68': { code: 'XW-1 \u00b7 LEO \u00b7 CelesTrak', label: 'HO-68<br>XW-1', purpose: 'Amateur radio \u00b7 Hope Oscar' }
};

var DARK_TILES = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
var LIGHT_TILES = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
var OSM_TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
var TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>';
var mapTileLayers = { world: null, india: null };
var GLOBE_IMG_DARK = 'https://unpkg.com/three-globe/example/img/earth-night.jpg';
var GLOBE_IMG_LIGHT = 'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg';

function isLightMapTheme() {
  return document.documentElement.getAttribute('data-theme') === 'light';
}

function primaryTileUrl() {
  return isLightMapTheme() ? LIGHT_TILES : DARK_TILES;
}

function vjAccentColor() {
  return getComputedStyle(document.documentElement).getPropertyValue('--acc').trim() || '#4d9fff';
}

function satIcon(color, selected) {
  var size = selected ? 34 : 28;
  var stroke = selected ? 2.2 : 1.6;
  return L.divIcon({
    className: 'sat-marker-icon',
    html: '<div class="sat-marker-wrap' + (selected ? ' sel' : '') + '" style="color:' + color + '">' +
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="' + size + '" height="' + size + '" aria-hidden="true">' +
      '<rect x="14" y="6" width="4" height="20" rx="1" fill="' + color + '"/>' +
      '<rect x="4" y="12" width="24" height="3" rx="1" fill="' + color + '" opacity="0.85"/>' +
      '<rect x="2" y="10" width="4" height="7" rx="0.5" fill="' + color + '" opacity="0.7"/>' +
      '<rect x="26" y="10" width="4" height="7" rx="0.5" fill="' + color + '" opacity="0.7"/>' +
      '<circle cx="16" cy="16" r="3" fill="' + color + '" stroke="#fff" stroke-width="' + stroke + '"/>' +
      '</svg></div>',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2]
  });
}

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

function setOrbitBanner(msg, show) {
  var b = el('orbitDataBanner');
  if (!b) return;
  if (msg) b.textContent = msg;
  b.hidden = !show;
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

function addReliableTiles(map, storeKey) {
  var primary = L.tileLayer(primaryTileUrl(), {
    attribution: TILE_ATTR,
    subdomains: 'abcd',
    maxZoom: 8,
    minZoom: 2,
    keepBuffer: 2,
    updateWhenIdle: true,
    updateWhenZooming: false,
    fadeAnimation: false,
    zoomAnimation: false
  });
  primary.addTo(map);
  if (storeKey) mapTileLayers[storeKey] = primary;
  return primary;
}

window.refreshMapTheme = function () {
  var url = primaryTileUrl();
  [['world', worldLeaflet], ['india', indiaLeaflet]].forEach(function (pair) {
    var key = pair[0];
    var map = pair[1];
    var old = mapTileLayers[key];
    if (!map || !old) return;
    map.removeLayer(old);
    var layer = L.tileLayer(url, {
      attribution: TILE_ATTR,
      subdomains: 'abcd',
      maxZoom: 8,
      keepBuffer: 2,
      updateWhenIdle: true,
      fadeAnimation: false
    });
    layer.addTo(map);
    mapTileLayers[key] = layer;
  });
  if (globeInstance && globeReady) {
    globeInstance
      .globeImageUrl(isLightMapTheme() ? GLOBE_IMG_LIGHT : GLOBE_IMG_DARK)
      .atmosphereColor(vjAccentColor());
    updateGlobeData(true);
  }
};

function findSat(name) {
  for (var i = 0; i < SATS2.length; i++) {
    if (SATS2[i].name === name) return SATS2[i];
  }
  return SATS2[0];
}

function satPosition(sat, date) {
  date = date || new Date();
  if (typeof VjOrbit !== 'undefined') {
    var p = VjOrbit.propagate(sat.name, date);
    if (p) return p;
  }
  return null;
}

function footprintRadiusM(altKm) {
  return Math.min(2200000, 350000 + altKm * 2800);
}

function satPopupHtml(sat, pos) {
  var meta = typeof VjOrbit !== 'undefined' ? VjOrbit.getMeta(sat.name) : sat;
  var sim = meta && meta.is_simulated;
  var norad = meta && meta.norad_id ? 'NORAD ' + meta.norad_id : '';
  var src = sim ? '<br><em>Simulated — mission data not public</em>' : (norad ? '<br>' + norad + ' · CelesTrak TLE' : '');
  return '<b>' + sat.name + '</b>' + src +
    '<br>Lat ' + pos.lat.toFixed(2) + '\u00b0 Lon ' + pos.lon.toFixed(2) + '\u00b0' +
    '<br>Alt ' + pos.alt_km.toFixed(1) + ' km · Vel ' + (pos.velocity || 0).toFixed(2) + ' km/s';
}

function satDopplerLabel(sat) {
  if (sat.name === 'VIDYAJYOTI' && typeof OR !== 'undefined') {
    return typeof formatDoppler === 'function' ? formatDoppler(OR.dop) : String(OR.dop);
  }
  var row = passRows.find(function (r) { return r.name === sat.name; });
  return row && row.doppler ? row.doppler : '\u2014';
}

function updateMttOverlay() {
  var sat = findSat(selectedSatName);
  if (!sat) return;
  var pos = satPosition(sat);
  if (!pos) return;
  var angles = typeof VjOrbit !== 'undefined'
    ? VjOrbit.lookAngles(GS_LAT, GS_LON, pos.lat, pos.lon, pos.alt_km)
    : { az: 0, el: 0 };
  var deg = '\u00b0';
  function s(id, v) { var e = el(id); if (e) e.textContent = v; }
  s('mttName', sat.name);
  s('mttAz', angles.az.toFixed(1) + deg);
  s('mttEl', angles.el.toFixed(1) + deg);
  s('mttAlt', Math.round(pos.alt_km) + ' km');
  s('mttDop', satDopplerLabel(sat));
  s('sb-selected', sat.name);
  s('sb-lat', Math.abs(pos.lat).toFixed(2) + deg + (pos.lat >= 0 ? 'N' : 'S'));
  s('sb-lon', Math.abs(pos.lon).toFixed(2) + deg + (pos.lon >= 0 ? 'E' : 'W'));
  s('sb-alt', pos.alt_km.toFixed(1) + ' km');
  s('sb-vel', (pos.velocity || 0).toFixed(3) + ' km/s');
  var simBadge = el('vjSimBadge');
  if (simBadge) simBadge.hidden = !(sat.is_simulated || sat.name === 'VIDYAJYOTI');
  if (typeof window.setPolarTarget === 'function') {
    window.setPolarTarget(angles.az, angles.el);
  }
  if (typeof window.setSignalTarget === 'function') {
    window.setSignalTarget(angles.el);
  }
}

function updateSatHighlight() {
  SATS2.forEach(function (sat) {
    var lyr = satLayers[sat.name];
    if (!lyr) return;
    var sel = sat.name === selectedSatName;
    if (lyr.marker.setIcon) {
      lyr.marker.setIcon(satIcon(sat.color, sel));
    }
    lyr.trackLine.setStyle({ opacity: sel ? 1 : 0.35, weight: sel ? 3 : 2.2 });
    lyr.prevTrack.setStyle({ opacity: sel ? 0.45 : 0.18 });
    if (lyr.footprint) {
      lyr.footprint.setStyle({ fillOpacity: sel ? 0.09 : 0.05 });
    }
  });
}

function updateRightPanel(name) {
  var meta = SAT_META[name] || { code: name, label: name, purpose: 'Tracked satellite' };
  var pos = null;
  var sat = findSat(name);
  if (sat) pos = satPosition(sat);
  var passRow = null;
  for (var i = 0; i < passRows.length; i++) {
    if (passRows[i].name === name) { passRow = passRows[i]; break; }
  }
  function s(id, v) { var e = el(id); if (e) e.textContent = v; }
  var codeEl = el('sic-code');
  var nameEl = el('sic-name');
  var purposeEl = el('sic-purpose');
  if (codeEl) codeEl.textContent = meta.code;
  if (nameEl) nameEl.innerHTML = meta.label;
  if (purposeEl) purposeEl.textContent = meta.purpose;
  if (pos) {
    s('rm-alt', Math.round(pos.alt_km));
    s('rm-vel', (pos.velocity || 0).toFixed(1));
  }
  if (passRow && passRow.orbit_min && passRow.orbit_min !== '-') {
    s('rm-per', passRow.orbit_min);
  } else if (typeof VjOrbit !== 'undefined' && VjOrbit.orbitPeriodMinutes) {
    s('rm-per', Math.round(VjOrbit.orbitPeriodMinutes(name)));
  }
  document.querySelectorAll('.launch-item').forEach(function (x) { x.classList.remove('launch-sel'); });
}

function selectSatellite(name) {
  selectedSatName = name;
  updateSatHighlight();
  updateMttOverlay();
  updateRightPanel(name);
  document.querySelectorAll('.sat-row').forEach(function (r) {
    r.classList.toggle('active', r.getAttribute('data-sat') === name);
  });
  document.querySelectorAll('.pt-row').forEach(function (r) {
    r.classList.toggle('sel', r.getAttribute('data-sat') === name);
  });
  var lyr = satLayers[name];
  if (lyr && worldLeaflet && activeTab === 2 && mapMode === 'map') {
    var pos = satPosition(lyr.sat);
    lyr.marker.setLatLng([pos.lat, pos.lon]);
    lyr.marker.openPopup();
    worldLeaflet.panTo([pos.lat, pos.lon], { animate: true, duration: 0.6 });
  }
  if (globeInstance && globeReady) {
    globeInstance.controls().autoRotateSpeed = 0.15;
    updateGlobePoints(new Date());
    updateGlobeTracks(true);
  }
}

window.selectSatellite = selectSatellite;

function refreshGroundTracks(force) {
  var now = Date.now();
  if (!force && now - trackRefreshAt < 60000) return;
  trackRefreshAt = now;
  var date = new Date();
  SATS2.forEach(function (sat) {
    var lyr = satLayers[sat.name];
    if (!lyr || typeof VjOrbit === 'undefined') return;
    lyr.trackLine.setLatLngs(VjOrbit.buildGroundTrack(sat.name, date));
    lyr.prevTrack.setLatLngs(VjOrbit.buildPreviousTrack(sat.name, date));
  });
}

function setupWorldMapLayers() {
  var container = el('worldMapLeaflet');
  if (!container) return;
  configureLeafletAssets();
  whenMapContainerReady(container, function () {
    worldLeaflet = L.map(container, {
      zoomControl: true, attributionControl: true, worldCopyJump: true, minZoom: 2, maxZoom: 10
    }).setView([20, 80], 3);
    addReliableTiles(worldLeaflet, 'world');
    L.circleMarker([GS_LAT, GS_LON], { radius: 9, color: '#ff7c3a', fillColor: '#ff7c3a', fillOpacity: 0.95, weight: 2 })
      .addTo(worldLeaflet).bindPopup('<b>GS MUMBAI</b><br>Ground Station · Vidyajyoti');
    L.circle([GS_LAT, GS_LON], { radius: 800000, color: '#ff7c3a', fillColor: '#ff7c3a', fillOpacity: 0.04, weight: 1, dashArray: '6 4' }).addTo(worldLeaflet);
    var date = new Date();
    SATS2.forEach(function (sat) {
      var prevTrack = L.polyline([], { color: sat.color, weight: 1, opacity: 0.28, dashArray: '4 8' }).addTo(worldLeaflet);
      var trackLine = L.polyline([], { color: sat.color, weight: 2.2, opacity: 0.75, dashArray: '8 5' }).addTo(worldLeaflet);
      var footprint = null;
      if (sat.name !== 'VIDYAJYOTI') {
        footprint = L.circle([0, 0], {
          radius: footprintRadiusM(400),
          color: sat.color,
          fillColor: sat.color,
          fillOpacity: 0.05,
          weight: 1,
          dashArray: '4 6'
        }).addTo(worldLeaflet);
      }
      var marker = L.marker([GS_LAT, GS_LON], { icon: satIcon(sat.color, sat.name === selectedSatName) }).addTo(worldLeaflet);
      var startPos = satPosition(sat, date);
      if (startPos) marker.setLatLng([startPos.lat, startPos.lon]);
      if (footprint && startPos) {
        footprint.setLatLng([startPos.lat, startPos.lon]);
        footprint.setRadius(footprintRadiusM(startPos.alt_km));
      }
      marker.on('click', function () { selectSatellite(sat.name); });
      marker.bindPopup(function () {
        return satPopupHtml(sat, satPosition(sat));
      });
      satLayers[sat.name] = { sat: sat, prevTrack: prevTrack, trackLine: trackLine, marker: marker, footprint: footprint };
    });
    setMapHint('', false);
    updateSatHighlight();
    updateMttOverlay();
    setTimeout(function () { refreshGroundTracks(true); }, 50);
    scheduleMapResize();
  });
}

async function refreshSatellitesFromApi() {
  if (typeof useApi === 'undefined' || !useApi) return;
  try {
    var res = typeof apiFetch === 'function'
      ? await apiFetch('/api/satellites')
      : await fetch('/api/satellites', { credentials: 'same-origin' });
    if (!res || res.status === 401 || !res.ok) return;
    var sats = await res.json();
    if (!sats.length) return;
    SATS2 = sats;
    if (typeof VjOrbit !== 'undefined') VjOrbit.initFromApi(sats);
    setOrbitBanner('', false);
    refreshGroundTracks(true);
    if (globeInstance && globeReady) updateGlobeTracks(true);
  } catch (e) { /* keep bundled catalog */ }
}

async function initWorldMap() {
  if (worldMapReady) return;
  if (typeof L === 'undefined' || !configureLeafletAssets()) {
    setMapHint('Map library failed to load. Check your network connection and refresh.', true);
    return;
  }

  SATS2 = (typeof VjOrbit !== 'undefined' && VjOrbit.embeddedCatalog)
    ? VjOrbit.embeddedCatalog()
    : FALLBACK_SATS.slice();
  if (typeof VjOrbit !== 'undefined') VjOrbit.initFromApi(SATS2);

  worldMapReady = true;
  setupWorldMapLayers();
  refreshSatellitesFromApi();

  window.addEventListener('resize', scheduleMapResize);

  function tickOrbitMaps() {
    if (activeTab === 2 && mapMode === 'map' && worldLeaflet) {
      var date = new Date();
      SATS2.forEach(function (sat) {
        var lyr = satLayers[sat.name];
        if (!lyr) return;
        var pos = satPosition(sat, date);
        if (!pos) return;
        lyr.marker.setLatLng([pos.lat, pos.lon]);
        if (lyr.footprint) {
          lyr.footprint.setLatLng([pos.lat, pos.lon]);
          lyr.footprint.setRadius(footprintRadiusM(pos.alt_km));
        }
      });
      updateMttOverlay();
      if (Date.now() - trackRefreshAt > 60000) refreshGroundTracks(false);
    }
    if (activeTab === 2 && mapMode === 'globe' && globeInstance) updateGlobeData(false);
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
  if (typeof Globe === 'undefined') return;
  globeReady = true;
  var wrap = el('globeWrap');
  globeInstance = Globe()
    .globeImageUrl(isLightMapTheme() ? GLOBE_IMG_LIGHT : GLOBE_IMG_DARK)
    .backgroundColor('rgba(0,0,0,0)')
    .showAtmosphere(true).atmosphereColor(vjAccentColor()).atmosphereAltitude(0.18)
    .pointAltitude(function (d) {
      if (d.name === 'GS MUMBAI') return 0.02;
      return d.name === selectedSatName ? 0.18 : 0.14;
    })
    .pointRadius(function (d) {
      if (d.name === 'GS MUMBAI') return 0.55;
      return d.name === selectedSatName ? 1.1 : 0.75;
    })
    .pointColor(function (d) { return d.color; })
    .pointLabel(function (d) {
      if (d.name === 'GS MUMBAI') return d.label;
      return '<b style="color:' + d.color + '">' + d.name + '</b>';
    })
    .onPointClick(function (d) {
      if (d.name && d.name !== 'GS MUMBAI') selectSatellite(d.name);
    })
    .pathPoints(function (d) { return d.coords; })
    .pathPointLat(function (p) { return p[0]; })
    .pathPointLng(function (p) { return p[1]; })
    .pathPointAlt(function (p, i, path) {
      return path && path.name === selectedSatName ? 0.04 : 0.025;
    })
    .pathColor(function (d) { return d.color; })
    .pathStroke(function (d) { return d.name === selectedSatName ? 0.55 : 0.35; })
    .pathsTransitionDuration(0)(wrap);
  globeInstance.controls().autoRotate = true;
  globeInstance.controls().autoRotateSpeed = 0.35;
  resizeGlobe();
  updateGlobeData(true);
}

function splitPathAtDateline(coords) {
  if (!coords || !coords.length) return [];
  var segments = [];
  var current = [];
  for (var i = 0; i < coords.length; i++) {
    var pt = coords[i];
    if (!pt || pt.length < 2 || !isFinite(pt[0]) || !isFinite(pt[1])) continue;
    if (current.length) {
      var prev = current[current.length - 1];
      if (Math.abs(pt[1] - prev[1]) > 180) {
        if (current.length >= 2) segments.push(current.slice());
        current = [[pt[0], pt[1]]];
        continue;
      }
    }
    current.push([pt[0], pt[1]]);
  }
  if (current.length >= 2) segments.push(current);
  return segments;
}

function buildGlobeTracks(date) {
  var paths = [];
  if (typeof VjOrbit === 'undefined') return paths;

  SATS2.forEach(function (sat) {
    var forward = sanitizeGlobePath(VjOrbit.buildGroundTrack(sat.name, date, 100));
    var backward = sanitizeGlobePath(VjOrbit.buildPreviousTrack(sat.name, date, 50));
    var fullTrack = backward.concat(forward.slice(1));
    var segments = splitPathAtDateline(fullTrack);
    segments.forEach(function (seg, idx) {
      if (seg.length >= 2) {
        paths.push({
          name: sat.name,
          color: sat.color,
          coords: seg,
          segment: idx
        });
      }
    });
  });
  return paths;
}

function sanitizeGlobePath(coords) {
  if (!coords || !coords.length) return [];
  return coords.filter(function (pt) {
    return pt && pt.length >= 2 && isFinite(pt[0]) && isFinite(pt[1]);
  });
}

function updateGlobePoints(date) {
  var points = [{ lat: GS_LAT, lng: GS_LON, name: 'GS MUMBAI', color: '#ff7c3a', label: '<b>GS MUMBAI</b><br>Ground Station Mumbai' }];
  SATS2.forEach(function (sat) {
    var p = satPosition(sat, date);
    if (!p) return;
    var meta = typeof VjOrbit !== 'undefined' ? VjOrbit.getMeta(sat.name) : sat;
    var simNote = meta && meta.is_simulated ? '<br><em>Simulated · India LEO</em>' : '';
    points.push({
      lat: p.lat,
      lng: p.lon,
      name: sat.name,
      color: sat.color,
      label: '<b>' + sat.name + '</b><br>' + p.alt_km.toFixed(1) + ' km' + simNote
    });
  });
  globeInstance.pointsData(points);
}

function updateGlobeTracks(force) {
  if (!globeInstance) return;
  var now = Date.now();
  if (!force && now - globeTrackRefreshAt < 45000) return;
  globeInstance.pathsData(buildGlobeTracks(new Date()));
  globeTrackRefreshAt = now;
}

function updateGlobeData(forceTracks) {
  if (!globeInstance) return;
  updateGlobePoints(new Date());
  updateGlobeTracks(!!forceTracks);
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
    setTimeout(function () { resizeGlobe(); updateGlobeData(true); }, 80);
  } else {
    gw.style.display = 'none';
    wl.style.display = 'block';
    if (worldLeaflet) setTimeout(function () { worldLeaflet.invalidateSize(); }, 80);
  }
}

function cityPopup(name) {
  var ci = indiaCityData[name];
  if (!ci || ci.temp == null) return '<b>' + name + '</b><br>Loading weather\u2026';
  return '<b>' + name + '</b><br>' + ci.temp.toFixed(1) + '\u00b0C \u00b7 ' + Math.round(ci.hum) + '%';
}

function updateIndiaCityPopups() {
  Object.keys(indiaCityMarkers).forEach(function (name) {
    indiaCityMarkers[name].setPopupContent(cityPopup(name));
  });
}

async function loadCitiesWeather() {
  if (!useApi) return;
  try {
    var res = await apiFetch('/api/weather/cities');
    if (!res || !res.ok) return;
    var cities = await res.json();
    cities.forEach(function (ci) {
      indiaCityData[ci.name] = ci;
    });
    updateIndiaCityPopups();
  } catch (e) { /* ignore */ }
}

function initIndiaMap() {
  if (indiaMapReady) return;
  if (!configureLeafletAssets()) return;
  indiaMapReady = true;
  var container = el('indiaMapLeaflet');
  if (!container) return;
  var cities = [
    { n: 'Mumbai', lon: 72.88, lat: 19.08, c: '#ff7c3a' },
    { n: 'Delhi', lon: 77.21, lat: 28.61, c: '#ffc444' },
    { n: 'Chennai', lon: 80.27, lat: 13.08, c: '#00e5a0' },
    { n: 'Kolkata', lon: 88.36, lat: 22.57, c: '#9d6fff' },
    { n: 'Bengaluru', lon: 77.59, lat: 12.97, c: '#4d9fff' },
    { n: 'Hyderabad', lon: 78.47, lat: 17.38, c: '#ff7c3a' }
  ];
  whenMapContainerReady(container, function () {
    indiaLeaflet = L.map(container, { zoomControl: true, attributionControl: true, scrollWheelZoom: true, minZoom: 4, maxZoom: 8 })
      .fitBounds([[6.5, 68], [35.5, 97.5]], { padding: [14, 14] });
    addReliableTiles(indiaLeaflet, 'india');
    cities.forEach(function (ci) {
      var m = L.circleMarker([ci.lat, ci.lon], { radius: 8, color: ci.c, fillColor: ci.c, fillOpacity: 0.92, weight: 2 }).addTo(indiaLeaflet);
      m.bindPopup(cityPopup(ci.n));
      indiaCityMarkers[ci.n] = m;
    });
    L.circleMarker([20, 78], { radius: 6, color: '#4d9fff', fillColor: '#4d9fff', fillOpacity: 1, weight: 2 })
      .addTo(indiaLeaflet).bindPopup('<b>Vidyajyoti SAT-01</b><br><em>Simulated LEO over India</em>');
    loadCitiesWeather();
    scheduleMapResize();
  });
}

window.renderPassTable = function (rows) {
  passRows = rows || [];
  var body = el('passTableBody');
  if (!body) return;
  body.innerHTML = '';
  passRows.forEach(function (row) {
    var div = document.createElement('div');
    div.className = 'pt-row' + (row.name === selectedSatName ? ' sel' : '');
    div.setAttribute('data-sat', row.name);
    if (row.status === 'no_tle') div.classList.add('pt-disabled');
    div.innerHTML =
      '<div class="col-sat">' + row.name + (row.is_simulated ? ' <span class="pt-sim">SIM</span>' : '') + '</div>' +
      '<div>' + row.az + '</div><div>' + row.el + '</div><div class="col-g">' + row.dir + '</div>' +
      '<div>' + row.next_pass + '</div><div>' + row.footprint + '</div><div>' + row.alt_km + '</div>' +
      '<div>' + row.doppler + '</div><div>' + row.orbit_min + '</div>';
    div.addEventListener('click', function () { selectSatellite(row.name); });
    body.appendChild(div);
  });
  if (typeof window.updatePassCountdown === 'function') window.updatePassCountdown();
};

var indiaMapReady = false;

setTimeout(function () {
  if (typeof loadPasses === 'function') loadPasses();
}, 200);
