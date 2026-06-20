/* SETTINGS � theme + change password */

var THEME_KEY = 'vj-theme';

function getTheme() {
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

function applyTheme(theme) {
  var isLight = theme === 'light';
  document.documentElement.setAttribute('data-theme', isLight ? 'light' : 'dark');
  localStorage.setItem(THEME_KEY, isLight ? 'light' : 'dark');
  window._vjThemeCache = null;

  var label = document.getElementById('theme-label');
  var hint = document.getElementById('theme-hint');
  var toggle = document.getElementById('theme-toggle');
  if (label) label.textContent = isLight ? 'Light' : 'Dark';
  if (hint) hint.textContent = isLight ? 'Light mode enabled' : 'Dark mode enabled';
  if (toggle) toggle.setAttribute('aria-pressed', isLight ? 'true' : 'false');

  if (typeof window.redrawVjCharts === 'function') window.redrawVjCharts();
  if (typeof window.refreshMapTheme === 'function') window.refreshMapTheme();
}

function initThemeToggle() {
  applyTheme(getTheme());
  var btn = document.getElementById('theme-toggle');
  if (!btn) return;
  btn.addEventListener('click', function () {
    applyTheme(getTheme() === 'light' ? 'dark' : 'light');
  });
}

function showSettingsErr(id, msg) {
  var el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg ? '\u26a0 ' + msg : '';
  var inputId = id.replace('-err', '');
  var input = document.getElementById(inputId);
  if (input) input.classList.toggle('error', !!msg);
}

function clearPasswordFormErrors() {
  ['cp-current-err', 'cp-new-err', 'cp-confirm-err'].forEach(function (id) {
    showSettingsErr(id, '');
  });
  var ok = document.getElementById('cp-success');
  if (ok) ok.hidden = true;
}

function loadSettingsAccount() {
  if (location.hostname.endsWith('github.io')) return;
  fetch('/api/auth/session', { credentials: 'same-origin' })
    .then(function (res) { return res.ok ? res.json() : null; })
    .then(function (data) {
      if (!data) return;
      var emailEl = document.getElementById('settings-email');
      if (emailEl) emailEl.textContent = data.email || '�';
    });
}

function initChangePasswordForm() {
  var form = document.getElementById('changePasswordForm');
  if (!form) return;

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    clearPasswordFormErrors();

    var current = document.getElementById('cp-current').value;
    var newPw = document.getElementById('cp-new').value;
    var confirm = document.getElementById('cp-confirm').value;
    var ok = true;

    if (!current) { showSettingsErr('cp-current-err', 'Enter your current password'); ok = false; }
    if (newPw.length < 8) { showSettingsErr('cp-new-err', 'New password must be at least 8 characters'); ok = false; }
    if (newPw !== confirm) { showSettingsErr('cp-confirm-err', 'Passwords do not match'); ok = false; }
    if (!ok) return;

    var btn = document.getElementById('cp-btn');
    btn.disabled = true;
    btn.textContent = 'Updating...';

    try {
      var res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          current_password: current,
          new_password: newPw,
          confirm_password: confirm
        })
      });
      var data = await res.json().catch(function () { return {}; });

      if (!res.ok) {
        var errId = res.status === 401 ? 'cp-current-err' : 'cp-new-err';
        showSettingsErr(errId, data.error || 'Could not update password');
        return;
      }

      form.reset();
      var success = document.getElementById('cp-success');
      if (success) {
        success.hidden = false;
        success.textContent = data.message || 'Password updated successfully.';
      }
    } catch (err) {
      showSettingsErr('cp-new-err', 'Network error. Try again.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Update password';
    }
  });
}

initThemeToggle();
loadSettingsAccount();
initChangePasswordForm();
