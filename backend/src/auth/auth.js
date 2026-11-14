import { createHash, randomBytes } from 'node:crypto';
import { AuthDatabase } from './storage.js';
import { exchangeGoogleCode, googleAuthorizationURL } from './google.js';

const SESSION_SECONDS = 7 * 24 * 60 * 60;
const FLOW_SECONDS = 10 * 60;
const token = () => randomBytes(32).toString('base64url');
const digest = value => createHash('sha256').update(value).digest('hex');
const validToken = value => typeof value === 'string' && /^[\w-]{43}$/.test(value);
const requestCookies = request => new Map((request.headers.get('Cookie') || '').split(';').map(part => {
  const separator = part.indexOf('=');
  return [part.slice(0, separator).trim(), part.slice(separator + 1)];
}));

export function getSessionHash(request) {
  const url = new URL(request.url);
  const local = url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  const value = requestCookies(request).get(local ? 'priya_session' : '__Host-priya_session');
  return validToken(value) ? digest(value) : null;
}

export async function getSessionUser(request, env) {
  const hash = getSessionHash(request);
  return hash ? new AuthDatabase(env.DATABASE_URL).getSession(hash) : null;
}

const json = (data, status = 200, headers = {}) => Response.json(data, {
  status, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', ...headers },
});
const redirect = (location, cookies = []) => new Response(null, {
  status: 303, headers: [ ['Location', location], ['Cache-Control', 'no-store'], ['Referrer-Policy', 'no-referrer'],
    ...cookies.map(value => ['Set-Cookie', value]) ],
});

export function createAuthHandler(databaseFactory = env => new AuthDatabase(env.DATABASE_URL), googleExchange = exchangeGoogleCode) {
  return async function handleAuth(request, env) {
    const url = new URL(request.url);
    const local = url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    const origin = local ? url.origin : env.APP_ORIGIN;
    const sessionName = local ? 'priya_session' : '__Host-priya_session';
    const flowName = local ? 'priya_oauth' : '__Host-priya_oauth';
    const cookie = (name, value, seconds) => `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${seconds}${local ? '' : '; Secure'}`;
    const cookies = requestCookies(request);
    const sessionToken = cookies.get(sessionName);
    const sessionHash = getSessionHash(request);
    const googleEnabled = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
    const callback = url.pathname === '/api/auth/google/callback';
    const failure = (message, status) => json({ error: message }, status);

    if (!origin || url.origin !== origin || (!local && url.protocol !== 'https:')) return failure('Sign in is not configured for this address.', 503);
    const routes = {
      '/api/auth/session': 'GET', '/api/auth/login': 'POST', '/api/auth/register': 'POST',
      '/api/auth/logout': 'POST', '/api/auth/google': 'POST', '/api/auth/google/callback': 'GET',
    };
    if (!routes[url.pathname]) return failure('Not found', 404);
    if (request.method !== routes[url.pathname]) return json({ error: 'Method not allowed' }, 405, { Allow: routes[url.pathname] });
    if (request.method === 'POST' && request.headers.get('Origin') !== origin) return failure('Please sign in from this website.', 403);
    if (!env.DATABASE_URL) return failure('Sign in is temporarily unavailable. Please try again later.', 503);

    try {
      const database = databaseFactory(env);
      const setSession = async user => {
        const value = token();
        await database.createSession(digest(value), user.id, new Date(Date.now() + SESSION_SECONDS * 1000).toISOString(), sessionHash);
        return cookie(sessionName, value, SESSION_SECONDS);
      };
      if (url.pathname === '/api/auth/session') {
        const user = sessionHash ? await database.getSession(sessionHash) : null;
        return json({ user, googleEnabled }, 200, !user && sessionToken ? { 'Set-Cookie': cookie(sessionName, '', 0) } : {});
      }
      if (url.pathname === '/api/auth/logout') {
        if (sessionHash) await database.deleteSession(sessionHash);
        return json({ redirectTo: '/' }, 200, { 'Set-Cookie': cookie(sessionName, '', 0) });
      }

      // Apply limits before expensive password work or external OAuth requests.
      if (!env.AUTH_RATE_LIMIT) return failure('Sign in is temporarily unavailable. Please try again later.', 503);
      const ip = request.headers.get('CF-Connecting-IP') || 'local';
      if (!(await env.AUTH_RATE_LIMIT.limit({ key: `ip:${digest(ip)}` })).success) {
        if (callback) return redirect('/?auth_error=rate_limited', [cookie(flowName, '', 0)]);
        return json({ error: 'Too many attempts. Please wait a minute and try again.' }, 429, { 'Retry-After': '60' });
      }

      if (url.pathname === '/api/auth/google') {
        if (!googleEnabled) return redirect('/?auth_error=google_unavailable');
        const state = token(), browser = token(), verifier = token(), nonce = token();
        await database.createOAuthState(digest(state), digest(browser), verifier, nonce, new Date(Date.now() + FLOW_SECONDS * 1000).toISOString());
        return redirect(googleAuthorizationURL(env.GOOGLE_CLIENT_ID, `${origin}/api/auth/google/callback`, state, verifier, nonce).href,
          [cookie(flowName, browser, FLOW_SECONDS)]);
      }
      if (callback) {
        const clear = cookie(flowName, '', 0);
        const state = url.searchParams.get('state'), browser = cookies.get(flowName);
        if (!googleEnabled || !validToken(state) || !validToken(browser)) return redirect('/?auth_error=google_failed', [clear]);
        const flow = await database.consumeOAuthState(digest(state), digest(browser));
        if (!flow || url.searchParams.has('error')) return redirect('/?auth_error=google_failed', [clear]);
        const code = url.searchParams.get('code');
        if (!code || code.length > 4096) return redirect('/?auth_error=google_failed', [clear]);
        const identity = await googleExchange(code, flow.code_verifier, flow.nonce, env, `${origin}/api/auth/google/callback`);
        let user = await database.getGoogleUser(identity.subject);
        if (!user) {
          try { user = await database.createGoogleUser(identity.subject, identity.email, identity.firstName, identity.lastName); }
          catch (error) {
            if (error.code !== '23505') throw error;
            user = await database.getGoogleUser(identity.subject)
              || await database.claimProvisionedGoogleUser(identity.subject, identity.email);
            if (!user) return redirect('/?auth_error=account_exists', [clear]);
          }
        }
        if ((!user.first_name && identity.firstName) || (!user.last_name && identity.lastName)) {
          user = await database.fillGoogleNames(user.id, identity.firstName, identity.lastName);
        }
        return redirect('/', [await setSession(user), clear]);
      }

      if (request.headers.get('Content-Type')?.split(';')[0].trim() !== 'application/json') return failure('Send a JSON request.', 415);
      // Bound the body even when Content-Length is missing or inaccurate.
      const reader = request.body?.getReader();
      let body = '', bytes = 0;
      const decoder = new TextDecoder();
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.byteLength;
          if (bytes > 4096) { await reader.cancel(); return failure('The sign in request is too large.', 413); }
          body += decoder.decode(value, { stream: true });
        }
      }
      let data;
      try { data = JSON.parse(body + decoder.decode()); }
      catch { return failure('Please check your email and password.', 400); }
      if (!data || typeof data.email !== 'string' || typeof data.password !== 'string') return failure('Enter your email and password.', 400);
      const email = data.email.trim().toLowerCase(), password = data.password;
      if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return failure('Enter a valid email address.', 400);
      if (!password || password.includes('\0')) return failure('Enter a valid password.', 400);
      if (new TextEncoder().encode(password).length > 72) return failure('That password is too long. Try a shorter password.', 400);
      if (!(await env.AUTH_RATE_LIMIT.limit({ key: `email:${digest(email)}` })).success) {
        return json({ error: 'Too many attempts. Please wait a minute and try again.' }, 429, { 'Retry-After': '60' });
      }
      let user;
      if (url.pathname === '/api/auth/register') {
        const names = {};
        for (const [field, label] of [['firstName', 'first name'], ['lastName', 'last name']]) {
          const value = typeof data[field] === 'string' ? data[field].trim() : '';
          if (!value || Array.from(value).length > 100 || /[\u0000-\u001f\u007f]/.test(value)) {
            return failure(`Enter your ${label} using 1 to 100 characters.`, 400);
          }
          names[field] = value;
        }
        if (Array.from(password).length < 15) return failure('Use a password with at least 15 characters.', 400);
        try { user = await database.registerPassword(email, password, names.firstName, names.lastName); }
        catch (error) {
          if (error.code !== '23505') throw error;
          return failure('An account could not be created with those details. Try signing in.', 409);
        }
      } else {
        user = await database.verifyPassword(email, password);
        if (!user) return failure('The email or password is incorrect.', 401);
      }
      return json({ user, redirectTo: '/' }, 200, { 'Set-Cookie': await setSession(user) });
    } catch (error) {
      console.error(JSON.stringify({ message: 'Authentication request failed', code: error.code || 'unknown' }));
      if (callback) return redirect('/?auth_error=google_failed', [cookie(flowName, '', 0)]);
      return failure('Sign in could not be completed. Please try again.', 500);
    }
  };
}

export const handleAuth = createAuthHandler();
