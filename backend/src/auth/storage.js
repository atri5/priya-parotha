import { neon } from '@neondatabase/serverless';

export class AuthDatabase {
  constructor(connectionString) {
    this.sql = neon(connectionString);
  }

  async verifyPassword(email, password) {
    const [account] = await this.sql`
      select u.id, u.email, u.username, u.role, u.first_name, u.last_name,
        public.crypt(${password}, coalesce(p.password_hash, '$2a$12$......................'))
          = coalesce(p.password_hash, '') as password_matches
      from (select 1) dummy
      left join public.users u on lower(u.email) = lower(${email})
      left join public.password_credentials p on p.user_id = u.id
    `;
    if (!account?.id || !account.password_matches) return null;
    const { password_matches, ...user } = account;
    return user;
  }

  async registerPassword(email, password, firstName, lastName) {
    const [user] = await this.sql`
      with new_user as (
        insert into public.users (email, role, first_name, last_name) values (${email}, 'customer', ${firstName}, ${lastName})
        returning id, email, username, role, first_name, last_name
      ), credential as (
        insert into public.password_credentials (user_id, password_hash)
        select id, public.crypt(${password}, public.gen_salt('bf', 12)) from new_user returning user_id
      )
      select u.* from new_user u join credential c on c.user_id = u.id
    `;
    return user;
  }

  async getSession(tokenHash) {
    const [user] = await this.sql`
      select u.id, u.email, u.username, u.role, u.first_name, u.last_name
      from public.sessions s join public.users u on u.id = s.user_id
      where s.token_hash = ${tokenHash} and s.expires_at > now()
    `;
    return user || null;
  }

  async createSession(tokenHash, userId, expiresAt, previousHash) {
    await this.sql.transaction([
      this.sql`delete from public.sessions where expires_at <= now() or token_hash = ${previousHash}`,
      this.sql`insert into public.sessions (token_hash, user_id, expires_at) values (${tokenHash}, ${userId}, ${expiresAt})`,
    ]);
  }

  async deleteSession(tokenHash) {
    await this.sql`delete from public.sessions where token_hash = ${tokenHash}`;
  }

  async createOAuthState(stateHash, browserHash, verifier, nonce, expiresAt) {
    await this.sql.transaction([
      this.sql`delete from public.oauth_states where expires_at <= now()`,
      this.sql`
        insert into public.oauth_states (state_hash, browser_hash, code_verifier, nonce, expires_at)
        values (${stateHash}, ${browserHash}, ${verifier}, ${nonce}, ${expiresAt})
      `,
    ]);
  }

  async consumeOAuthState(stateHash, browserHash) {
    const [state] = await this.sql`
      delete from public.oauth_states
      where state_hash = ${stateHash} and browser_hash = ${browserHash} and expires_at > now()
      returning code_verifier, nonce
    `;
    return state;
  }

  async getGoogleUser(subject) {
    const [user] = await this.sql`
      select u.id, u.email, u.username, u.role, u.first_name, u.last_name from public.oauth_accounts a
      join public.users u on u.id = a.user_id
      where a.provider = 'google' and a.provider_user_id = ${subject}
    `;
    return user;
  }

  async createGoogleUser(subject, email, firstName = null, lastName = null) {
    // Both inserts roll back on a duplicate email or Google identity. Never link by email.
    const [user] = await this.sql`
      with new_user as (
        insert into public.users (email, email_verified, role, first_name, last_name)
        values (${email}, true, 'customer', ${firstName}, ${lastName})
        returning id, email, username, role, first_name, last_name
      ), identity as (
        insert into public.oauth_accounts (provider, provider_user_id, user_id)
        select 'google', ${subject}, id from new_user returning user_id
      )
      select u.* from new_user u join identity i on i.user_id = u.id
    `;
    return user;
  }

  async fillGoogleNames(userId, firstName = null, lastName = null) {
    const [user] = await this.sql`
      update public.users set first_name = coalesce(first_name, ${firstName}), last_name = coalesce(last_name, ${lastName})
      where id = ${userId} returning id, email, username, role, first_name, last_name
    `;
    return user;
  }
}
