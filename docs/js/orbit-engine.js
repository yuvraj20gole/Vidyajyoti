/* SGP4 orbit propagation using satellite.js + API TLE catalog */

window.VjOrbit = (function () {
  var catalog = {};
  var satrecs = {};

  var EMBEDDED_CATALOG = [
    { name: 'VIDYAJYOTI', norad_id: null, color: '#4d9fff', is_simulated: true, status: 'simulated', tle_available: false },
    {
      name: 'VO-52', norad_id: 32791, color: '#9d6fff', is_simulated: false, status: 'active', tle_available: true,
      line1: '1 32791U 08021J   26168.52727106  .00014659  00000+0  46558-3 0  9991',
      line2: '2 32791  97.7515 166.4411 0001013   2.1401 357.9844 15.32761121987344'
    },
    {
      name: 'SO-50', norad_id: 27607, color: '#ff7c3a', is_simulated: false, status: 'active', tle_available: true,
      line1: '1 27607U 02058C   26168.89705227  .00000776  00000+0  10901-3 0  9993',
      line2: '2 27607  64.5511 126.7887 0075200 262.3451  96.9110 14.83048298264568'
    },
    {
      name: 'AO-27', norad_id: 22825, color: '#ffc444', is_simulated: false, status: 'active', tle_available: true,
      line1: '1 22825U 93061C   26168.76903799  .00000075  00000+0  45510-4 0  9991',
      line2: '2 22825  98.6881 236.1824 0009541  98.2958 261.9307 14.30942422707088'
    },
    {
      name: 'FO-29', norad_id: 24278, color: '#ff4466', is_simulated: false, status: 'active', tle_available: true,
      line1: '1 24278U 96046B   26168.53292174 -.00000001  00000+0  31612-4 0  9992',
      line2: '2 24278  98.5239  17.3577 0350906  95.5376 268.5887 13.53274425473216'
    },
    {
      name: 'HO-68', norad_id: 36122, color: '#00e5a0', is_simulated: false, status: 'active', tle_available: true,
      line1: '1 36122U 09072B   26168.92787475  .00000131  00000+0  46070-3 0  9998',
      line2: '2 36122 100.4030 122.7487 0006862 229.8560 130.1952 13.16439165793109'
    },
    {
      name: 'Cartosat-2F', norad_id: 43111, color: '#56d4ff', is_simulated: false, status: 'active', tle_available: true,
      line1: '1 43111U 18004A   26188.56064297  .00006056  00000+0  29061-3 0  9994',
      line2: '2 43111  97.4776 247.9958 0002116 150.9562 209.1791 15.19238236470420'
    },
    {
      name: 'RISAT-2B', norad_id: 44233, color: '#ff9933', is_simulated: false, status: 'active', tle_available: true,
      line1: '1 44233U 19028A   26188.56445720  .00001724  00000+0  13595-3 0  9993',
      line2: '2 44233  36.9962 233.2239 0005299 213.8538 146.1867 15.01777033390898'
    },
    {
      name: 'Sentinel-2A', norad_id: 40697, color: '#7dffb3', is_simulated: false, status: 'active', tle_available: true,
      line1: '1 40697U 15028A   26188.56433306  .00000170  00000+0  81634-4 0  9990',
      line2: '2 40697  98.5673 263.1268 0001240  95.2843 264.8482 14.30821730576643'
    },
    {
      name: 'Resourcesat-2A', norad_id: 41877, color: '#e879f9', is_simulated: false, status: 'active', tle_available: true,
      line1: '1 41877U 16074A   26188.62244933  .00000331  00000+0  17095-3 0  9994',
      line2: '2 41877  98.7516 261.9597 0002812  44.1412 315.9990 14.21608143497201'
    }
  ];

  function deg(n) { return n * (180 / Math.PI); }
  function rad(n) { return n * (Math.PI / 180); }

  function registerSatrec(sat) {
    catalog[sat.name] = sat;
    if (sat.line1 && sat.line2 && typeof satellite !== 'undefined') {
      try {
        satrecs[sat.name] = satellite.twoline2satrec(sat.line1, sat.line2);
      } catch (e) {
        satrecs[sat.name] = null;
      }
    }
  }

  function initFromApi(list) {
    catalog = {};
    satrecs = {};
    var source = (list && list.length) ? list : EMBEDDED_CATALOG;
    source.forEach(function (sat) {
      registerSatrec(sat);
    });
    source.forEach(function (sat) {
      if (!sat.is_simulated && !satrecs[sat.name] && sat.norad_id) {
        var embedded = EMBEDDED_CATALOG.find(function (e) { return e.norad_id === sat.norad_id; });
        if (embedded && embedded.line1) registerSatrec(Object.assign({}, sat, embedded));
      }
    });
  }

  function embeddedCatalog() {
    return EMBEDDED_CATALOG.slice();
  }

  function propagateVidyajyoti(date) {
    var periodMs = 92 * 60 * 1000;
    var t = (date.getTime() % periodMs) / periodMs * Math.PI * 2;
    var lat = 20 + 14 * Math.sin(t);
    var lon = 78 + 12 * Math.cos(t * 0.92 + 0.35);
    lon = Math.max(68, Math.min(92, lon));
    return {
      lat: lat,
      lon: lon,
      alt_km: 412 + 4 * Math.sin(t * 2),
      velocity: 7.662,
      heading: 0
    };
  }

  function propagate(name, date) {
    var meta = catalog[name];
    if (!meta) return null;

    if (meta.is_simulated) {
      return propagateVidyajyoti(date);
    }

    var rec = satrecs[name];
    if (!rec || typeof satellite === 'undefined') return null;
    var pv = satellite.propagate(rec, date);
    if (!pv || !pv.position) return null;
    var gmst = satellite.gstime(date);
    var gd = satellite.eciToGeodetic(pv.position, gmst);
    var vel = pv.velocity;
    var heading = vel ? Math.atan2(vel.y, vel.x) : 0;
    if (!isFinite(gd.latitude) || !isFinite(gd.longitude) || !isFinite(gd.height)) return null;
    return {
      lat: deg(gd.latitude),
      lon: deg(gd.longitude),
      alt_km: gd.height,
      velocity: vel ? Math.sqrt(vel.x * vel.x + vel.y * vel.y + vel.z * vel.z) / 1000 : 0,
      heading: deg(heading)
    };
  }

  function orbitPeriodMinutes(name) {
    var meta = catalog[name];
    if (!meta) return 90;
    if (meta.is_simulated) return 92;
    if (!meta.line2) return 90;
    var parts = meta.line2.trim().split(/\s+/);
    var mm = parseFloat(parts[7]);
    if (!mm || isNaN(mm)) return 90;
    return 1440 / mm;
  }

  function buildGroundTrack(name, date, samples) {
    samples = samples || 120;
    var periodMin = orbitPeriodMinutes(name);
    var stepMs = (periodMin * 60 * 1000) / samples;
    var pts = [];
    for (var i = 0; i <= samples; i++) {
      var d = new Date(date.getTime() + i * stepMs);
      var p = propagate(name, d);
      if (p && isFinite(p.lat) && isFinite(p.lon)) pts.push([p.lat, p.lon]);
    }
    return pts;
  }

  function buildPreviousTrack(name, date, samples) {
    samples = samples || 60;
    var periodMin = orbitPeriodMinutes(name);
    var stepMs = (periodMin * 60 * 1000) / samples;
    var pts = [];
    for (var i = samples; i >= 0; i--) {
      var d = new Date(date.getTime() - i * stepMs);
      var p = propagate(name, d);
      if (p && isFinite(p.lat) && isFinite(p.lon)) pts.push([p.lat, p.lon]);
    }
    return pts;
  }

  function lookAngles(gsLat, gsLon, satLat, satLon, altKm) {
    var R = 6378.137;
    var lat1 = rad(gsLat);
    var lon1 = rad(gsLon);
    var lat2 = rad(satLat);
    var lon2 = rad(satLon);
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
      az: (deg(az) + 360) % 360,
      el: Math.max(0, deg(el))
    };
  }

  function getMeta(name) {
    return catalog[name] || null;
  }

  function allNames() {
    return Object.keys(catalog);
  }

  return {
    initFromApi: initFromApi,
    embeddedCatalog: embeddedCatalog,
    propagate: propagate,
    buildGroundTrack: buildGroundTrack,
    buildPreviousTrack: buildPreviousTrack,
    lookAngles: lookAngles,
    orbitPeriodMinutes: orbitPeriodMinutes,
    getMeta: getMeta,
    allNames: allNames
  };
})();

VjOrbit.initFromApi();
