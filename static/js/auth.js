/* VIDYAJYOTI AUTH - login & register */

var VIT_DOMAIN = '@vit.edu.in';

function motionAnimate(target, keyframes, options) {
  if (typeof Motion !== 'undefined' && Motion.animate) {
    return Motion.animate(target, keyframes, options);
  }
  return null;
}

(function () {
  var c = document.getElementById('starCanvas');
  if (!c) return;
  function resize() { c.width = window.innerWidth; c.height = window.innerHeight; }
  resize();
  window.addEventListener('resize', resize);
  var ctx = c.getContext('2d');
  var stars = Array.from({ length: 300 }, function () {
    return {
      x: Math.random() * c.width, y: Math.random() * c.height,
      r: Math.random() * 1.2 + 0.2, a: Math.random(),
      da: (Math.random() - 0.5) * 0.006 + 0.002, blue: Math.random() > 0.75
    };
  });
  (function draw() {
    ctx.clearRect(0, 0, c.width, c.height);
    stars.forEach(function (s) {
      s.a += s.da;
      if (s.a > 1 || s.a < 0) s.da *= -1;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = (s.blue ? 'rgba(140,190,255,' : 'rgba(255,255,255,') + s.a + ')';
      ctx.fill();
    });
    requestAnimationFrame(draw);
  })();
})();

var rightPanel = document.getElementById('rightPanel');
var authCard = document.getElementById('authCard');
if (authCard && rightPanel) {
  authCard.addEventListener('mousemove', function (e) {
    var r = rightPanel.getBoundingClientRect();
    var x = (e.clientX - r.left) / r.width - 0.5;
    var y = (e.clientY - r.top) / r.height - 0.5;
    rightPanel.style.transform = 'perspective(800px) rotateY(' + (x * 4) + 'deg) rotateX(' + (-y * 4) + 'deg)';
  });
  authCard.addEventListener('mouseleave', function () {
    rightPanel.style.transform = '';
    rightPanel.style.transition = 'transform .4s cubic-bezier(.22,1,.36,1)';
    setTimeout(function () { rightPanel.style.transition = ''; }, 400);
  });
}

function switchMode(m) {
  var loginPanel = document.getElementById('panel-login');
  var registerPanel = document.getElementById('panel-register');
  var outPanel = m === 'login' ? registerPanel : loginPanel;
  var inPanel = m === 'login' ? loginPanel : registerPanel;

  if (outPanel.classList.contains('active')) {
    motionAnimate(outPanel, { opacity: [1, 0], x: [0, m === 'login' ? 20 : -20] }, { duration: 0.2 });
    setTimeout(function () {
      outPanel.classList.remove('active');
      outPanel.style.opacity = '';
      outPanel.style.transform = '';
      inPanel.classList.add('active');
      motionAnimate(inPanel, { opacity: [0, 1], x: [m === 'login' ? -20 : 20, 0] }, { duration: 0.3, easing: [0.22, 1, 0.36, 1] });
    }, 180);
  } else {
    loginPanel.classList.toggle('active', m === 'login');
    registerPanel.classList.toggle('active', m === 'register');
  }

  document.getElementById('ms-login').classList.toggle('active', m === 'login');
  document.getElementById('ms-register').classList.toggle('active', m === 'register');
  document.getElementById('dot-login').classList.toggle('active', m === 'login');
  document.getElementById('dot-register').classList.toggle('active', m === 'register');
}

function toggleCheck(id) {
  var box = document.getElementById(id);
  box.classList.toggle('checked');
  motionAnimate(box, { scale: [1, 1.2, 1] }, { duration: 0.25, easing: 'ease-out' });
}

function togglePass(id, btn) {
  var input = document.getElementById(id);
  var shown = input.type === 'text';
  input.type = shown ? 'password' : 'text';
  btn.innerHTML = shown ? '&#128065;' : '&#128584;';
}

function updateStrength(p) {
  var pstr = document.getElementById('pstr');
  if (!p) { pstr.classList.remove('show'); return; }
  pstr.classList.add('show');
  var score = 0;
  if (p.length >= 8) score++;
  if (/[A-Z]/.test(p)) score++;
  if (/[0-9]/.test(p)) score++;
  if (/[^A-Za-z0-9]/.test(p)) score++;
  var colors = ['', '#ff4466', '#ffc444', '#4d9fff', '#00e5a0'];
  var labels = ['Too short', 'Weak', 'Fair', 'Strong', 'Very Strong'];
  for (var i = 1; i <= 4; i++) {
    document.getElementById('pb' + i).style.background = i <= score ? colors[score] : 'rgba(100,160,255,.1)';
  }
  var lbl = document.getElementById('pstr-label');
  lbl.textContent = p.length < 8 ? labels[0] : labels[score];
  lbl.style.color = p.length < 8 ? 'var(--dim)' : colors[score];
}

function showErr(id, msg) {
  var e = document.getElementById(id);
  e.textContent = '\u26a0 ' + msg;
  e.classList.add('show');
  motionAnimate(e, { opacity: [0, 1], y: [-4, 0] }, { duration: 0.2 });
  var inp = document.getElementById(id.replace('-err', ''));
  if (inp) inp.classList.add('error');
}

function clearErr(id) {
  var e = document.getElementById(id);
  e.classList.remove('show');
  var inp = document.getElementById(id.replace('-err', ''));
  if (inp) inp.classList.remove('error');
}

function val(id) { return document.getElementById(id).value.trim(); }

function isVitEmail(email) {
  return email.toLowerCase().endsWith(VIT_DOMAIN) && email.includes('@');
}

async function postAuth(url, body) {
  var res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body)
  });
  var data = await res.json().catch(function () { return {}; });
  return { ok: res.ok, status: res.status, data: data };
}

document.getElementById('loginForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  clearErr('l-email-err');
  clearErr('l-pass-err');
  var email = val('l-email').toLowerCase();
  var password = val('l-pass');
  var ok = true;
  if (!isVitEmail(email)) { showErr('l-email-err', 'Use your @vit.edu.in email address'); ok = false; }
  if (password.length < 6) { showErr('l-pass-err', 'Password must be at least 6 characters'); ok = false; }
  if (!ok) return;

  var btn = document.getElementById('l-btn');
  var txt = document.getElementById('l-btn-txt');
  btn.disabled = true;
  btn.classList.add('loading');
  txt.innerHTML = '&#9881; Processing...';

  var result = await postAuth('/api/auth/login', {
    email: email,
    password: password,
    remember: document.getElementById('rem-check').classList.contains('checked')
  });

  if (!result.ok) {
    btn.disabled = false;
    btn.classList.remove('loading');
    txt.textContent = 'Sign In';
    showErr('l-pass-err', result.data.error || 'Login failed');
    return;
  }

  btn.classList.remove('loading');
  btn.classList.add('success');
  txt.innerHTML = '&#10003;&nbsp; Welcome back!';
  window.location.href = result.data.redirect || '/dashboard';
});

document.getElementById('registerForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  ['r-name-err', 'r-email-err', 'r-pass-err', 'r-confirm-err', 'r-terms-err'].forEach(clearErr);
  var email = val('r-email').toLowerCase();
  var ok = true;
  if (val('r-name').length < 2) { showErr('r-name-err', 'Name must be at least 2 characters'); ok = false; }
  if (!isVitEmail(email)) { showErr('r-email-err', 'Use your @vit.edu.in email address'); ok = false; }
  if (val('r-pass').length < 8) { showErr('r-pass-err', 'Password must be at least 8 characters'); ok = false; }
  if (val('r-pass') !== val('r-confirm')) { showErr('r-confirm-err', 'Passwords do not match'); ok = false; }
  if (!document.getElementById('terms-check').classList.contains('checked')) {
    showErr('r-terms-err', 'You must accept the terms to continue');
    ok = false;
  }
  if (!ok) return;

  var btn = document.getElementById('r-btn');
  var txt = document.getElementById('r-btn-txt');
  btn.disabled = true;
  btn.classList.add('loading');
  txt.innerHTML = '&#9881; Creating account...';

  var result = await postAuth('/api/auth/register', {
    email: email,
    password: val('r-pass'),
    full_name: val('r-name'),
    remember: document.getElementById('r-rem-check').classList.contains('checked')
  });

  if (!result.ok) {
    btn.disabled = false;
    btn.classList.remove('loading');
    txt.textContent = 'Create Account';
    var errId = result.status === 403 || result.status === 409 ? 'r-email-err' : 'r-pass-err';
    showErr(errId, result.data.error || 'Registration failed');
    return;
  }

  btn.classList.remove('loading');
  btn.classList.add('success');
  txt.innerHTML = '&#10003;&nbsp; Account created!';
  window.location.href = result.data.redirect || '/dashboard';
});
