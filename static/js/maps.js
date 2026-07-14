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
var GLOBE_PATH_ALT = 0.05;
var GLOBE_FP_ALT = 0.035;
var GLOBE_FP_RING_ALT = 0.038;
var globeTrackPathsCache = [];
var lastGlobeMarkersSig = '';
var mapUserFocusUntil = 0;
var flatMapFocusMoveId = 0;

window.suppressWorldMapFit = function (ms) {
  mapUserFocusUntil = Date.now() + (ms || 2000);
};

var FALLBACK_SATS = [
  { name: 'VIDYAJYOTI', norad_id: null, color: '#4d9fff', is_simulated: true, status: 'simulated', tle_available: false },
  { name: 'VO-52', norad_id: 32791, color: '#9d6fff', is_simulated: false, status: 'unknown', tle_available: false },
  { name: 'SO-50', norad_id: 27607, color: '#ff7c3a', is_simulated: false, status: 'unknown', tle_available: false },
  { name: 'AO-27', norad_id: 22825, color: '#ffc444', is_simulated: false, status: 'unknown', tle_available: false },
  { name: 'FO-29', norad_id: 24278, color: '#ff4466', is_simulated: false, status: 'unknown', tle_available: false },
  { name: 'HO-68', norad_id: 36122, color: '#00e5a0', is_simulated: false, status: 'unknown', tle_available: false },
  { name: 'Cartosat-2F', norad_id: 43111, color: '#56d4ff', is_simulated: false, status: 'unknown', tle_available: false },
  { name: 'RISAT-2B', norad_id: 44233, color: '#ff9933', is_simulated: false, status: 'unknown', tle_available: false },
  { name: 'Sentinel-2A', norad_id: 40697, color: '#7dffb3', is_simulated: false, status: 'unknown', tle_available: false },
  { name: 'Resourcesat-2A', norad_id: 41877, color: '#e879f9', is_simulated: false, status: 'unknown', tle_available: false }
];

var SAT_META = {
  VIDYAJYOTI: { code: 'SAT-01 \u00b7 LEO \u00b7 SIMULATED', label: 'VIDYAJYOTI<br>SAT-01', purpose: 'Earth Observation \u00b7 Climate Monitoring \u00b7 Amateur Radio (simulated)' },
  'VO-52': { code: 'HAMSAT \u00b7 LEO \u00b7 CelesTrak', label: 'VO-52<br>HAMSAT', purpose: 'Amateur radio communications \u00b7 India' },
  'SO-50': { code: 'SaudiSat \u00b7 LEO \u00b7 CelesTrak', label: 'SO-50<br>SaudiSat-1C', purpose: 'Amateur radio repeater satellite' },
  'AO-27': { code: 'AMRAD \u00b7 LEO \u00b7 CelesTrak', label: 'AO-27<br>AMRAD-OSCAR', purpose: 'Amateur radio communications' },
  'FO-29': { code: 'FujiSat \u00b7 LEO \u00b7 CelesTrak', label: 'FO-29<br>Fuji-OSCAR', purpose: 'Amateur radio \u00b7 Store-and-forward' },
  'HO-68': { code: 'XW-1 \u00b7 LEO \u00b7 CelesTrak', label: 'HO-68<br>XW-1', purpose: 'Amateur radio \u00b7 Hope Oscar' },
  'Cartosat-2F': { code: 'EO \u00b7 ISRO \u00b7 LEO \u00b7 CelesTrak', label: 'Cartosat-2F<br>ISRO', purpose: 'Remote Sensing \u00b7 ISRO \u00b7 High-res optical imaging', category: 'eo', sensor: 'Optical', swath_km: 9.6 },
  'RISAT-2B': { code: 'EO \u00b7 ISRO \u00b7 LEO \u00b7 CelesTrak', label: 'RISAT-2B<br>ISRO', purpose: 'Remote Sensing \u00b7 ISRO \u00b7 SAR radar imaging', category: 'eo', sensor: 'SAR Radar', swath_km: 120 },
  'Sentinel-2A': { code: 'EO \u00b7 ESA \u00b7 LEO \u00b7 CelesTrak', label: 'Sentinel-2A<br>ESA', purpose: 'Remote Sensing \u00b7 ESA \u00b7 Multispectral Earth observation', category: 'eo', sensor: 'Multispectral', swath_km: 290 },
  'Resourcesat-2A': { code: 'EO \u00b7 ISRO \u00b7 LEO \u00b7 CelesTrak', label: 'Resourcesat-2A<br>ISRO', purpose: 'Remote Sensing \u00b7 ISRO \u00b7 Land and water monitoring', category: 'eo', sensor: 'Multispectral', swath_km: 70 }
};

function getSatMeta(name) {
  return SAT_META[name] || { code: name, label: name, purpose: 'Tracked satellite' };
}

function isEoSatellite(name) {
  var meta = getSatMeta(name);
  return meta.category === 'eo';
}

/* Carto base (clean orbit-tracker look) + Esri English labels + India boundary overlay. */
var CARTO_DARK_BASE = 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png';
var CARTO_LIGHT_BASE = 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png';
var CARTO_VOYAGER_BASE = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png';
var EN_LABELS_DARK = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}';
var EN_LABELS_LIGHT = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}';
var MAP_TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.esri.com/">Esri</a>';
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
var WORLD_BOUNDS = L.latLngBounds([[-85, -180], [85, 180]]);
var mapTileLayers = { world: null, india: null };
var indiaBoundaryLayers = {};
var GLOBE_IMG_DARK = 'https://unpkg.com/three-globe/example/img/earth-night.jpg';
var GLOBE_IMG_LIGHT = 'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg';

function isLightMapTheme() {
  return document.documentElement.getAttribute('data-theme') === 'light';
}

function cartoBaseOptions(minZoom) {
  return {
    attribution: MAP_TILE_ATTR,
    subdomains: 'abcd',
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
  if (isLightMapTheme()) {
    return [
      L.tileLayer(CARTO_LIGHT_BASE, cartoBaseOptions(1)),
      L.tileLayer(EN_LABELS_LIGHT, englishLabelOptions())
    ];
  }
  return [
    L.tileLayer(CARTO_DARK_BASE, cartoBaseOptions(1)),
    L.tileLayer(EN_LABELS_DARK, englishLabelOptions())
  ];
}

function createIndiaMapLayers() {
  if (isLightMapTheme()) {
    return [
      L.tileLayer(CARTO_VOYAGER_BASE, cartoBaseOptions(3)),
      L.tileLayer(EN_LABELS_LIGHT, englishLabelOptions())
    ];
  }
  return [
    L.tileLayer(CARTO_DARK_BASE, cartoBaseOptions(3)),
    L.tileLayer(EN_LABELS_DARK, englishLabelOptions())
  ];
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

function eoMarkerHtml(color, selected, size) {
  size = size || (selected ? 34 : 28);
  var stroke = selected ? 2.2 : 1.6;
  return '<div class="sat-marker-wrap eo' + (selected ? ' sel' : '') + '" style="color:' + color + '">' +
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="' + size + '" height="' + size + '" aria-hidden="true">' +
    '<rect x="7" y="11" width="18" height="13" rx="2.5" fill="none" stroke="' + color + '" stroke-width="' + stroke + '"/>' +
    '<circle cx="16" cy="17.5" r="4.5" fill="' + color + '" opacity="0.35"/>' +
    '<circle cx="16" cy="17.5" r="2.2" fill="' + color + '" stroke="#fff" stroke-width="' + stroke + '"/>' +
    '<path d="M12 11 L16 7 L20 11" fill="none" stroke="' + color + '" stroke-width="' + stroke + '"/>' +
    '</svg></div>';
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

function satIcon(color, selected, name) {
  var size = selected ? 34 : 28;
  var html = isEoSatellite(name) ? eoMarkerHtml(color, selected, size) : satMarkerHtml(color, selected, size);
  return L.divIcon({
    className: 'sat-marker-icon',
    html: html,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2]
  });
}

function configureLeafletAssets() {
  if (typeof L === 'undefined') return false;
  if (L.Icon.Default.prototype._vjConfigured) return true;
  // Leaflet's default marker images are not bundled in this repo.
  // Use a 1x1 transparent PNG so Leaflet doesn't spam 404s.
  var base = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO1pB0UAAAAASUVORK5CYII=';
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: base,
    iconUrl: base,
    shadowUrl: base
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

function scheduleMapResize(opts) {
  opts = opts || {};
  var fitWorld = opts.fitWorld !== false;
  var delays = opts.delays || [0, 150, 400];
  delays.forEach(function (ms, index) {
    setTimeout(function () {
      if (worldLeaflet) {
        worldLeaflet.invalidateSize(true);
        var isLast = index === delays.length - 1;
        if (fitWorld && isLast && Date.now() > mapUserFocusUntil) {
          fitWorldMapView(worldLeaflet);
        }
      }
      if (indiaLeaflet) indiaLeaflet.invalidateSize(true);
      resizeGlobe();
    }, ms);
  });
}

function focusFlatMapOnSatellite(lat, lon, marker) {
  if (!worldLeaflet) return;
  mapUserFocusUntil = Date.now() + 1800;
  var moveId = ++flatMapFocusMoveId;
  var zoom = Math.max(worldLeaflet.getZoom(), 3);
  worldLeaflet.stop();
  worldLeaflet.flyTo([lat, lon], zoom, { animate: true, duration: 0.65 });
  worldLeaflet.once('moveend', function () {
    if (moveId !== flatMapFocusMoveId) return;
    if (marker && marker.openPopup) marker.openPopup();
  });
}

function fitWorldMapView(map) {
  if (!map) return;
  // Keep a full-world overview (poles visible); do not clamp/fit to a tight bbox.
  map.setView([20, 0], 2, { animate: false });
}

function trackLineStyle(color, selected) {
  return {
    color: color,
    weight: selected ? 3 : 2.2,
    opacity: selected ? 1 : 0.35,
    dashArray: '8 5',
    lineCap: 'round',
    lineJoin: 'round'
  };
}

function rebuildTrackGroup(group, coords, style) {
  if (!group) return;
  group.clearLayers();
  if (!coords || !coords.length) return;
  // One polyline per antimeridian-safe segment (no world-wrap copies / diagonal joins).
  var segments = splitPathAtDateline(coords);
  segments.forEach(function (seg) {
    if (seg.length < 2) return;
    L.polyline(seg, style).addTo(group);
  });
}

function buildFlatGroundTrack(name, date) {
  if (typeof VjOrbit === 'undefined') return { forward: [], backward: [] };
  var forward = sanitizeGlobePath(VjOrbit.buildGroundTrack(name, date, 120));
  var backward = sanitizeGlobePath(VjOrbit.buildPreviousTrack(name, date, 60));
  return { forward: forward, backward: backward };
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

function footprintRadiusForSat(sat, altKm) {
  var meta = sat ? getSatMeta(sat.name) : null;
  if (meta && meta.swath_km) {
    return Math.max(meta.swath_km * 500, 30000);
  }
  return footprintRadiusM(altKm || 400);
}

function inclinationFromSat(sat) {
  if (!sat) return null;
  if (sat.is_simulated) return 97.4;
  var line2 = sat.line2;
  if (!line2 && typeof VjOrbit !== 'undefined') {
    var meta = VjOrbit.getMeta(sat.name);
    line2 = meta && meta.line2;
  }
  if (!line2) return null;
  var inc = parseFloat(String(line2).trim().split(/\s+/)[2]);
  return isFinite(inc) ? inc : null;
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

function pathCoordsWithAlt(coords, alt) {
  alt = alt != null ? alt : GLOBE_PATH_ALT;
  return coords.map(function (pt) {
    return [pt[0], pt[1], alt];
  });
}

function buildGlobeFootprintPolygons(date) {
  var sat = findSat(selectedSatName);
  if (!sat) return [];
  var pos = satPosition(sat, date || new Date());
  if (!pos) return [];
  var color = sat.color || '#4d9fff';
  var radiusM = footprintRadiusForSat(sat, pos.alt_km);
  return [{
    name: sat.name,
    geometry: {
      type: 'Polygon',
      coordinates: [circleRingCoords(pos.lat, pos.lon, radiusM)]
    },
    strokeColor: color,
    capColor: satColorRgba(color, 0.42)
  }];
}

function buildGlobeFootprintPath(date) {
  var sat = findSat(selectedSatName);
  if (!sat) return null;
  var pos = satPosition(sat, date || new Date());
  if (!pos) return null;
  var color = sat.color || '#4d9fff';
  var ring = circleRingCoordsLatLng(pos.lat, pos.lon, footprintRadiusForSat(sat, pos.alt_km));
  return {
    name: sat.name + '-footprint',
    color: color,
    coords: pathCoordsWithAlt(ring, GLOBE_FP_RING_ALT)
  };
}

function buildGlobeFootprintRings(date) {
  var sat = findSat(selectedSatName);
  if (!sat) return [];
  var pos = satPosition(sat, date || new Date());
  if (!pos) return [];
  var radiusDeg = (footprintRadiusForSat(sat, pos.alt_km) / 6378137) * (180 / Math.PI);
  return [{
    lat: pos.lat,
    lng: pos.lon,
    maxR: radiusDeg,
    color: sat.color || '#4d9fff',
    propagationSpeed: 0
  }];
}

function updateGlobeScene(forceTracks) {
  if (!globeInstance || !globeReady) return;
  var date = new Date();
  if (forceTracks || !globeTrackPathsCache.length || (Date.now() - globeTrackRefreshAt > 30000)) {
    globeTrackPathsCache = buildGlobeTracks(date);
    globeTrackRefreshAt = Date.now();
  }
  var paths = globeTrackPathsCache.slice();
  var fpPath = buildGlobeFootprintPath(date);
  if (fpPath) paths.push(fpPath);
  globeInstance.arcsData([]);
  globeInstance.pathsData(paths);
  globeInstance.polygonsData(buildGlobeFootprintPolygons(date));
  globeInstance.ringsData(buildGlobeFootprintRings(date));
}

function satPopupHtml(sat, pos) {
  var meta = getSatMeta(sat.name);
  var sim = sat.is_simulated;
  var norad = sat.norad_id ? 'NORAD ' + sat.norad_id : '';
  var src = sim ? '<br><em>Simulated — mission data not public</em>' : (norad ? '<br>' + norad + ' · CelesTrak TLE' : '');
  var eo = meta.category === 'eo'
    ? '<br><span style="color:#7dffb3">EO · ' + (meta.sensor || 'Remote Sensing') + '</span>' +
      (meta.swath_km ? '<br>Imaging swath ~' + meta.swath_km + ' km' : '')
    : '';
  return '<b>' + sat.name + '</b>' + src + eo +
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
  // Live ESP32 GPS overrides the status-bar position fields when available.
  if (typeof hasLiveGpsFix === 'function' && hasLiveGpsFix()) {
    if (typeof syncOrbitTrackerGpsBar === 'function') syncOrbitTrackerGpsBar();
  } else {
    s('sb-lat', Math.abs(pos.lat).toFixed(2) + deg + (pos.lat >= 0 ? 'N' : 'S'));
    s('sb-lon', Math.abs(pos.lon).toFixed(2) + deg + (pos.lon >= 0 ? 'E' : 'W'));
    s('sb-alt', pos.alt_km.toFixed(1) + ' km');
    s('sb-vel', (pos.velocity || 0).toFixed(3) + ' km/s');
    if (sat.is_simulated || sat.name === 'VIDYAJYOTI') {
      s('sb-gt', groundTrackLabel(pos.lat, pos.lon));
    } else if (isEoSatellite(sat.name)) {
      var eoMeta = getSatMeta(sat.name);
      s('sb-gt', 'Swath ~' + (eoMeta.swath_km || '?') + ' km · ' + (eoMeta.sensor || 'EO'));
    }
  }
  var simBadge = el('vjSimBadge');
  if (simBadge) {
    if (typeof hasLiveGpsFix === 'function' && hasLiveGpsFix()) {
      simBadge.hidden = false;
      simBadge.textContent = 'Live GPS';
    } else {
      simBadge.hidden = !(sat.is_simulated || sat.name === 'VIDYAJYOTI');
      simBadge.textContent = 'Simulated telemetry';
    }
  }
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

function setGroupStyle(group, style) {
  if (!group || !group.eachLayer) return;
  group.eachLayer(function (layer) {
    if (layer.setStyle) layer.setStyle(style);
  });
}

function updateSatHighlight() {
  if (!worldLeaflet) return;
  SATS2.forEach(function (sat) {
    var lyr = satLayers[sat.name];
    if (!lyr) return;
    var sel = sat.name === selectedSatName;
    var isEo = isEoSatellite(sat.name);
    if (lyr.marker.setIcon) {
      lyr.marker.setIcon(satIcon(sat.color, sel, sat.name));
    }
    if (lyr.marker.setOpacity) lyr.marker.setOpacity(sel ? 1 : 0.35);
    setLayerOnMap(worldLeaflet, lyr.trackGroup, sel);
    if (sel && lyr.trackGroup) {
      setGroupStyle(lyr.trackGroup, trackLineStyle(sat.color, true));
    }
    if (lyr.footprint) {
      // Always show EO footprint radius (dimmed when not selected).
      var visible = sel || isEo;
      setLayerOnMap(worldLeaflet, lyr.footprint, visible);
      if (visible) {
        lyr.footprint.setStyle({
          fillOpacity: isEo ? (sel ? 0.12 : 0.05) : (sel ? 0.16 : 0.0),
          opacity: isEo ? (sel ? 0.9 : 0.35) : (sel ? 0.85 : 0.0),
          weight: isEo ? (sel ? 2.6 : 1.6) : (sel ? 2 : 0.0),
          dashArray: isEo ? (sel ? '10 6' : '8 8') : '6 4'
        });
        var pos = satPosition(lyr.sat);
        if (pos) {
          lyr.footprint.setLatLng([pos.lat, pos.lon]);
          lyr.footprint.setRadius(footprintRadiusForSat(lyr.sat, pos.alt_km));
        }
      }
    }
    if (!sel && lyr.marker.closePopup) lyr.marker.closePopup();
  });
}

function updateRightPanel(name) {
  var meta = getSatMeta(name);
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
  var eoBadge = el('sic-eo-badge');
  if (codeEl) codeEl.textContent = meta.code;
  if (nameEl) nameEl.innerHTML = meta.label;
  if (purposeEl) purposeEl.textContent = meta.purpose;
  if (eoBadge) {
    if (meta.category === 'eo') {
      eoBadge.hidden = false;
      eoBadge.textContent = 'Earth Observation · ' + (meta.sensor || 'Remote Sensing') +
        (meta.swath_km ? ' · Swath ' + meta.swath_km + ' km' : '');
    } else {
      eoBadge.hidden = true;
    }
  }
  if (pos) {
    s('rm-alt', Math.round(pos.alt_km));
    s('rm-vel', (pos.velocity || 0).toFixed(1));
  }
  var inc = inclinationFromSat(sat);
  if (inc != null) s('rm-inc', inc.toFixed(1));
  if (passRow && passRow.orbit_min && passRow.orbit_min !== '-') {
    s('rm-per', passRow.orbit_min);
  } else if (typeof VjOrbit !== 'undefined' && VjOrbit.orbitPeriodMinutes) {
    s('rm-per', Math.round(VjOrbit.orbitPeriodMinutes(name)));
  }
  document.querySelectorAll('.launch-item').forEach(function (x) { x.classList.remove('launch-sel'); });
}

var eoImageryRequestId = 0;
var eoImageryDisplayedKey = '';
var eoImageryInFlightKey = '';
var eoImageryRefreshAt = 0;
var eoImageryBlobUrl = '';
var eoImageryLastData = null;

function formatNadirCoords(lat, lon) {
  var latH = lat >= 0 ? 'N' : 'S';
  var lonH = lon >= 0 ? 'E' : 'W';
  return Math.abs(lat).toFixed(2) + '°' + latH + ', ' + Math.abs(lon).toFixed(2) + '°' + lonH;
}

function setEoImageryStatus(state) {
  var tag = el('eo-imagery-tag');
  if (!tag) return;
  tag.classList.remove('is-loading', 'is-error');
  if (state === 'loading') {
    tag.textContent = 'Loading';
    tag.classList.add('is-loading');
  } else if (state === 'ready') {
    tag.textContent = 'Scene ready';
  } else if (state === 'error') {
    tag.textContent = 'No feed';
    tag.classList.add('is-error');
  } else {
    tag.textContent = 'EO feed';
  }
}

function renderEoImageryMeta(target, data) {
  if (!target || !data) return;
  var rows = [
    ['View type', data.view_label || 'Ground scene'],
    ['Satellite', data.satellite || '—'],
    ['Data source', data.source || '—'],
    ['Nadir point', formatNadirCoords(data.nadir_lat, data.nadir_lon)],
    ['Scene date', data.captured_at ? data.captured_at.slice(0, 10) : 'Not available'],
    ['Cloud cover', data.cloud_cover != null ? data.cloud_cover.toFixed(0) + '%' : '—']
  ];
  target.innerHTML = rows.map(function (row) {
    return '<div class="eo-meta-row"><span class="eo-meta-label">' + row[0] +
      '</span><span class="eo-meta-value">' + row[1] + '</span></div>';
  }).join('');
}

function setEoImageryFrameEnabled(enabled) {
  var frame = el('eo-imagery-frame');
  var hint = el('eo-imagery-expand-hint');
  if (frame) frame.disabled = !enabled;
  if (hint) hint.hidden = !enabled;
}

function resetEoImageryPreview() {
  closeEoImageryModal();
  var img = el('eo-imagery-img');
  var loading = el('eo-imagery-loading');
  if (img) {
    img.hidden = true;
    img.style.opacity = '0';
    img.removeAttribute('src');
  }
  if (loading) loading.hidden = false;
  setEoImageryFrameEnabled(false);
}

function assignEoImageryBlob(blob, img, reqId) {
  return new Promise(function (resolve, reject) {
    var nextUrl = URL.createObjectURL(blob);
    if (!img) {
      if (eoImageryBlobUrl) URL.revokeObjectURL(eoImageryBlobUrl);
      eoImageryBlobUrl = nextUrl;
      resolve();
      return;
    }
    img.onload = function () {
      if (reqId !== eoImageryRequestId) {
        URL.revokeObjectURL(nextUrl);
        return;
      }
      var prev = eoImageryBlobUrl;
      eoImageryBlobUrl = nextUrl;
      if (prev && prev !== nextUrl) URL.revokeObjectURL(prev);
      img.hidden = false;
      img.style.opacity = '1';
      resolve();
    };
    img.onerror = function () {
      URL.revokeObjectURL(nextUrl);
      reject(new Error('preview decode failed'));
    };
    img.src = nextUrl;
  });
}

function openEoImageryModal() {
  if (!eoImageryBlobUrl || !eoImageryLastData) return;
  var modal = el('eo-imagery-modal');
  var modalImg = el('eo-imagery-modal-img');
  var modalMeta = el('eo-imagery-modal-meta');
  var modalTitle = el('eo-imagery-modal-title');
  if (!modal || !modalImg) return;
  modalImg.src = eoImageryBlobUrl;
  if (modalTitle) {
    modalTitle.textContent = (eoImageryLastData.satellite || 'Satellite') + ' — nadir ground scene';
  }
  renderEoImageryMeta(modalMeta, eoImageryLastData);
  modal.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeEoImageryModal() {
  var modal = el('eo-imagery-modal');
  if (!modal) return;
  modal.hidden = true;
  document.body.style.overflow = '';
}

function initEoImageryModal() {
  var frame = el('eo-imagery-frame');
  var backdrop = el('eo-imagery-modal-backdrop');
  var closeBtn = el('eo-imagery-modal-close');
  if (frame) {
    frame.addEventListener('click', function () {
      if (!frame.disabled) openEoImageryModal();
    });
  }
  if (backdrop) backdrop.addEventListener('click', closeEoImageryModal);
  if (closeBtn) closeBtn.addEventListener('click', closeEoImageryModal);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeEoImageryModal();
  });
}

async function loadEoImagery(satName, force) {
  var panel = el('eo-imagery-panel');
  if (!panel) return;
  if (!isEoSatellite(satName)) {
    panel.hidden = true;
    eoImageryDisplayedKey = '';
    eoImageryInFlightKey = '';
    eoImageryLastData = null;
    setEoImageryFrameEnabled(false);
    return;
  }
  if (typeof useApi !== 'undefined' && !useApi) {
    panel.hidden = false;
    var offlineMeta = el('eo-imagery-meta');
    var offlineLoading = el('eo-imagery-loading');
    if (offlineMeta) {
      offlineMeta.innerHTML = '<div class="eo-meta-row"><span class="eo-meta-label">Status</span>' +
        '<span class="eo-meta-value">Live server required</span></div>';
    }
    if (offlineLoading) offlineLoading.hidden = true;
    setEoImageryStatus('error');
    setEoImageryFrameEnabled(false);
    return;
  }
  var sat = findSat(satName);
  var pos = sat ? satPosition(sat) : null;
  if (!pos) {
    panel.hidden = true;
    return;
  }

  panel.hidden = false;
  var img = el('eo-imagery-img');
  var loading = el('eo-imagery-loading');
  var meta = el('eo-imagery-meta');
  var disclaimer = el('eo-imagery-disclaimer');
  var key = satName + ':' + pos.lat.toFixed(1) + ':' + pos.lon.toFixed(1);

  if (!force && key === eoImageryDisplayedKey) return;
  if (!force && key === eoImageryInFlightKey) return;
  eoImageryInFlightKey = key;
  setEoImageryStatus('loading');
  resetEoImageryPreview();

  if (meta) {
    meta.innerHTML = '<div class="eo-meta-row"><span class="eo-meta-label">Status</span>' +
      '<span class="eo-meta-value">Fetching scene near nadir…</span></div>';
  }
  if (disclaimer) disclaimer.textContent = '';

  var reqId = ++eoImageryRequestId;
  try {
    var url = '/api/eo-imagery?lat=' + encodeURIComponent(pos.lat) +
      '&lon=' + encodeURIComponent(pos.lon) +
      '&sat=' + encodeURIComponent(satName);
    var res = typeof apiFetch === 'function'
      ? await apiFetch(url)
      : await fetch(url, { credentials: 'same-origin' });
    if (reqId !== eoImageryRequestId) return;
    if (!res || !res.ok) {
      eoImageryInFlightKey = '';
      setEoImageryStatus('error');
      if (meta) {
        meta.innerHTML = '<div class="eo-meta-row"><span class="eo-meta-label">Status</span>' +
          '<span class="eo-meta-value">Imagery unavailable</span></div>';
      }
      if (loading) loading.hidden = true;
      return;
    }
    var data = await res.json();
    if (reqId !== eoImageryRequestId) return;
    eoImageryLastData = data;
    if (!data.image_url) {
      eoImageryInFlightKey = '';
      setEoImageryStatus('error');
      if (meta) {
        meta.innerHTML = '<div class="eo-meta-row"><span class="eo-meta-label">Status</span>' +
          '<span class="eo-meta-value">No archived scene at this nadir</span></div>';
      }
      if (loading) loading.hidden = true;
      return;
    }
    renderEoImageryMeta(meta, data);
    if (disclaimer) {
      disclaimer.textContent = data.disclaimer ||
        'Nearest archived pass at the satellite ground position — not a live downlink feed.';
    }

    var imgRes = typeof apiFetch === 'function'
      ? await apiFetch(data.image_url)
      : await fetch(data.image_url, { credentials: 'same-origin' });
    if (reqId !== eoImageryRequestId) return;
    if (!imgRes || !imgRes.ok) {
      eoImageryInFlightKey = '';
      setEoImageryStatus('error');
      if (loading) loading.hidden = true;
      if (meta) {
        meta.innerHTML = '<div class="eo-meta-row"><span class="eo-meta-label">Status</span>' +
          '<span class="eo-meta-value">Preview could not be loaded</span></div>';
      }
      return;
    }
    var blob = await imgRes.blob();
    if (reqId !== eoImageryRequestId) return;
    if (!blob.type || blob.type.indexOf('image/') !== 0 || blob.size < 3500) {
      eoImageryInFlightKey = '';
      setEoImageryStatus('error');
      if (loading) loading.hidden = true;
      if (meta) {
        meta.innerHTML = '<div class="eo-meta-row"><span class="eo-meta-label">Status</span>' +
          '<span class="eo-meta-value">Scene tile was empty — try again shortly</span></div>';
      }
      return;
    }
    try {
      await assignEoImageryBlob(blob, img, reqId);
    } catch (assignErr) {
      if (reqId !== eoImageryRequestId) return;
      eoImageryInFlightKey = '';
      setEoImageryStatus('error');
      if (loading) loading.hidden = true;
      if (meta) {
        meta.innerHTML = '<div class="eo-meta-row"><span class="eo-meta-label">Status</span>' +
          '<span class="eo-meta-value">Preview could not be displayed</span></div>';
      }
      return;
    }
    if (reqId !== eoImageryRequestId) return;
    eoImageryDisplayedKey = key;
    eoImageryInFlightKey = '';
    if (loading) loading.hidden = true;
    setEoImageryStatus('ready');
    setEoImageryFrameEnabled(true);
  } catch (err) {
    if (reqId !== eoImageryRequestId) return;
    eoImageryInFlightKey = '';
    setEoImageryStatus('error');
    setEoImageryFrameEnabled(false);
    if (meta) {
      meta.innerHTML = '<div class="eo-meta-row"><span class="eo-meta-label">Status</span>' +
        '<span class="eo-meta-value">Failed to load imagery</span></div>';
    }
    if (loading) loading.hidden = true;
  }
}

function maybeRefreshEoImagery() {
  if (!isEoSatellite(selectedSatName)) return;
  var now = Date.now();
  if (now - eoImageryRefreshAt < 90000) return;
  var sat = findSat(selectedSatName);
  var pos = sat ? satPosition(sat) : null;
  if (!pos) return;
  var key = selectedSatName + ':' + pos.lat.toFixed(1) + ':' + pos.lon.toFixed(1);
  if (key === eoImageryDisplayedKey || key === eoImageryInFlightKey) return;
  eoImageryRefreshAt = now;
  loadEoImagery(selectedSatName);
}

function selectSatellite(name) {
  selectedSatName = name;
  syncFlatMapLayers();
  updateMttOverlay();
  updateRightPanel(name);
  loadEoImagery(name, true);
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
    refreshGroundTracks(true);
    var pos = satPosition(lyr.sat);
    if (pos) {
      lyr.marker.setLatLng([pos.lat, pos.lon]);
      focusFlatMapOnSatellite(pos.lat, pos.lon, lyr.marker);
    }
    showOrbitSatInfo(true);
  }
  if (globeInstance && globeReady) {
    globeInstance.controls().autoRotateSpeed = 0.15;
    var sat = findSat(name);
    var pos = sat ? satPosition(sat, new Date()) : null;
    if (pos && typeof globeInstance.pointOfView === 'function' && mapMode === 'globe') {
      globeInstance.pointOfView({ lat: pos.lat, lng: pos.lon, altitude: 2.1 }, 900);
    }
    globeTrackPathsCache = [];
    refreshGlobeMarkers(true);
    updateGlobeScene(true);
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
    var sel = sat.name === selectedSatName;
    var tracks = buildFlatGroundTrack(sat.name, date);
    lyr.trackGroup.clearLayers();
    if (tracks.backward && tracks.backward.length > 1) {
      var bkStyle = trackLineStyle(sat.color, sel);
      bkStyle.opacity = sel ? 0.45 : 0.2;
      bkStyle.dashArray = '4 8';
      splitPathAtDateline(tracks.backward).forEach(function (seg) {
        if (seg.length >= 2) L.polyline(seg, bkStyle).addTo(lyr.trackGroup);
      });
    }
    if (tracks.forward && tracks.forward.length > 1) {
      var fwStyle = trackLineStyle(sat.color, sel);
      splitPathAtDateline(tracks.forward).forEach(function (seg) {
        if (seg.length >= 2) L.polyline(seg, fwStyle).addTo(lyr.trackGroup);
      });
    }
  });
}

function createFlatSatLayer(sat, date) {
  var isEo = isEoSatellite(sat.name);
  var sel = sat.name === selectedSatName;
  var trackGroup = L.layerGroup();
  var footprint = L.circle([0, 0], {
    radius: footprintRadiusForSat(sat, 400),
    color: sat.color,
    fillColor: sat.color,
    fillOpacity: isEo ? 0.1 : 0.16,
    weight: isEo ? 2.5 : 2,
    dashArray: isEo ? '10 6' : '6 4'
  });
  var marker = L.marker([GS_LAT, GS_LON], {
    icon: satIcon(sat.color, sel, sat.name),
    opacity: sel ? 1 : 0.45
  });
  if (worldLeaflet) marker.addTo(worldLeaflet);
  var startPos = satPosition(sat, date);
  if (startPos) marker.setLatLng([startPos.lat, startPos.lon]);
  marker.on('click', function (e) {
    if (e && e.originalEvent) L.DomEvent.stopPropagation(e);
    selectSatellite(sat.name);
  });
  marker.bindPopup(function () {
    if (sat.name !== selectedSatName) return '';
    var pos = satPosition(sat);
    return pos ? satPopupHtml(sat, pos) : '';
  }, { autoPan: false, maxWidth: 300 });
  return {
    sat: sat,
    trackGroup: trackGroup,
    trackLine: trackGroup,
    marker: marker,
    footprint: footprint
  };
}

function syncFlatMapLayers() {
  if (!worldLeaflet) return;
  var date = new Date();
  SATS2.forEach(function (sat) {
    if (satLayers[sat.name]) {
      satLayers[sat.name].sat = sat;
      return;
    }
    satLayers[sat.name] = createFlatSatLayer(sat, date);
  });
  updateSatHighlight();
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
      maxZoom: 10
    });
    addReliableTiles(worldLeaflet, 'world');
    worldLeaflet.setView([20, 0], 2);
    L.circleMarker([GS_LAT, GS_LON], { radius: 9, color: '#ff7c3a', fillColor: '#ff7c3a', fillOpacity: 0.95, weight: 2 })
      .addTo(worldLeaflet).bindPopup('<b>GS MUMBAI</b><br>Ground Station · Vidyajyoti');
    L.circle([GS_LAT, GS_LON], { radius: 800000, color: '#ff7c3a', fillColor: '#ff7c3a', fillOpacity: 0.04, weight: 1, dashArray: '6 4' }).addTo(worldLeaflet);
    syncFlatMapLayers();
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
    syncFlatMapLayers();
    refreshGroundTracks(true);
    if (globeInstance && globeReady) {
      updateGlobeScene(true);
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
        if (lyr.footprint && (sat.name === selectedSatName || isEoSatellite(sat.name))) {
          lyr.footprint.setLatLng([pos.lat, pos.lon]);
          lyr.footprint.setRadius(footprintRadiusForSat(lyr.sat, pos.alt_km));
        }
      });
      updateMttOverlay();
      if (Date.now() - trackRefreshAt > 60000) refreshGroundTracks(false);
      maybeRefreshEoImagery();
    }
    if (activeTab === 2 && mapMode === 'globe' && globeInstance) {
      refreshGlobeMarkers(false);
      updateGlobeScene(false);
      updateMttOverlay();
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
  if (typeof Globe === 'undefined') return;
  var wrap = el('globeWrap');
  if (!wrap) return;
  if (globeReady && globeInstance) {
    resizeGlobe();
    updateGlobeScene(true);
    return;
  }
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
    .pathPointAlt(function (p) {
      return (Array.isArray(p) && p.length > 2 && isFinite(p[2])) ? p[2] : GLOBE_PATH_ALT;
    })
    .pathColor(function (d) { return d.color; })
    .pathTransitionDuration(0)
    .ringsData([])
    .ringLat('lat')
    .ringLng('lng')
    .ringMaxRadius('maxR')
    .ringColor(function (d) { return d.color; })
    .ringPropagationSpeed('propagationSpeed')
    .ringAltitude(GLOBE_FP_RING_ALT)
    .ringRepeatPeriod(999999)
    .polygonsData([])
    .polygonGeoJsonGeometry(function (d) { return d.geometry; })
    .polygonAltitude(GLOBE_FP_ALT)
    .polygonCapColor(function (d) { return d.capColor; })
    .polygonSideColor(function () { return 'rgba(0,0,0,0)'; })
    .polygonStrokeColor(function (d) { return d.strokeColor; })(wrap);
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
    // Hard break on antimeridian wraps so Leaflet never draws a diagonal across the map.
    if (current.length) {
      var prev = current[current.length - 1];
      if (Math.abs(pt[1] - prev[1]) > 180) {
        if (current.length >= 2) segments.push(current);
        current = [];
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
        coords: pathCoordsWithAlt(seg, GLOBE_PATH_ALT),
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

function updateGlobeData(forceTracks) {
  if (!globeInstance) return;
  refreshGlobeMarkers(true);
  updateGlobeScene(!!forceTracks);
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
      globeTrackPathsCache = [];
      refreshGlobeMarkers(true);
      updateGlobeScene(true);
      updateMttOverlay();
      showOrbitSatInfo(true);
    }, 80);
  } else {
    gw.style.display = 'none';
    wl.style.display = 'block';
    if (worldLeaflet) setTimeout(function () {
      fitWorldMapView(worldLeaflet);
      refreshGroundTracks(true);
    }, 80);
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
      scheduleMapResize({ fitWorld: false });
    });
  }
  bindToggle('togglePolar', 'polarOverlay');
  bindToggle('toggleSig', 'sigOverlay');
  bindToggle('toggleMtt', 'mtt');
}

setTimeout(function () {
  initMapOverlayToggles();
  initEoImageryModal();
  if (typeof loadPasses === 'function') loadPasses();
  if (typeof updateMttOverlay === 'function') updateMttOverlay();
}, 200);
