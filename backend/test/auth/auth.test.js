import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { createAuthHandler } from '../../src/auth/auth.js';

test('Auth registers customers, rotates/revokes sessions, rejects CSRF, and consumes Google state once', async () => {
  const origin = 'https://shop.example';
  const user = { id: 'customer-1', email: 'customer@example.com', username: null, role: 'customer', first_name: 'Asha', last_name: 'Shah' };
  const sessions = new Map(), flows = new Map();
  let googleUser, collision = false;
  const database = {
    registerPassword: async (email, password, firstName, lastName) => {
      assert.equal(email, user.email);
      assert.equal(password, 'a sufficiently long password');
      assert.equal(firstName, 'Asha');
      assert.equal(lastName, 'Shah');
      return user;
    },
    verifyPassword: async (email, password) => email === user.email && password === 'a sufficiently long password' ? user : null,
    createSession: async (hash, id, expires, previous) => {
      sessions.delete(previous);
      sessions.set(hash, { user, expires });
      assert.equal(id, user.id);
    },
    getSession: async hash => new Date(sessions.get(hash)?.expires) > new Date() ? sessions.get(hash).user : null,
    deleteSession: async hash => sessions.delete(hash),
    createOAuthState: async (state, browser, verifier, nonce) => flows.set(state, { browser, code_verifier: verifier, nonce }),
    consumeOAuthState: async (state, browser) => {
      const flow = flows.get(state);
      if (flow?.browser !== browser) return;
      flows.delete(state);
      return flow;
    },
    getGoogleUser: async () => googleUser,
    createGoogleUser: async (subject, email, firstName, lastName) => {
      assert.equal(firstName, 'Asha');
      assert.equal(lastName, 'Shah');
      if (collision) throw Object.assign(new Error(), { code: '23505' });
      return googleUser = user;
    },
    fillGoogleNames: async (id, firstName, lastName) => {
      assert.equal(id, user.id);
      assert.equal(firstName, user.first_name);
      assert.equal(lastName, user.last_name);
      return googleUser = user;
    },
  };
  let allowed = true;
  const env = { APP_ORIGIN: origin, DATABASE_URL: 'test-only', GOOGLE_CLIENT_ID: 'client', GOOGLE_CLIENT_SECRET: 'secret',
    AUTH_RATE_LIMIT: { limit: async () => ({ success: allowed }) } };
  const handle = createAuthHandler(() => database, async (code, verifier, nonce) => {
    assert.equal(code, 'google-code');
    assert.ok(verifier && nonce);
    return { subject: 'google-subject', email: user.email, firstName: 'Asha', lastName: 'Shah' };
  });
  const request = (path, data, cookie, extra = {}) => new Request(`${origin}/api/auth/${path}`, {
    method: data ? 'POST' : 'GET', headers: { Origin: origin, 'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}), ...extra }, ...(data ? { body: JSON.stringify(data) } : {}),
  });
  const credentials = { email: ' CUSTOMER@example.com ', password: 'a sufficiently long password', firstName: ' Asha ', lastName: ' Shah ', role: 'admin' };
  const cookieFrom = response => response.headers.getSetCookie().find(value => value.startsWith('__Host-priya_session='))?.split(';')[0];
  let response = await handle(request('register', credentials, null, { Origin: 'https://attacker.example' }), env);
  assert.equal(response.status, 403);
  assert.equal((await handle(request('login', { email: user.email, password: 'wrong' }), env)).status, 401);
  assert.equal((await handle(request('register', { ...credentials, password: 'short' }), env)).status, 400);
  assert.equal((await handle(request('register', { ...credentials, firstName: undefined }), env)).status, 400);
  assert.equal((await handle(request('register', { ...credentials, lastName: ' ' }), env)).status, 400);
  response = await handle(request('register', credentials), env);
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).user, user);
  assert.match(response.headers.get('Set-Cookie'), /Path=\/; HttpOnly; SameSite=Lax; Max-Age=604800; Secure/);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  const firstCookie = cookieFrom(response);
  const rawToken = firstCookie.split('=')[1];
  assert.ok(sessions.has(createHash('sha256').update(rawToken).digest('hex')));
  assert.ok(!sessions.has(rawToken));
  assert.deepEqual((await (await handle(request('session', null, firstCookie), env)).json()).user, user);
  response = await handle(request('login', credentials, firstCookie), env);
  const secondCookie = cookieFrom(response);
  assert.notEqual(firstCookie, secondCookie);
  assert.equal((await (await handle(request('session', null, firstCookie), env)).json()).user, null);
  assert.equal((await handle(request('logout', {}, secondCookie), env)).status, 200);
  assert.equal(sessions.size, 0);
  allowed = false;
  assert.equal((await handle(request('login', credentials), env)).status, 429);
  allowed = true;

  const start = await handle(request('google', {}), env);
  const location = new URL(start.headers.get('Location'));
  const flowCookie = start.headers.get('Set-Cookie').split(';')[0];
  const callback = `google/callback?code=google-code&state=${location.searchParams.get('state')}`;
  response = await handle(request(callback), env);
  assert.match(response.headers.get('Location'), /google_failed/);
  response = await handle(request(callback, null, flowCookie), env);
  assert.equal(response.headers.get('Location'), '/');
  assert.equal(response.headers.getSetCookie().length, 2);
  assert.ok(cookieFrom(response));
  response = await handle(request(callback, null, flowCookie), env);
  assert.match(response.headers.get('Location'), /google_failed/);

  googleUser = { ...user, first_name: null, last_name: null };
  const legacy = await handle(request('google', {}), env);
  const legacyState = new URL(legacy.headers.get('Location')).searchParams.get('state');
  response = await handle(request(`google/callback?code=google-code&state=${legacyState}`, null, legacy.headers.get('Set-Cookie').split(';')[0]), env);
  assert.equal(response.headers.get('Location'), '/');
  assert.equal(googleUser.first_name, 'Asha');

  googleUser = undefined;
  collision = true;
  const retry = await handle(request('google', {}), env);
  const retryState = new URL(retry.headers.get('Location')).searchParams.get('state');
  response = await handle(request(`google/callback?code=google-code&state=${retryState}`, null, retry.headers.get('Set-Cookie').split(';')[0]), env);
  assert.match(response.headers.get('Location'), /account_exists/);
  assert.equal(cookieFrom(response), undefined);
});
