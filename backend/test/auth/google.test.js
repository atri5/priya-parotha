import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { googleAuthorizationURL, verifyGoogleToken } from '../../src/auth/google.js';

test('Google uses PKCE and verifies signature, audience, nonce, expiry, and verified email', async () => {
  const url = googleAuthorizationURL('client-id', 'https://shop.example/api/auth/google/callback', 'state', 'verifier', 'nonce');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.notEqual(url.searchParams.get('code_challenge'), 'verifier');
  assert.equal(url.searchParams.get('state'), 'state');
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const keys = createLocalJWKSet({ keys: [{ ...await exportJWK(publicKey), kid: 'test-key' }] });
  const sign = (overrides = {}) => new SignJWT({ email: 'customer@example.com', email_verified: true, nonce: 'nonce', given_name: ' Asha ', family_name: 'Shah', ...overrides })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' }).setIssuer('https://accounts.google.com')
    .setAudience('client-id').setSubject('google-subject').setIssuedAt().setExpirationTime('1h').sign(privateKey);
  const token = await sign();
  assert.deepEqual(await verifyGoogleToken(token, 'client-id', 'nonce', keys), {
    subject: 'google-subject', email: 'customer@example.com', firstName: 'Asha', lastName: 'Shah',
  });
  const unnamed = await verifyGoogleToken(await sign({ given_name: null, family_name: null }), 'client-id', 'nonce', keys);
  assert.equal(unnamed.firstName, null);
  assert.equal(unnamed.lastName, null);
  await assert.rejects(verifyGoogleToken(token, 'another-client', 'nonce', keys));
  const wrongKey = await generateKeyPair('RS256');
  await assert.rejects(verifyGoogleToken(token, 'client-id', 'nonce', createLocalJWKSet({
    keys: [{ ...await exportJWK(wrongKey.publicKey), kid: 'test-key' }],
  })));
  await assert.rejects(verifyGoogleToken(token, 'client-id', 'wrong-nonce', keys));
  await assert.rejects(verifyGoogleToken(await sign({ email_verified: false }), 'client-id', 'nonce', keys));
  const expired = await new SignJWT({ email: 'customer@example.com', email_verified: true, nonce: 'nonce' })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' }).setIssuer('https://accounts.google.com')
    .setAudience('client-id').setSubject('google-subject').setIssuedAt().setExpirationTime(1).sign(privateKey);
  await assert.rejects(verifyGoogleToken(expired, 'client-id', 'nonce', keys));
});
