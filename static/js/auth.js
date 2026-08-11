/* VIDYAJYOTI AUTH - login & register */

var VIT_DOMAIN = '@vit.edu.in';
var MIN_PASSWORD_LEN = 8;
var VIT_EMAIL_RE = /^[a-z0-9](?:[a-z0-9._-]{1,62}[a-z0-9])?@vit\.edu\.in$/;
var DOMAIN_TYPOS = {
  'vit.ed.in': 'vit.edu.in',
  'vit.edu.com': 'vit.edu.in',
  'vit.ac.in': 'vit.edu.in'
};
var registerEmailVerified = false;
var registerEmailVerifyTimer = null;

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
  var panels = {
    login: document.getElementById('panel-login'),
    register: document.getElementById('panel-register'),
    forgot: document.getElementById('panel-forgot')
  };
  var outPanel = document.querySelector('.form-panel.active');
  var inPanel = panels[m];
  if (!inPanel) return;

  if (outPanel && outPanel !== inPanel && outPanel.classList.contains('active')) {
    var dir = m === 'login' ? -20 : 20;
    motionAnimate(outPanel, { opacity: [1, 0], x: [0, dir] }, { duration: 0.2 });
    setTimeout(function () {
      outPanel.classList.remove('active');
      outPanel.style.opacity = '';
      outPanel.style.transform = '';
      inPanel.classList.add('active');
      motionAnimate(inPanel, { opacity: [0, 1], x: [-dir, 0] }, { duration: 0.3, easing: [0.22, 1, 0.36, 1] });
    }, 180);
  } else {
    Object.keys(panels).forEach(function (key) {
      panels[key].classList.toggle('active', key === m);
    });
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
  if (!p) { pstr.classList.remove('show'); updateRegisterPassRules(); return; }
  pstr.classList.add('show');
  var score = 0;
  if (p.length >= MIN_PASSWORD_LEN) score++;
  if (/[A-Z]/.test(p)) score++;
  if (/[0-9]/.test(p)) score++;
  if (/[^A-Za-z0-9]/.test(p)) score++;
  var colors = ['', '#ff4466', '#ffc444', '#4d9fff', '#00e5a0'];
  var labels = ['Too short', 'Weak', 'Fair', 'Strong', 'Very Strong'];
  for (var i = 1; i <= 4; i++) {
    document.getElementById('pb' + i).style.background = i <= score ? colors[score] : 'rgba(100,160,255,.1)';
  }
  var lbl = document.getElementById('pstr-label');
  lbl.textContent = p.length < MIN_PASSWORD_LEN ? labels[0] : labels[score];
  lbl.style.color = p.length < MIN_PASSWORD_LEN ? 'var(--dim)' : colors[score];
  updateRegisterPassRules();
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

function isOfficialVitEmail(email) {
  return VIT_EMAIL_RE.test(email.toLowerCase());
}

function vitEmailTypoHint(email) {
  var parts = email.toLowerCase().split('@');
  if (parts.length !== 2) return null;
  var domain = parts[1];
  if (DOMAIN_TYPOS[domain]) {
    return 'Did you mean @' + DOMAIN_TYPOS[domain] + '?';
  }
  return null;
}

function isValidEmailFormat(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function setRuleState(ruleEl, met, touched) {
  if (!ruleEl) return;
  ruleEl.classList.toggle('met', met);
  ruleEl.classList.toggle('unmet', !!touched && !met);
  var mark = ruleEl.querySelector('.rule-mark');
  if (mark) mark.textContent = met ? '\u2713' : '+';
}

function updateEmailRules(inputId, prefix) {
  var email = val(inputId);
  var touched = email.length > 0;
  setRuleState(document.getElementById(prefix + '-email-rule-format'), isValidEmailFormat(email), touched);

  if (prefix === 'r') {
    setRuleState(document.getElementById('r-email-rule-vit'), isOfficialVitEmail(email), touched);
    if (touched && !isOfficialVitEmail(email)) {
      var hint = vitEmailTypoHint(email);
      var hintEl = document.getElementById('r-email-verify-hint');
      if (hintEl && hint) {
        hintEl.textContent = hint;
        hintEl.className = 'field-hint invalid';
      }
    }
    scheduleRegisterEmailVerify();
    return;
  }

  setRuleState(document.getElementById(prefix + '-email-rule-vit'), isVitEmail(email), touched);
}

function setRegisterEmailHint(text, state) {
  var hintEl = document.getElementById('r-email-verify-hint');
  if (!hintEl) return;
  hintEl.textContent = text || '';
  hintEl.className = 'field-hint' + (state ? ' ' + state : '');
}

function scheduleRegisterEmailVerify() {
  registerEmailVerified = false;
  setRuleState(document.getElementById('r-email-rule-domain'), false, false);
  clearTimeout(registerEmailVerifyTimer);
  var email = val('r-email').toLowerCase();
  if (!isOfficialVitEmail(email)) {
    setRegisterEmailHint('', '');
    return;
  }
  setRegisterEmailHint('Checking VIT mail domain...', 'checking');
  registerEmailVerifyTimer = setTimeout(function () { verifyRegisterEmail(email); }, 450);
}

async function verifyRegisterEmail(email) {
  email = (email || val('r-email')).toLowerCase();
  if (!isOfficialVitEmail(email)) {
    registerEmailVerified = false;
    setRuleState(document.getElementById('r-email-rule-domain'), false, email.length > 0);
    setRegisterEmailHint('', '');
    return false;
  }

  var result = await postAuth('/api/auth/verify-email', { email: email });
  registerEmailVerified = result.ok && result.data.valid;
  setRuleState(document.getElementById('r-email-rule-domain'), registerEmailVerified, email.length > 0);

  if (registerEmailVerified) {
    setRegisterEmailHint(result.data.message || 'VIT email verified.', '');
  } else {
    setRegisterEmailHint(result.data.error || 'Could not verify this email.', 'invalid');
  }
  return registerEmailVerified;
}

function updateLenRule(inputId, ruleId, minLen) {
  var value = val(inputId);
  var touched = value.length > 0;
  setRuleState(document.getElementById(ruleId), value.length >= minLen, touched);
}

function updateMatchRule(passId, confirmId, ruleId) {
  var pass = val(passId);
  var confirm = val(confirmId);
  var touched = confirm.length > 0;
  setRuleState(document.getElementById(ruleId), pass.length > 0 && pass === confirm, touched);
}

function updateRegisterPassRules() {
  var p = val('r-pass');
  var touched = p.length > 0;
  setRuleState(document.getElementById('r-pass-rule-len'), p.length >= MIN_PASSWORD_LEN, touched);
  setRuleState(document.getElementById('r-pass-rule-upper'), /[A-Z]/.test(p), touched);
  setRuleState(document.getElementById('r-pass-rule-num'), /[0-9]/.test(p), touched);
  setRuleState(document.getElementById('r-pass-rule-special'), /[^A-Za-z0-9]/.test(p), touched);
  updateMatchRule('r-pass', 'r-confirm', 'r-confirm-rule-match');
}

function initAuthFieldRules() {
  ['l-email', 'r-email', 'f-email'].forEach(function (id) {
    var prefix = id.split('-')[0];
    var input = document.getElementById(id);
    if (!input) return;
    input.addEventListener('input', function () { updateEmailRules(id, prefix); });
    input.addEventListener('blur', function () { updateEmailRules(id, prefix); });
  });

  var loginPass = document.getElementById('l-pass');
  if (loginPass) {
    loginPass.addEventListener('input', function () { updateLenRule('l-pass', 'l-pass-rule-len', MIN_PASSWORD_LEN); });
    loginPass.addEventListener('blur', function () { updateLenRule('l-pass', 'l-pass-rule-len', MIN_PASSWORD_LEN); });
  }

  ['r-name', 'f-name'].forEach(function (id) {
    var prefix = id.split('-')[0];
    var input = document.getElementById(id);
    if (!input) return;
    var ruleId = prefix + '-name-rule-len';
    input.addEventListener('input', function () { updateLenRule(id, ruleId, 2); });
    input.addEventListener('blur', function () { updateLenRule(id, ruleId, 2); });
  });

  var rPass = document.getElementById('r-pass');
  if (rPass) {
    rPass.addEventListener('input', updateRegisterPassRules);
    rPass.addEventListener('blur', updateRegisterPassRules);
  }
  var rConfirm = document.getElementById('r-confirm');
  if (rConfirm) {
    rConfirm.addEventListener('input', updateRegisterPassRules);
    rConfirm.addEventListener('blur', updateRegisterPassRules);
  }

  var fPass = document.getElementById('f-pass');
  if (fPass) {
    fPass.addEventListener('input', function () {
      updateLenRule('f-pass', 'f-pass-rule-len', MIN_PASSWORD_LEN);
      updateMatchRule('f-pass', 'f-confirm', 'f-confirm-rule-match');
    });
    fPass.addEventListener('blur', function () {
      updateLenRule('f-pass', 'f-pass-rule-len', MIN_PASSWORD_LEN);
      updateMatchRule('f-pass', 'f-confirm', 'f-confirm-rule-match');
    });
  }
  var fConfirm = document.getElementById('f-confirm');
  if (fConfirm) {
    fConfirm.addEventListener('input', function () { updateMatchRule('f-pass', 'f-confirm', 'f-confirm-rule-match'); });
    fConfirm.addEventListener('blur', function () { updateMatchRule('f-pass', 'f-confirm', 'f-confirm-rule-match'); });
  }
}

document.addEventListener('DOMContentLoaded', initAuthFieldRules);

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
  if (!email) { showErr('l-email-err', 'Email is required'); ok = false; }
  else if (!isValidEmailFormat(email)) { showErr('l-email-err', 'Enter a valid email address'); ok = false; }
  else if (!isVitEmail(email)) { showErr('l-email-err', 'Use your @vit.edu.in email address'); ok = false; }
  if (!password) { showErr('l-pass-err', 'Password is required'); ok = false; }
  else if (password.length < MIN_PASSWORD_LEN) { showErr('l-pass-err', 'Password must be at least ' + MIN_PASSWORD_LEN + ' characters'); ok = false; }
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
  if (!email) { showErr('r-email-err', 'Email is required'); ok = false; }
  else if (!isValidEmailFormat(email)) { showErr('r-email-err', 'Enter a valid email address'); ok = false; }
  else if (!isOfficialVitEmail(email)) {
    showErr('r-email-err', vitEmailTypoHint(email) || 'Use your official @vit.edu.in email (e.g. firstname.lastname@vit.edu.in)');
    ok = false;
  }
  if (!val('r-pass')) { showErr('r-pass-err', 'Password is required'); ok = false; }
  else if (val('r-pass').length < MIN_PASSWORD_LEN) { showErr('r-pass-err', 'Password must be at least ' + MIN_PASSWORD_LEN + ' characters'); ok = false; }
  if (!val('r-confirm')) { showErr('r-confirm-err', 'Please confirm your password'); ok = false; }
  else if (val('r-pass') !== val('r-confirm')) { showErr('r-confirm-err', 'Passwords do not match'); ok = false; }
  if (!document.getElementById('terms-check').classList.contains('checked')) {
    showErr('r-terms-err', 'You must accept the terms to continue');
    ok = false;
  }
  if (!ok) return;

  if (!registerEmailVerified) {
    var verified = await verifyRegisterEmail(email);
    if (!verified) {
      showErr('r-email-err', document.getElementById('r-email-verify-hint').textContent || 'Enter a valid VIT email address');
      return;
    }
  }

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

document.getElementById('forgotForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  ['f-email-err', 'f-name-err', 'f-pass-err', 'f-confirm-err'].forEach(clearErr);
  var email = val('f-email').toLowerCase();
  var ok = true;
  if (!email) { showErr('f-email-err', 'Email is required'); ok = false; }
  else if (!isValidEmailFormat(email)) { showErr('f-email-err', 'Enter a valid email address'); ok = false; }
  else if (!isVitEmail(email)) { showErr('f-email-err', 'Use your @vit.edu.in email address'); ok = false; }
  if (val('f-name').length < 2) { showErr('f-name-err', 'Enter the name you used when registering'); ok = false; }
  if (!val('f-pass')) { showErr('f-pass-err', 'Password is required'); ok = false; }
  else if (val('f-pass').length < MIN_PASSWORD_LEN) { showErr('f-pass-err', 'Password must be at least ' + MIN_PASSWORD_LEN + ' characters'); ok = false; }
  if (!val('f-confirm')) { showErr('f-confirm-err', 'Please confirm your new password'); ok = false; }
  else if (val('f-pass') !== val('f-confirm')) { showErr('f-confirm-err', 'Passwords do not match'); ok = false; }
  if (!ok) return;

  var btn = document.getElementById('f-btn');
  var txt = document.getElementById('f-btn-txt');
  btn.disabled = true;
  btn.classList.add('loading');
  txt.innerHTML = '&#9881; Updating...';

  var result = await postAuth('/api/auth/forgot-password', {
    email: email,
    full_name: val('f-name'),
    new_password: val('f-pass'),
    confirm_password: val('f-confirm')
  });

  if (!result.ok) {
    btn.disabled = false;
    btn.classList.remove('loading');
    txt.textContent = 'Update Password';
    var errId = result.status === 404 || result.status === 403 ? 'f-email-err' : 'f-name-err';
    if (result.status === 400 && result.data.error && result.data.error.indexOf('match') !== -1) {
      errId = 'f-confirm-err';
    }
    if (result.status === 400 && result.data.error && result.data.error.indexOf('8 characters') !== -1) {
      errId = 'f-pass-err';
    }
    showErr(errId, result.data.error || 'Could not reset password');
    return;
  }

  btn.classList.remove('loading');
  btn.classList.add('success');
  txt.innerHTML = '&#10003;&nbsp; Password updated!';
  setTimeout(function () {
    switchMode('login');
    btn.disabled = false;
    btn.classList.remove('success');
    txt.textContent = 'Update Password';
    document.getElementById('forgotForm').reset();
  }, 1200);
});
