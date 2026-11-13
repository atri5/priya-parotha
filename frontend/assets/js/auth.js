const account = document.querySelector('[data-auth]');

if (account) {
  const toggle = account.querySelector('[data-auth-toggle]');
  const panel = document.createElement('section');
  panel.id = 'auth-panel';
  panel.className = 'auth-panel';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-labelledby', 'auth-title');
  panel.innerHTML = `
    <h2 class="title-1" id="auth-title">Welcome back</h2>
    <p class="body-6 auth-intro">Sign in to your Priya Parotha account.</p>
    <div data-guest>
      <form data-password-form action="/api/auth/login" method="post">
        <div class="auth-names" data-names hidden>
          <label class="title-3" for="auth-first-name">First name</label>
          <input class="body-3" id="auth-first-name" name="firstName" autocomplete="given-name" maxlength="100" disabled />
          <label class="title-3" for="auth-last-name">Last name</label>
          <input class="body-3" id="auth-last-name" name="lastName" autocomplete="family-name" maxlength="100" disabled />
        </div>
        <label class="title-3" for="auth-email">Email address</label>
        <input class="body-3" id="auth-email" name="email" type="email" autocomplete="email" maxlength="254" required />
        <label class="title-3" for="auth-password">Password</label>
        <input class="body-3" id="auth-password" name="password" type="password" autocomplete="current-password" required />
        <p class="caption-2" id="password-help" hidden>Use 15 or more characters.</p>
        <button class="button button-md auth-submit" type="submit">Sign in</button>
      </form>
      <p class="auth-divider caption-2">or</p>
      <form action="/api/auth/google" method="post">
        <button class="google-button button-md" type="submit" data-google disabled>Continue with Google</button>
      </form>
      <p class="caption-2 auth-google-note" data-google-note hidden>Google sign in is temporarily unavailable.</p>
      <p class="body-6 auth-switch">New here? <button class="text-button button-sm" type="button" data-mode>Create an account</button></p>
    </div>
    <div data-member hidden>
      <div class="auth-identity">
        <p class="body-3 auth-email" data-email></p>
        <span class="auth-admin-tag caption-3" data-admin hidden>Admin</span>
      </div>
      <a class="button button-md auth-submit" href="/dashboard.html" data-dashboard hidden>Dashboard</a>
      <button class="button button-md auth-submit" type="button" data-logout>Sign out</button>
    </div>
    <p class="auth-message body-6" role="status" aria-live="polite" data-message hidden></p>
  `;
  account.append(panel);
  const form = panel.querySelector('[data-password-form]');
  const email = form.elements.email;
  const password = form.elements.password;
  const firstName = form.elements.firstName;
  const lastName = form.elements.lastName;
  const submit = form.querySelector('[type="submit"]');
  const modeButton = panel.querySelector('[data-mode]');
  const message = panel.querySelector('[data-message]');
  const google = panel.querySelector('[data-google]');
  const dashboard = panel.querySelector('[data-dashboard]');
  const logout = panel.querySelector('[data-logout]');
  let registering = false;
  let busy = false;

  const showMessage = text => { message.textContent = text; message.hidden = !text; };
  function setOpen(open, focus = true) {
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    if (open && focus) {
      const target = panel.querySelector('[data-member]').hidden ? (registering ? firstName : email) : (dashboard.hidden ? logout : dashboard);
      target.focus();
    }
  }
  function render(user, googleEnabled) {
    panel.querySelector('[data-guest]').hidden = Boolean(user);
    panel.querySelector('[data-member]').hidden = !user;
    panel.querySelector('[data-email]').textContent = user?.email || '';
    panel.querySelector('[data-admin]').hidden = dashboard.hidden = user?.role !== 'admin';
    panel.querySelector('#auth-title').textContent = user ? 'You’re signed in' : (registering ? 'A warm welcome' : 'Welcome back');
    panel.querySelector('.auth-intro').hidden = Boolean(user);
    toggle.textContent = user ? `Hi ${user.first_name || 'there'}` : 'Sign in';
    toggle.title = user ? toggle.textContent : '';
    google.disabled = !googleEnabled;
    panel.querySelector('[data-google-note]').hidden = googleEnabled;
  }
  async function send(path, data) {
    const response = await fetch(`/api/auth/${path}`, {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data || {}),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Sign in could not be completed. Please try again.');
    return result;
  }
  function setBusy(value) {
    busy = value;
    form.setAttribute('aria-busy', String(value));
    submit.disabled = modeButton.disabled = logout.disabled = value;
    submit.textContent = value ? (registering ? 'Creating account…' : 'Signing in…') : (registering ? 'Create account' : 'Sign in');
  }

  toggle.addEventListener('click', () => setOpen(panel.hidden));
  document.addEventListener('click', event => { if (!account.contains(event.target)) setOpen(false, false); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) { setOpen(false); toggle.focus(); }
  });
  account.addEventListener('focusout', event => {
    if (event.relatedTarget && !account.contains(event.relatedTarget)) setOpen(false, false);
  });
  modeButton.addEventListener('click', () => {
    registering = !registering;
    panel.querySelector('[data-names]').hidden = !registering;
    for (const input of [firstName, lastName]) {
      input.disabled = !registering;
      input.required = registering;
    }
    panel.querySelector('#auth-title').textContent = registering ? 'A warm welcome' : 'Welcome back';
    panel.querySelector('.auth-intro').textContent = registering ? 'Create your Priya Parotha account.' : 'Sign in to your Priya Parotha account.';
    panel.querySelector('#password-help').hidden = !registering;
    password.setAttribute('aria-describedby', registering ? 'password-help' : '');
    password.autocomplete = registering ? 'new-password' : 'current-password';
    password.minLength = registering ? 15 : 1;
    modeButton.parentNode.firstChild.textContent = registering ? 'Already have an account? ' : 'New here? ';
    modeButton.textContent = registering ? 'Sign in' : 'Create an account';
    password.value = '';
    showMessage('');
    setBusy(false);
    (registering ? firstName : email).focus();
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    showMessage('');
    if (new TextEncoder().encode(password.value).length > 72) {
      showMessage('That password is too long. Try a shorter password.');
      password.focus();
      return;
    }
    setBusy(true);
    try {
      await send(registering ? 'register' : 'login', {
        email: email.value, password: password.value,
        ...(registering ? { firstName: firstName.value, lastName: lastName.value } : {}),
      });
      password.value = '';
      window.location.assign('/');
    } catch (error) {
      showMessage(error instanceof TypeError ? 'Could not connect. Please try again.' : error.message);
      password.value = '';
      password.focus();
    } finally { setBusy(false); }
  });
  logout.addEventListener('click', async () => {
    if (busy) return;
    setBusy(true);
    logout.textContent = 'Signing out…';
    showMessage('');
    try { await send('logout'); window.location.assign('/'); }
    catch { showMessage('Could not sign out. Please try again.'); }
    finally { setBusy(false); logout.textContent = 'Sign out'; }
  });

  async function loadSession() {
    try {
      const response = await fetch('/api/auth/session', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error();
      const session = await response.json();
      render(session.user, session.googleEnabled);
    } catch { showMessage('Sign in is temporarily unavailable. Please try again later.'); }
    finally { toggle.disabled = false; }
  }
  const errors = {
    admin_required: 'Sign in with an admin account to open the dashboard.',
    google_failed: 'Google sign in was not completed. Please try again.',
    google_unavailable: 'Google sign in is temporarily unavailable. Please use your email and password.',
    account_exists: 'An account already uses that email. Sign in with your email and password.',
    rate_limited: 'Too many attempts. Please wait a minute and try again.',
  };
  const url = new URL(window.location.href);
  const authError = errors[url.searchParams.get('auth_error')];
  if (authError) {
    url.searchParams.delete('auth_error');
    history.replaceState(null, '', url.pathname + url.search + url.hash);
  }
  loadSession().then(() => { if (authError) { showMessage(authError); setOpen(true); } });
  window.addEventListener('pageshow', event => { if (event.persisted) loadSession(); });
}
