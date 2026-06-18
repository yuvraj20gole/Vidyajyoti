/* SGP4 orbit propagation using satellite.js + API TLE catalog */

window.VjOrbit = (function () {
  var catalog = {};
  var satrecs = {};

  function deg(n) { return n * (180 / Math.PI); }
  function rad(n) { return n * (Math.PI / 180); }

  function initFromApi(list) {
    catalog = {};
    satrecs = {};
    if (!list || !list.length) return;
    list.forEach(function (sat) {
      catalog[sat.name] = sat;
      if (sat.line1 && sat.line2 && typeof satellite !== 'undefined') {
        try {
          satrecs[sat.name] = satellite.twoline2satrec(sat.line1, sat.line2);
        } catch (e) {
          satrecs[sat.name] = null;
        }
      }
    });
  }

  function propagate(name, date) {
    var meta = catalog[name];
    if (!meta) return null;

    if (meta.is_simulated) {
      if (typeof OR === 'undefined') return null;
      return {
        lat: OR.lat,
        lon: OR.lon,
        alt_km: OR.alt,
        velocity: OR.vel,
        heading: 0
      };
    }

    var rec = satrecs[name];
    if (!rec || typeof satellite === 'undefined') return null;
    var pv = satellite.propagate(rec, date);
    if (!pv || !pv.position) return null;
    var gmst = satellite.gstime(date);
    var gd = satellite.eciToGeodetic(pv.position, gmst);
    var vel = pv.velocity;
    var heading = vel ? Math.atan2(vel.y, vel.x) : 0;
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
    if (!meta || !meta.line2) return 90;
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
      if (p) pts.push([p.lat, p.lon]);
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
      if (p) pts.push([p.lat, p.lon]);
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
    propagate: propagate,
    buildGroundTrack: buildGroundTrack,
    buildPreviousTrack: buildPreviousTrack,
    lookAngles: lookAngles,
    orbitPeriodMinutes: orbitPeriodMinutes,
    getMeta: getMeta,
    allNames: allNames
  };
})();
