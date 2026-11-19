import { createHash, randomBytes, randomUUID, scrypt as deriveKey, timingSafeEqual } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import type { User } from '../../../shared/contracts.ts';
import type { Config } from '../config.ts';
import { DuplicateRecord, type Account, type RefreshSession, type Store } from '../db/store.ts';
import { AppError, conflict } from '../errors.ts';

export const emailSchema = z.email().trim().toLowerCase().max(254);
const currentPasswordSchema = z.string().min(1).max(128);
const newPasswordSchema = z.string().min(12).max(128);
export const loginSchema = z.object({ email: emailSchema, password: currentPasswordSchema }).strict();
export const registerSchema = loginSchema.extend({
  name: z.string().trim().min(2).max(80),
  password: newPasswordSchema,
});
export const changePasswordSchema = z.object({
  password: newPasswordSchema, confirmPassword: newPasswordSchema,
}).strict().refine(input => input.password === input.confirmPassword, { path: ['confirmPassword'] });
export const requestResetSchema = z.object({ email: emailSchema }).strict();
export const resetPasswordSchema = z.object({ token: z.string().max(80), password: newPasswordSchema }).strict();
export const profileSchema = z.object({ name: z.string().trim().min(2).max(80), voiceEnabled: z.boolean() }).partial().strict();
export const refreshCookie = 'forge_refresh';
export const refreshLifetime = 30 * 24 * 60 * 60 * 1000;
const resetLifetime = 30 * 60_000;
const jwtOptions = { issuer: 'interviewforge', audience: 'interviewforge-web' };
const cookiePattern = /^([a-f0-9-]{36})\.([a-zA-Z0-9_-]{43})$/;
const dummyHash = '0'.repeat(32) + ':' + '0'.repeat(128);
let activeDerivations = 0;

export function digest(text: string) {
  return createHash('sha256').update(text).digest('hex');
}

function unauthorized(message = 'Please sign in to continue.'): never {
  throw new AppError(401, 'UNAUTHORIZED', message);
}

async function passwordKey(password: string, salt: string): Promise<Buffer> {
  if (activeDerivations >= 4) throw new AppError(429, 'AUTH_BUSY', 'Sign-in is busy. Try again in a moment.');
  activeDerivations++;
  try {
    return await new Promise((resolve, reject) => {
      deriveKey(password, salt, 64, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 },
        (error, key) => error ? reject(error) : resolve(key));
    });
  } finally {
    activeDerivations--;
  }
}

async function passwordHash(password: string) {
  const salt = randomBytes(16).toString('hex');
  return salt + ':' + (await passwordKey(password, salt)).toString('hex');
}

async function passwordMatches(password: string, hash: string) {
  const [salt, hex] = hash.split(':');
  if (!salt || !hex || !/^[a-f0-9]{128}$/.test(hex)) return false;
  return timingSafeEqual(await passwordKey(password, salt), Buffer.from(hex, 'hex'));
}

export function publicUser(account: Account): User {
  const { id, name, email, role, voiceEnabled } = account;
  return { id, name, email, role, voiceEnabled, passwordEnabled: Boolean(account.passwordHash) };
}

export function authService(store: Store, config: Config) {
  function response(account: Account, sessionId: string, refreshToken: string) {
    const accessToken = jwt.sign({ sid: sessionId }, config.JWT_SECRET, {
      ...jwtOptions, algorithm: 'HS256', expiresIn: '15m', subject: account.id,
    });
    return { user: publicUser(account), accessToken, refreshToken };
  }

  async function begin(account: Account) {
    const id = randomUUID();
    const refreshToken = id + '.' + randomBytes(32).toString('base64url');
    await store.refresh.insert({
      id, owner: account.id, tokenHash: digest(refreshToken), oldHashes: [], credentialVersion: account.credentialVersion,
      expiresAt: new Date(Date.now() + refreshLifetime), revoked: false,
    });
    return response(account, id, refreshToken);
  }

  async function cookieSession(cookie: unknown) {
    const id = typeof cookie === 'string' ? cookiePattern.exec(cookie)?.[1] : undefined;
    if (!id || typeof cookie !== 'string') return null;
    const record = await store.refresh.get({ id, revoked: false });
    if (!record || record.expiresAt.getTime() <= Date.now()) return null;
    return { record, hash: digest(cookie) };
  }

  async function rejectReplay(record: RefreshSession, hash: string): Promise<never> {
    if (record.oldHashes.includes(hash)) await store.refresh.update({ id: record.id }, { revoked: true });
    return unauthorized('Your session expired. Please sign in again.');
  }

  function resetLinkInvalid(): never {
    throw new AppError(400, 'INVALID_RESET_LINK', 'This password reset link is invalid or expired. Request a new link.');
  }

  async function replacePassword(account: Account, hash: string, resetHash?: string) {
    return store.accounts.update({
      id: account.id, passwordHash: account.passwordHash, ...(resetHash ? { resetHash } : {}),
    }, { passwordHash: hash, credentialVersion: randomUUID(), resetHash: null, resetExpiresAt: null });
  }

  return {
    async register(input: z.infer<typeof registerSchema>) {
      const account: Account = {
        id: randomUUID(), name: input.name, email: input.email, role: 'candidate', voiceEnabled: true,
        passwordHash: await passwordHash(input.password), createdAt: new Date().toISOString(),
      };
      try {
        await store.accounts.insert(account);
      } catch (error) {
        if (error instanceof DuplicateRecord) conflict('An account already exists with that email address.');
        throw error;
      }
      return begin(account);
    },
    async login(input: z.infer<typeof loginSchema>) {
      const account = await store.accounts.get({ email: input.email });
      const valid = await passwordMatches(input.password, account?.passwordHash ?? dummyHash);
      if (!account?.passwordHash || !valid) return unauthorized('The email or password is incorrect.');
      return begin(account);
    },
    async googleLogin(identity: { sub: string; email: string; name?: string }) {
      const linked = await store.accounts.get({ googleSub: identity.sub });
      if (linked) return begin(linked);
      if (await store.accounts.get({ email: identity.email })) {
        throw new AppError(409, 'GOOGLE_EMAIL_IN_USE', 'Sign in with the password for your existing Sadhana Prep account.');
      }
      const account: Account = {
        id: randomUUID(), name: identity.name?.trim().slice(0, 80) || 'Google user', email: identity.email,
        googleSub: identity.sub, passwordHash: null, role: 'candidate', voiceEnabled: true, createdAt: new Date().toISOString(),
      };
      try {
        await store.accounts.insert(account);
      } catch (error) {
        if (!(error instanceof DuplicateRecord)) throw error;
        const concurrent = await store.accounts.get({ googleSub: identity.sub });
        if (concurrent) return begin(concurrent);
        throw new AppError(409, 'GOOGLE_EMAIL_IN_USE', 'Sign in with the password for your existing Sadhana Prep account.');
      }
      return begin(account);
    },
    async changePassword(user: User, input: z.infer<typeof changePasswordSchema>) {
      const account = await store.accounts.get({ id: user.id });
      if (!account?.passwordHash) {
        throw new AppError(400, 'PASSWORD_UNAVAILABLE', 'Request an email link to set a password for this account.');
      }
      const updated = await replacePassword(account, await passwordHash(input.password));
      if (!updated) return conflict('The password was already changed. Sign in again and retry.');
      return begin(updated);
    },
    async requestReset(email: string, send: (email: string, token: string) => Promise<void>) {
      const account = await store.accounts.get({ email });
      if (!account || (account.resetExpiresAt ?? 0) > Date.now() + resetLifetime - 60_000) return;
      const token = account.id + '.' + randomBytes(32).toString('base64url');
      const resetHash = digest(token);
      const updated = await store.accounts.update(
        { id: account.id, passwordHash: account.passwordHash, resetHash: account.resetHash ?? null },
        { resetHash, resetExpiresAt: Date.now() + resetLifetime },
      );
      if (!updated) return;
      try {
        await send(account.email, token);
      } catch (error) {
        await store.accounts.update({ id: account.id, resetHash }, { resetHash: null, resetExpiresAt: null });
        throw error;
      }
    },
    async resetPassword(input: z.infer<typeof resetPasswordSchema>) {
      const id = cookiePattern.exec(input.token)?.[1];
      const resetHash = digest(input.token);
      const account = id ? await store.accounts.get({ id, resetHash }) : null;
      if (!account?.resetExpiresAt || account.resetExpiresAt <= Date.now()) return resetLinkInvalid();
      const hash = await passwordHash(input.password);
      if (account.resetExpiresAt <= Date.now()) return resetLinkInvalid();
      if (!await replacePassword(account, hash, resetHash)) return resetLinkInvalid();
    },
    async refresh(cookie: unknown) {
      const existing = await cookieSession(cookie);
      if (!existing) return unauthorized();
      const { record, hash } = existing;
      if (record.tokenHash !== hash) return rejectReplay(record, hash);
      const account = await store.accounts.get({ id: record.owner });
      if (!account || account.credentialVersion !== record.credentialVersion) return unauthorized();
      const next = record.id + '.' + randomBytes(32).toString('base64url');
      const rotated = await store.refresh.update({ id: record.id, tokenHash: hash, revoked: false }, {
        tokenHash: digest(next), oldHashes: [hash, ...record.oldHashes].slice(0, 8),
      });
      if (!rotated) throw new AppError(409, 'REFRESH_RACE', 'A session refresh is already in progress. Retry shortly.');
      return response(account, record.id, next);
    },
    async logout(cookie: unknown) {
      const existing = await cookieSession(cookie);
      if (existing && existing.record.tokenHash === existing.hash) {
        await store.refresh.update({ id: existing.record.id }, { revoked: true });
      }
    },
    async authenticate(header: string | undefined) {
      if (!header?.startsWith('Bearer ')) return unauthorized();
      const claims = (() => {
        try {
          return jwt.verify(header.slice(7), config.JWT_SECRET, { ...jwtOptions, algorithms: ['HS256'] });
        } catch { return unauthorized(); }
      })();
      if (typeof claims !== 'object' || typeof claims.sub !== 'string' || typeof claims.sid !== 'string') return unauthorized();
      const [account, session] = await Promise.all([
        store.accounts.get({ id: claims.sub }), store.refresh.get({ id: claims.sid, owner: claims.sub, revoked: false }),
      ]);
      if (!account || !session || account.credentialVersion !== session.credentialVersion || session.expiresAt.getTime() <= Date.now()) return unauthorized();
      return publicUser(account);
    },
    async profile(user: User, input: z.infer<typeof profileSchema>) {
      const account = await store.accounts.update({ id: user.id }, input);
      if (!account) return unauthorized();
      return publicUser(account);
    },
  };
}
