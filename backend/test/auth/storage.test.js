  import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { test } from 'node:test';
import { AuthDatabase } from '../../src/auth/storage.js';

test('Neon hashes passwords, stores expiring sessions, consumes OAuth state, and protects account ownership', {
  skip: !process.env.DATABASE_URL && 'Run npm run test:auth-db with DATABASE_URL configured',
}, async t => {
  const database = new AuthDatabase(process.env.DATABASE_URL);
  const unique = randomBytes(16).toString('hex');
  const hash = label => createHash('sha256').update(unique + label).digest('hex');
  const password = randomBytes(24).toString('base64url');
  const ids = [];
  t.after(async () => {
    await database.sql`delete from public.oauth_states where state_hash = ${hash('state')}`;
    await database.sql`delete from public.users where id = any(${ids}::text[])`;
  });
  const user = await database.registerPassword(`${unique}@example.invalid`, password, 'Asha', 'Shah');
  ids.push(user.id);
  assert.equal(user.role, 'customer');
  assert.equal(user.first_name, 'Asha');
  assert.equal(user.last_name, 'Shah');
  const [credential] = await database.sql`select password_hash from public.password_credentials where user_id = ${user.id}`;
  assert.match(credential.password_hash, /^\$2a\$12\$/);
  assert.notEqual(credential.password_hash, password);
  assert.deepEqual(await database.verifyPassword(user.email.toUpperCase(), password), user);
  assert.equal(await database.verifyPassword(user.email, 'wrong password'), null);
  assert.equal(await database.verifyPassword(`absent-${unique}@example.invalid`, password), null);
  const expires = new Date(Date.now() + 3600000).toISOString();
  await database.createSession(hash('first'), user.id, expires, null);
  assert.deepEqual(await database.getSession(hash('first')), user);
  await database.createSession(hash('second'), user.id, expires, hash('first'));
  assert.equal(await database.getSession(hash('first')), null);
  await database.sql`update public.sessions set created_at = now() - interval '2 hours', expires_at = now() - interval '1 hour' where token_hash = ${hash('second')}`;
  assert.equal(await database.getSession(hash('second')), null);
  await database.deleteSession(hash('second'));
  await database.createOAuthState(hash('state'), hash('browser'), 'verifier', 'nonce', expires);
  assert.equal(await database.consumeOAuthState(hash('state'), hash('wrong-browser')), undefined);
  assert.deepEqual(await database.consumeOAuthState(hash('state'), hash('browser')), { code_verifier: 'verifier', nonce: 'nonce' });
  assert.equal(await database.consumeOAuthState(hash('state'), hash('browser')), undefined);
  await assert.rejects(database.createGoogleUser(unique, user.email), { code: '23505' });
  assert.equal(await database.getGoogleUser(unique), undefined);
  assert.equal(await database.claimProvisionedGoogleUser(unique, user.email), undefined);
  const googleUser = await database.createGoogleUser(unique, `google-${unique}@example.invalid`);
  ids.push(googleUser.id);
  assert.equal(googleUser.role, 'customer');
  assert.equal(googleUser.first_name, null);
  const namedGoogleUser = await database.fillGoogleNames(googleUser.id, 'Maya', 'Patel');
  assert.equal(namedGoogleUser.first_name, 'Maya');
  assert.equal(namedGoogleUser.last_name, 'Patel');
  assert.deepEqual(await database.fillGoogleNames(googleUser.id, 'Other', 'Name'), namedGoogleUser);
  assert.deepEqual(await database.getGoogleUser(unique), namedGoogleUser);
  const createdGoogleUser = await database.createGoogleUser(`${unique}-named`, `named-${unique}@example.invalid`, 'Neha', 'Sharma');
  ids.push(createdGoogleUser.id);
  assert.equal(createdGoogleUser.first_name, 'Neha');
  assert.equal(createdGoogleUser.last_name, 'Sharma');

  const [provisioned] = await database.sql`
    insert into public.users (email, role, first_name, last_name)
    values (${`provisioned-${unique}@gmail.com`}, 'admin', 'Priyanka', 'Tripathi')
    returning id, email, username, role, first_name, last_name
  `;
  ids.push(provisioned.id);
  const subject = `${unique}-provisioned`;
  // A password account cannot be claimed, even with a matching Gmail address.
  await database.sql`insert into public.password_credentials (user_id, password_hash) select ${provisioned.id}, password_hash from public.password_credentials where user_id = ${user.id}`;
  assert.equal(await database.claimProvisionedGoogleUser(subject, provisioned.email), undefined);
  await database.sql`delete from public.password_credentials where user_id = ${provisioned.id}`;
  await database.createSession(hash('provisioned'), provisioned.id, expires, null);
  assert.equal(await database.claimProvisionedGoogleUser(subject, provisioned.email), undefined);
  await database.deleteSession(hash('provisioned'));
  await database.sql`update public.users set email = ${`provisioned-${unique}@example.invalid`} where id = ${provisioned.id}`;
  assert.equal(await database.claimProvisionedGoogleUser(subject, `provisioned-${unique}@example.invalid`), undefined);
  await database.sql`update public.users set email = ${provisioned.email} where id = ${provisioned.id}`;
  assert.deepEqual(await database.claimProvisionedGoogleUser(subject, provisioned.email.toUpperCase()), provisioned);
  assert.deepEqual(await database.getGoogleUser(subject), provisioned);
  const [verified] = await database.sql`select email_verified from public.users where id = ${provisioned.id}`;
  assert.equal(verified.email_verified, true);
  assert.equal(await database.claimProvisionedGoogleUser(`${subject}-other`, provisioned.email), undefined);
});
