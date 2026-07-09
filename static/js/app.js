/* ====================================================
   UTILITIES & APP INIT
==================================================== */
(function () {
  if (location.hostname.endsWith('github.io')) return;
  if (!document.getElementById('topbar')) return;
  fetch('/api/auth/session', { credentials: 'same-origin' }).then(function (res) {
    if (!res.ok) window.location.replace('/login');
  });
})();

function el(id) { return document.getElementById(id); }
function pad(v) { return String(v).padStart(2, '0'); }
function nudge(v, d, mn, mx) {
  return Math.min(mx, Math.max(mn, +(v + (Math.random() - 0.5) * d).toFixed(1)));
}

function tickClock() {
  var clk = el('utcClock');
  if (!clk) return;
  var now = new Date();
  var parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(now);
  var get = function (type) {
    var p = parts.find(function (x) { return x.type === type; });
    return p ? p.value : '00';
  };
  clk.textContent = 'IST ' + get('year') + '/' + get('month') + '/' + get('day') + ' ' +
    get('hour') + ':' + get('minute') + ':' + get('second');
}
setInterval(tickClock, 1000);
tickClock();

function vjIsLightTheme() {
  return document.documentElement.getAttribute('data-theme') === 'light';
}

(function () {
  var c = el('bgCvs');
  if (!c) return;
  function resize() {
    c.width = window.innerWidth;
    c.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);
  var ctx = c.getContext('2d');
  var stars = [];
  for (var i = 0; i < 280; i++) {
    stars.push({
      x: Math.random() * c.width,
      y: Math.random() * c.height,
      r: Math.random() * 1.1 + 0.2,
      a: Math.random(),
      da: (Math.random() - 0.5) * 0.006 + 0.002,
      blue: Math.random() > 0.8
    });
  }
  (function draw() {
    ctx.clearRect(0, 0, c.width, c.height);
    if (!vjIsLightTheme()) {
      stars.forEach(function (s) {
        s.a += s.da;
        if (s.a > 1 || s.a < 0) s.da *= -1;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = (s.blue ? 'rgba(140,190,255,' : 'rgba(255,255,255,') + s.a + ')';
        ctx.fill();
      });
    }
    requestAnimationFrame(draw);
  })();
})();

var activeTab = 1;
document.querySelectorAll('.tabn').forEach(function (btn) {
  btn.addEventListener('click', function () {
    var t = parseInt(btn.getAttribute('data-tab'), 10);
    document.querySelectorAll('.tabn').forEach(function (b) { b.classList.remove('active'); });
    btn.classList.add('active');
    document.querySelectorAll('.tab-panel').forEach(function (p) { p.classList.remove('active'); });
    var panel = el('tab' + t);
    if (panel) panel.classList.add('active');
    activeTab = t;
    if (t === 1 || t === 3) {
      if (typeof refreshVjClimateCharts === 'function') requestAnimationFrame(refreshVjClimateCharts);
    }
    if (t === 2 && !worldMapReady) initWorldMap();
    if (t === 3 && !dashChartReady) initDashChart();
    if (t === 2 && worldMapReady) scheduleMapResize({ fitWorld: false });
    if (t === 3 && indiaMapReady) scheduleMapResize({ fitWorld: false });
    if (t === 4 && typeof loadSettingsAccount === 'function') loadSettingsAccount();
  });
});
function switchToTab(tabNum) {
  var btn = document.querySelector('.tabn[data-tab="' + tabNum + '"]');
  if (btn) btn.click();
}

function focusSatellite(name) {
  if (!name) return;
  if (typeof suppressWorldMapFit === 'function') suppressWorldMapFit(2500);
  switchToTab(2);
  setTimeout(function () {
    if (!worldMapReady && typeof initWorldMap === 'function') initWorldMap();
    setTimeout(function () {
      if (typeof selectSatellite === 'function') selectSatellite(name);
      document.querySelectorAll('.sat-row').forEach(function (x) {
        x.classList.toggle('active', x.getAttribute('data-sat') === name);
      });
    }, worldMapReady ? 50 : 800);
  }, 80);
}

document.querySelectorAll('.sat-row').forEach(function (r) {
  r.addEventListener('click', function () {
    var name = r.getAttribute('data-sat') || (r.querySelector('.sat-nm') && r.querySelector('.sat-nm').textContent.trim());
    focusSatellite(name);
  });
});

document.querySelectorAll('.launch-item[data-launch]').forEach(function (item) {
  item.addEventListener('click', function () {
    var info = item.getAttribute('data-launch');
    var purpose = el('sic-purpose');
    var code = el('sic-code');
    var nameEl = el('sic-name');
    if (purpose) purpose.textContent = info;
    if (code) code.textContent = 'UPCOMING LAUNCH';
    if (nameEl) {
      var mission = item.querySelector('.li-mission');
      nameEl.innerHTML = mission ? mission.textContent : 'Launch';
    }
    document.querySelectorAll('.launch-item').forEach(function (x) { x.classList.remove('launch-sel'); });
    item.classList.add('launch-sel');
    showVjToast('Launch details updated in the right panel.');
  });
});

var _vjToastTimer;
function showVjToast(msg) {
  var toast = el('vjToast');
  if (!toast) return;
  toast.textContent = msg;
  toast.hidden = false;
  toast.classList.add('visible');
  clearTimeout(_vjToastTimer);
  _vjToastTimer = setTimeout(function () {
    toast.classList.remove('visible');
    toast.hidden = true;
  }, 3200);
}

function activateInsightCard(card) {
  document.querySelectorAll('.card.ic').forEach(function (c) { c.classList.remove('ic-active'); });
  card.classList.add('ic-active');
}

function handleInsightClick(card) {
  var action = card.getAttribute('data-insight');
  var sat = card.getAttribute('data-sat');
  activateInsightCard(card);
  if (action === 'pass') {
    focusSatellite(sat || 'VIDYAJYOTI');
    showVjToast('Opening orbit tracker for tonight\u2019s optimal pass.');
    return;
  }
  if (action === 'aqi') {
    switchToTab(1);
    showVjToast('Showing Mumbai air quality and weather telemetry.');
    return;
  }
  if (action === 'battery') {
    if (typeof updateRightPanel === 'function') updateRightPanel(sat || 'VIDYAJYOTI');
    focusSatellite(sat || 'VIDYAJYOTI');
    showVjToast('Power subsystem nominal — 89% battery, 3.4W solar.');
  }
}

document.querySelectorAll('.card.ic[data-insight]').forEach(function (card) {
  card.addEventListener('click', function () { handleInsightClick(card); });
  card.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleInsightClick(card);
    }
  });
});

document.querySelectorAll('.sec-action[data-action]').forEach(function (btn) {
  function run() {
    var action = btn.getAttribute('data-action');
    if (action === 'signal-details') {
      switchToTab(3);
      showVjToast('Signal quality is estimated from satellite elevation above Mumbai.');
      var gauge = el('gaugeCanvas');
      if (gauge) {
        gauge.classList.add('panel-flash');
        setTimeout(function () { gauge.classList.remove('panel-flash'); }, 1200);
      }
      return;
    }
    if (action === 'all-launches') {
      switchToTab(3);
      showVjToast('Showing all upcoming launches on the dashboard.');
      var launchBlock = document.querySelector('#tab3 .launch-item');
      if (launchBlock) launchBlock.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
  btn.addEventListener('click', run);
  btn.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      run();
    }
  });
});

document.querySelectorAll('.cat-row-btn').forEach(function (row) {
  function run() {
    var cat = row.getAttribute('data-cat') || row.querySelector('.cat-nm').textContent.trim();
    var desc = row.getAttribute('data-cat-desc') || cat + ' satellites in active orbit.';
    var purpose = el('sic-purpose');
    var code = el('sic-code');
    var nameEl = el('sic-name');
    if (purpose) purpose.textContent = desc;
    if (code) code.textContent = 'CATEGORY \u00b7 GLOBAL FLEET';
    if (nameEl) nameEl.innerHTML = cat;
    document.querySelectorAll('.cat-row-btn').forEach(function (x) { x.classList.remove('cat-sel'); });
    row.classList.add('cat-sel');
    document.querySelectorAll('.launch-item').forEach(function (x) { x.classList.remove('launch-sel'); });
    showVjToast(cat + ' — ' + (row.querySelector('.cat-v') || {}).textContent + ' tracked satellites.');
  }
  row.addEventListener('click', run);
  row.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      run();
    }
  });
});
