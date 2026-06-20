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
    if (t === 2 && worldMapReady) scheduleMapResize();
    if (t === 3 && indiaMapReady) scheduleMapResize();
    if (t === 4 && typeof loadSettingsAccount === 'function') loadSettingsAccount();
  });
});
function switchToTab(tabNum) {
  var btn = document.querySelector('.tabn[data-tab="' + tabNum + '"]');
  if (btn) btn.click();
}

function focusSatellite(name) {
  if (!name) return;
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
  });
});
