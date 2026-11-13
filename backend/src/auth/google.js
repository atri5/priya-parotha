import { createHash, timingSafeEqual } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';

export function googleAuthorizationURL(clientId, redirectURI, state, verifier, nonce) {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({
    client_id: clientId, redirect_uri: redirectURI, response_type: 'code',
    scope: 'openid email profile', state, nonce, prompt: 'select_account',
    code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256',
  }).toString();
  return url;
}

export async function verifyGoogleToken(token, clientId, nonce, keys) {
  const { payload } = await jwtVerify(token, keys || createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs')), {
    algorithms: ['RS256'], issuer: ['https://accounts.google.com', 'accounts.google.com'], audience: clientId,
    requiredClaims: ['sub', 'email', 'email_verified', 'nonce', 'iat', 'exp'], maxTokenAge: '10m', clockTolerance: 5,
  });
  const digest = value => createHash('sha256').update(value).digest();
  if (typeof payload.nonce !== 'string' || !timingSafeEqual(digest(payload.nonce), digest(nonce))
    || (payload.azp !== undefined && payload.azp !== clientId)
    || payload.email_verified !== true || typeof payload.email !== 'string'
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email) || payload.email.length > 254
    || typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 255 || /\s/.test(payload.sub)) {
    throw new Error('Invalid Google identity');
  }
  const name = value => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed && Array.from(trimmed).length <= 100 && !/[\u0000-\u001f\u007f]/.test(trimmed) ? trimmed : null;
  };
  return { subject: payload.sub, email: payload.email.toLowerCase(), firstName: name(payload.given_name), lastName: name(payload.family_name) };
}

export async function exchangeGoogleCode(code, verifier, nonce, env, redirectURI) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', signal: AbortSignal.timeout(10000),
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET,
      code, code_verifier: verifier, redirect_uri: redirectURI, grant_type: 'authorization_code',
    }),
  });
  if (!response.ok) throw new Error('Google token exchange failed');
  const tokens = await response.json();
  return verifyGoogleToken(tokens.id_token, env.GOOGLE_CLIENT_ID, nonce);
}
