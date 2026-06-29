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
var globePosRefreshAt = 0;
var GLOBE_FP_ALT_FILL = 0.046;
var GLOBE_FP_ALT_RING = 0.054;
var globeTrackPathsCache = [];
var globeFpMaterials = {};
var lastGlobeMarkersSig = '';

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

/* Satellite imagery base (no incorrect political borders) + Esri English labels on orbit map. */
var ESRI_IMAGERY = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
var EN_LABELS_DARK = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}';
var EN_LABELS_LIGHT = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}';
var MAP_TILE_ATTR = '&copy; <a href="https://www.esri.com/">Esri</a> &mdash; Earthstar Geographics';
var INDIA_OUTLINE_URL = null;

function indiaOutlineUrl() {
  if (INDIA_OUTLINE_URL) return INDIA_OUTLINE_URL;
  var script = document.querySelector('script[src*="maps.js"]');
  if (script && script.src) {
    INDIA_OUTLINE_URL = script.src.replace(/js\/maps\.js(\?.*)?$/, 'data/india-outline.geojson');
    return INDIA_OUTLINE_URL;
  }
  INDIA_OUTLINE_URL = '/static/data/india-outline.geojson';
  return INDIA_OUTLINE_URL;
}
var mapTileLayers = { world: null, india: null };
var indiaBoundaryLayers = {};
var GLOBE_IMG_DARK = 'https://unpkg.com/three-globe/example/img/earth-night.jpg';
var GLOBE_IMG_LIGHT = 'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg';

function isLightMapTheme() {
  return document.documentElement.getAttribute('data-theme') === 'light';
}

function imageryBaseOptions(minZoom) {
  return {
    attribution: MAP_TILE_ATTR,
    maxZoom: 19,
    minZoom: minZoom || 1,
    keepBuffer: 2,
    updateWhenIdle: true,
    updateWhenZooming: false,
    fadeAnimation: false,
    zoomAnimation: false
  };
}

function englishLabelOptions() {
  return {
    maxZoom: 16,
    minZoom: 1,
    keepBuffer: 2,
    updateWhenIdle: true,
    updateWhenZooming: false,
    fadeAnimation: false,
    zoomAnimation: false
  };
}

function createWorldOrbitMapLayers() {
  return [
    L.tileLayer(ESRI_IMAGERY, imageryBaseOptions(1)),
    L.tileLayer(isLightMapTheme() ? EN_LABELS_LIGHT : EN_LABELS_DARK, englishLabelOptions())
  ];
}

function createIndiaMapLayers() {
  return [L.tileLayer(ESRI_IMAGERY, imageryBaseOptions(3))];
}

function indiaBoundaryStyle() {
  return {
    color: isLightMapTheme() ? '#c45c00' : '#ff9933',
    fillColor: isLightMapTheme() ? '#ff9933' : '#ff9933',
    fillOpacity: 0.08,
    weight: 2.5,
    opacity: 0.95
  };
}

function addIndiaBoundaryOverlay(map, key) {
  if (!map || indiaBoundaryLayers[key]) return;
  var url = indiaOutlineUrl();
  fetch(url)
    .then(function (res) { return res.ok ? res.json() : null; })
    .then(function (data) {
      if (!data || !map) return;
      indiaBoundaryLayers[key] = L.geoJSON(data, {
        style: indiaBoundaryStyle,
        interactive: false
      }).addTo(map);
    })
    .catch(function () { /* outline optional */ });
}

function refreshIndiaBoundaryStyle() {
  Object.keys(indiaBoundaryLayers).forEach(function (key) {
    var layer = indiaBoundaryLayers[key];
    if (layer && layer.setStyle) layer.setStyle(indiaBoundaryStyle());
  });
}

function removeStoredTileLayers(map, key) {
  var stored = mapTileLayers[key];
  if (!map || !stored) return;
  (Array.isArray(stored) ? stored : [stored]).forEach(function (layer) {
    if (map.hasLayer(layer)) map.removeLayer(layer);
  });
}

function addReliableTiles(map, storeKey) {
  var layers = storeKey === 'india' ? createIndiaMapLayers() : createWorldOrbitMapLayers();
  layers.forEach(function (layer) { layer.addTo(map); });
  if (storeKey) mapTileLayers[storeKey] = layers;
  if (storeKey === 'india' || storeKey === 'world') addIndiaBoundaryOverlay(map, storeKey);
  return layers;
}

function vjAccentColor() {
  return getComputedStyle(document.documentElement).getPropertyValue('--acc').trim() || '#4d9fff';
}

function satMarkerHtml(color, selected, size) {
  size = size || (selected ? 34 : 28);
  var stroke = selected ? 2.2 : 1.6;
  return '<div class="sat-marker-wrap' + (selected ? ' sel' : '') + '" style="color:' + color + '">' +
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="' + size + '" height="' + size + '" aria-hidden="true">' +
    '<rect x="14" y="6" width="4" height="20" rx="1" fill="' + color + '"/>' +
    '<rect x="4" y="12" width="24" height="3" rx="1" fill="' + color + '" opacity="0.85"/>' +
    '<rect x="2" y="10" width="4" height="7" rx="0.5" fill="' + color + '" opacity="0.7"/>' +
    '<rect x="26" y="10" width="4" height="7" rx="0.5" fill="' + color + '" opacity="0.7"/>' +
    '<circle cx="16" cy="16" r="3" fill="' + color + '" stroke="#fff" stroke-width="' + stroke + '"/>' +
    '</svg></div>';
}

function satIcon(color, selected) {
  var size = selected ? 34 : 28;
  return L.divIcon({
    className: 'sat-marker-icon',
    html: satMarkerHtml(color, selected, size),
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

window.refreshMapTheme = function () {
  [['world', worldLeaflet], ['india', indiaLeaflet]].forEach(function (pair) {
    var key = pair[0];
    var map = pair[1];
    if (!map || !mapTileLayers[key]) return;
    removeStoredTileLayers(map, key);
    var layers = key === 'india' ? createIndiaMapLayers() : createWorldOrbitMapLayers();
    layers.forEach(function (layer) { layer.addTo(map); });
    mapTileLayers[key] = layers;
  });
  refreshIndiaBoundaryStyle();
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

function satColorRgba(hex, alpha) {
  var h = String(hex || '#4d9fff').replace('#', '');
  if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
  var r = parseInt(h.slice(0, 2), 16);
  var g = parseInt(h.slice(2, 4), 16);
  var b = parseInt(h.slice(4, 6), 16);
  return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
}

function circleRingCoords(lat, lon, radiusM, numPoints) {
  numPoints = numPoints || 72;
  var earthR = 6378137;
  var angular = radiusM / earthR;
  var lat1 = lat * Math.PI / 180;
  var lon1 = lon * Math.PI / 180;
  var ring = [];
  for (var i = 0; i <= numPoints; i++) {
    var brng = (2 * Math.PI * i) / numPoints;
    var lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(angular) +
      Math.cos(lat1) * Math.sin(angular) * Math.cos(brng)
    );
    var lon2 = lon1 + Math.atan2(
      Math.sin(brng) * Math.sin(angular) * Math.cos(lat1),
      Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2)
    );
    ring.push([lon2 * 180 / Math.PI, lat2 * 180 / Math.PI]);
  }
  return ring;
}

function hexToThreeColor(hex) {
  var h = String(hex || '#4d9fff').replace('#', '');
  if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
  return parseInt(h, 16);
}

function circleRingCoordsLatLng(lat, lon, radiusM, numPoints) {
  numPoints = numPoints || 80;
  var earthR = 6378137;
  var angular = radiusM / earthR;
  var lat1 = lat * Math.PI / 180;
  var lon1 = lon * Math.PI / 180;
  var ring = [];
  for (var i = 0; i <= numPoints; i++) {
    var brng = (2 * Math.PI * i) / numPoints;
    var lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(angular) +
      Math.cos(lat1) * Math.sin(angular) * Math.cos(brng)
    );
    var lon2 = lon1 + Math.atan2(
      Math.sin(brng) * Math.sin(angular) * Math.cos(lat1),
      Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2)
    );
    ring.push([lat2 * 180 / Math.PI, lon2 * 180 / Math.PI]);
  }
  return ring;
}

function globeFootprintMaterial(hex) {
  if (typeof THREE === 'undefined') return null;
  var key = hex || '#4d9fff';
  if (!globeFpMaterials[key]) {
    globeFpMaterials[key] = new THREE.MeshBasicMaterial({
      color: hexToThreeColor(key),
      transparent: true,
      opacity: 0.11,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide
    });
  }
  return globeFpMaterials[key];
}

function buildGlobeFootprintPolygons(date) {
  var sat = findSat(selectedSatName);
  if (!sat) return [];
  var pos = satPosition(sat, date || new Date());
  if (!pos) return [];
  var color = sat.color || '#4d9fff';
  var radiusM = footprintRadiusM(pos.alt_km);
  return [{
    name: sat.name,
    geometry: {
      type: 'Polygon',
      coordinates: [circleRingCoords(pos.lat, pos.lon, radiusM)]
    },
    strokeColor: color,
    alt: GLOBE_FP_ALT_FILL
  }];
}

function buildGlobeFootprintRing(date) {
  var sat = findSat(selectedSatName);
  if (!sat) return null;
  var pos = satPosition(sat, date || new Date());
  if (!pos) return null;
  return {
    name: sat.name,
    color: sat.color || '#4d9fff',
    coords: circleRingCoordsLatLng(pos.lat, pos.lon, footprintRadiusM(pos.alt_km)),
    kind: 'footprint'
  };
}

function applyGlobePaths(date) {
  if (!globeInstance) return;
  date = date || new Date();
  var paths = globeTrackPathsCache.slice();
  var ring = buildGlobeFootprintRing(date);
  if (ring) paths.push(ring);
  globeInstance.pathsData(paths);
}

function updateGlobeFootprint() {
  if (!globeInstance || !globeReady) return;
  var date = new Date();
  globeInstance.polygonsData(buildGlobeFootprintPolygons(date));
  applyGlobePaths(date);
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

function showOrbitSatInfo(show) {
  var mtt = el('mtt');
  if (!mtt) return;
  if (!show || activeTab !== 2) {
    mtt.style.display = 'none';
    return;
  }
  mtt.style.display = mtt.classList.contains('map-overlay-open') ? 'block' : 'none';
}

function groundTrackLabel(lat, lon) {
  if (lon < 72) return 'Arabian Sea';
  if (lon < 80) return 'Western India';
  if (lon < 88) return 'Central India';
  if (lat < 15) return 'Indian Ocean';
  return 'Bay of Bengal';
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
  if (sat.is_simulated || sat.name === 'VIDYAJYOTI') {
    s('sb-gt', groundTrackLabel(pos.lat, pos.lon));
  }
  var simBadge = el('vjSimBadge');
  if (simBadge) simBadge.hidden = !(sat.is_simulated || sat.name === 'VIDYAJYOTI');
  if (typeof window.updatePassCountdown === 'function') window.updatePassCountdown();
  if (typeof window.setPolarTarget === 'function') {
    window.setPolarTarget(angles.az, angles.el);
  }
  if (typeof window.setSignalTarget === 'function') {
    window.setSignalTarget(angles.el);
  }
}

function setLayerOnMap(map, layer, visible) {
  if (!map || !layer) return;
  if (visible) {
    if (!map.hasLayer(layer)) layer.addTo(map);
  } else if (map.hasLayer(layer)) {
    map.removeLayer(layer);
  }
}

function updateSatHighlight() {
  if (!worldLeaflet) return;
  SATS2.forEach(function (sat) {
    var lyr = satLayers[sat.name];
    if (!lyr) return;
    var sel = sat.name === selectedSatName;
    if (lyr.marker.setIcon) {
      lyr.marker.setIcon(satIcon(sat.color, sel));
    }
    if (lyr.marker.setOpacity) lyr.marker.setOpacity(sel ? 1 : 0.35);
    setLayerOnMap(worldLeaflet, lyr.trackLine, sel);
    setLayerOnMap(worldLeaflet, lyr.prevTrack, sel);
    if (sel) {
      lyr.trackLine.setStyle({ opacity: 1, weight: 3 });
      lyr.prevTrack.setStyle({ opacity: 0.45 });
    }
    if (lyr.footprint) {
      if (sel) {
        setLayerOnMap(worldLeaflet, lyr.footprint, true);
        lyr.footprint.setStyle({
          fillOpacity: 0.16,
          opacity: 0.85,
          weight: 2,
          dashArray: '6 4'
        });
        var pos = satPosition(lyr.sat);
        if (pos) {
          lyr.footprint.setLatLng([pos.lat, pos.lon]);
          lyr.footprint.setRadius(footprintRadiusM(pos.alt_km));
        }
      } else {
        setLayerOnMap(worldLeaflet, lyr.footprint, false);
      }
    }
    if (!sel && lyr.marker.closePopup) lyr.marker.closePopup();
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
  SATS2.forEach(function (sat) {
    var lyr = satLayers[sat.name];
    if (lyr && lyr.marker && lyr.marker.closePopup) lyr.marker.closePopup();
  });
  var lyr = satLayers[name];
  if (lyr && worldLeaflet && activeTab === 2 && mapMode === 'map') {
    var pos = satPosition(lyr.sat);
    lyr.marker.setLatLng([pos.lat, pos.lon]);
    lyr.marker.openPopup();
    worldLeaflet.panTo([pos.lat, pos.lon], { animate: true, duration: 0.6 });
    showOrbitSatInfo(true);
  }
  if (globeInstance && globeReady) {
    globeInstance.controls().autoRotateSpeed = 0.15;
    var sat = findSat(name);
    var pos = sat ? satPosition(sat, new Date()) : null;
    if (pos && typeof globeInstance.pointOfView === 'function' && mapMode === 'globe') {
      globeInstance.pointOfView({ lat: pos.lat, lng: pos.lon, altitude: 2.1 }, 900);
    }
    refreshGlobeMarkers(true);
    updateGlobeTracks(true);
    updateGlobeFootprint();
    if (mapMode === 'globe') showOrbitSatInfo(true);
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
      zoomControl: true,
      attributionControl: true,
      worldCopyJump: true,
      minZoom: 1,
      maxZoom: 10,
      maxBounds: [[-85, -180], [85, 180]]
    }).setView([10, 0], 1);
    addReliableTiles(worldLeaflet, 'world');
    L.circleMarker([GS_LAT, GS_LON], { radius: 9, color: '#ff7c3a', fillColor: '#ff7c3a', fillOpacity: 0.95, weight: 2 })
      .addTo(worldLeaflet).bindPopup('<b>GS MUMBAI</b><br>Ground Station · Vidyajyoti');
    L.circle([GS_LAT, GS_LON], { radius: 800000, color: '#ff7c3a', fillColor: '#ff7c3a', fillOpacity: 0.04, weight: 1, dashArray: '6 4' }).addTo(worldLeaflet);
    var date = new Date();
    SATS2.forEach(function (sat) {
      var prevTrack = L.polyline([], { color: sat.color, weight: 1, opacity: 0.28, dashArray: '4 8' });
      var trackLine = L.polyline([], { color: sat.color, weight: 2.2, opacity: 0.75, dashArray: '8 5' });
      var footprint = L.circle([0, 0], {
        radius: footprintRadiusM(400),
        color: sat.color,
        fillColor: sat.color,
        fillOpacity: 0.16,
        weight: 2,
        dashArray: '6 4'
      });
      var marker = L.marker([GS_LAT, GS_LON], { icon: satIcon(sat.color, sat.name === selectedSatName), opacity: sat.name === selectedSatName ? 1 : 0.35 }).addTo(worldLeaflet);
      var startPos = satPosition(sat, date);
      if (startPos) marker.setLatLng([startPos.lat, startPos.lon]);
      marker.on('click', function () { selectSatellite(sat.name); });
      marker.bindPopup(function () {
        if (sat.name !== selectedSatName) return '';
        return satPopupHtml(sat, satPosition(sat));
      });
      satLayers[sat.name] = { sat: sat, prevTrack: prevTrack, trackLine: trackLine, marker: marker, footprint: footprint };
    });
    setMapHint('', false);
    updateSatHighlight();
    updateMttOverlay();
    showOrbitSatInfo(true);
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
    if (globeInstance && globeReady) {
      updateGlobeTracks(true);
      updateGlobeFootprint();
    }
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
        if (lyr.footprint && sat.name === selectedSatName) {
          lyr.footprint.setLatLng([pos.lat, pos.lon]);
          lyr.footprint.setRadius(footprintRadiusM(pos.alt_km));
        }
      });
      updateMttOverlay();
      if (Date.now() - trackRefreshAt > 60000) refreshGroundTracks(false);
    }
    if (activeTab === 2 && mapMode === 'globe' && globeInstance) {
      refreshGlobeMarkers(false);
      updateGlobeFootprint();
      updateMttOverlay();
      updateGlobeTracks(false);
    }
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
  if (globeReady && globeInstance) return;
  if (typeof Globe === 'undefined') return;
  var wrap = el('globeWrap');
  if (!wrap) return;
  try {
    globeInstance = Globe()
    .globeImageUrl(isLightMapTheme() ? GLOBE_IMG_LIGHT : GLOBE_IMG_DARK)
    .backgroundColor('rgba(0,0,0,0)')
    .showAtmosphere(true).atmosphereColor(vjAccentColor()).atmosphereAltitude(0.18)
    .pointsData([])
    .pointAltitude(0.02)
    .pointRadius(0.5)
    .pointColor('color')
    .pointLabel(function (d) { return d.label || d.name; })
    .htmlElementsData([])
    .htmlLat(function (d) { return d.lat; })
    .htmlLng(function (d) { return d.lng; })
    .htmlAltitude(function (d) {
      return d.kind === 'gs' ? 0.02 : (d.name === selectedSatName ? 0.18 : 0.14);
    })
    .htmlElement(function (d) {
      var node = document.createElement('div');
      node.className = 'globe-sat-marker' + (d.kind === 'gs' ? ' globe-gs-marker' : '');
      if (d.kind === 'gs') {
        node.innerHTML = '<div class="globe-gs-dot" title="GS MUMBAI"></div>';
        node.title = 'GS MUMBAI';
      } else {
        var sel = d.selected || d.name === selectedSatName;
        node.innerHTML = satMarkerHtml(d.color, sel, sel ? 36 : 20);
        if (sel) node.innerHTML += '<div class="globe-sat-label">' + d.name + '</div>';
        if (!sel) node.style.opacity = '0.4';
        node.title = d.name;
        node.addEventListener('click', function (evt) {
          evt.preventDefault();
          evt.stopPropagation();
          selectSatellite(d.name);
        });
      }
      return node;
    })
    .pathPoints(function (d) { return d.coords; })
    .pathPointLat(function (p) { return p[0]; })
    .pathPointLng(function (p) { return p[1]; })
    .pathPointAlt(function (p, i, path) {
      if (path && path.kind === 'footprint') return GLOBE_FP_ALT_RING;
      return path && path.name === selectedSatName ? 0.058 : 0.028;
    })
    .pathColor(function (d) {
      if (d.kind === 'footprint') return d.color;
      return d.color;
    })
    .pathStroke(function (d) {
      if (d.kind === 'footprint') return 0.95;
      return d.name === selectedSatName ? 0.65 : 0.35;
    })
    .polygonsData([])
    .polygonGeoJsonGeometry(function (d) { return d.geometry; })
    .polygonAltitude(function (d) { return d.alt != null ? d.alt : GLOBE_FP_ALT_FILL; })
    .polygonCapMaterial(function (d) { return globeFootprintMaterial(d.strokeColor); })
    .polygonSideColor(function () { return 'rgba(0,0,0,0)'; })
    .polygonStrokeColor(function (d) { return d.strokeColor; })
    .polygonCapCurvatureResolution(48)(wrap);
    globeInstance.controls().autoRotate = true;
    globeInstance.controls().autoRotateSpeed = 0.35;
    globeReady = true;
    resizeGlobe();
    updateGlobeData(true);
  } catch (err) {
    console.error('Globe init failed:', err);
    globeReady = false;
    globeInstance = null;
  }
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
  var sat = findSat(selectedSatName);
  if (!sat) return paths;

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
  return paths;
}

function sanitizeGlobePath(coords) {
  if (!coords || !coords.length) return [];
  return coords.filter(function (pt) {
    return pt && pt.length >= 2 && isFinite(pt[0]) && isFinite(pt[1]);
  });
}

function buildGlobeMarkers(date) {
  var htmlMarkers = [{
    lat: GS_LAT,
    lng: GS_LON,
    name: 'GS MUMBAI',
    kind: 'gs',
    color: '#ff7c3a'
  }];
  SATS2.forEach(function (sat) {
    var p = satPosition(sat, date);
    if (!p) return;
    var sel = sat.name === selectedSatName;
    htmlMarkers.push({
      lat: p.lat,
      lng: p.lon,
      name: sat.name,
      color: sat.color,
      kind: 'sat',
      selected: sel
    });
  });
  return htmlMarkers;
}

function computeGlobeMarkersSig(markers) {
  return markers.map(function (m) {
    return m.name + ':' + m.lat.toFixed(1) + ':' + m.lng.toFixed(1) + ':' + (m.name === selectedSatName ? '1' : '0');
  }).join('|');
}

function refreshGlobeMarkers(force) {
  if (!globeInstance) return;
  var date = new Date();
  var markers = buildGlobeMarkers(date);
  var sig = computeGlobeMarkersSig(markers);
  var now = Date.now();
  if (!force && sig === lastGlobeMarkersSig && now - globePosRefreshAt < 2500) return;
  lastGlobeMarkersSig = sig;
  globePosRefreshAt = now;
  globeInstance.htmlElementsData(markers);
  globeInstance.pointsData([]);
}

function updateGlobePoints(date) {
  refreshGlobeMarkers(true);
}

function updateGlobeTracks(force) {
  if (!globeInstance) return;
  var now = Date.now();
  if (!force && now - globeTrackRefreshAt < 45000) return;
  globeTrackPathsCache = buildGlobeTracks(new Date());
  globeTrackRefreshAt = now;
  applyGlobePaths(new Date());
}

function updateGlobeData(forceTracks) {
  if (!globeInstance) return;
  updateGlobePoints(new Date());
  updateGlobeTracks(!!forceTracks);
  updateGlobeFootprint();
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
    setTimeout(function () {
      resizeGlobe();
      refreshGlobeMarkers(true);
      updateGlobeTracks(true);
      updateGlobeFootprint();
      updateMttOverlay();
      showOrbitSatInfo(true);
    }, 80);
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
    indiaLeaflet = L.map(container, { zoomControl: true, attributionControl: true, scrollWheelZoom: true, minZoom: 3, maxZoom: 8 })
      .fitBounds([[6.0, 67.5], [37.5, 97.5]], { padding: [10, 10] });
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

function initMapOverlayToggles() {
  function bindToggle(btnId, panelId) {
    var btn = el(btnId);
    var panel = el(panelId);
    if (!btn || !panel) return;
    btn.addEventListener('click', function () {
      var open = panel.classList.toggle('map-overlay-open');
      btn.classList.toggle('active', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (panel.id === 'mtt') showOrbitSatInfo(true);
      scheduleMapResize();
    });
  }
  bindToggle('togglePolar', 'polarOverlay');
  bindToggle('toggleSig', 'sigOverlay');
  bindToggle('toggleMtt', 'mtt');
}

setTimeout(function () {
  initMapOverlayToggles();
  if (typeof loadPasses === 'function') loadPasses();
}, 200);
