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
  var n = new Date();
  var s = n.getUTCFullYear() + '/' + pad(n.getUTCMonth() + 1) + '/' + pad(n.getUTCDate()) + ' ' +
    pad(n.getUTCHours()) + ':' + pad(n.getUTCMinutes()) + ':' + pad(n.getUTCSeconds());
  clk.textContent = s;
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
    if (t === 2 && !worldMapReady) initWorldMap();
    if (t === 3 && !dashChartReady) initDashChart();
    if (t === 2 && worldMapReady) scheduleMapResize();
    if (t === 3 && indiaMapReady) scheduleMapResize();
    if (t === 4 && typeof loadSettingsAccount === 'function') loadSettingsAccount();
  });
});
document.querySelectorAll('.sat-row').forEach(function (r) {
  r.addEventListener('click', function () {
    document.querySelectorAll('.sat-row').forEach(function (x) { x.classList.remove('active'); });
    r.classList.add('active');
    var nmEl = r.querySelector('.sat-nm');
    if (nmEl && typeof selectSatellite === 'function') {
      selectSatellite(nmEl.textContent.trim());
    }
  });
});
