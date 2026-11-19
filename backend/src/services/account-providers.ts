import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { authReturnPath } from '../../../shared/auth-path.ts';
import type { Config } from '../config.ts';
import { AppError } from '../errors.ts';
import { emailSchema } from './auth.ts';

export const googleCallback = '/api/v1/auth/google/callback';
export const googleCookie = 'sadhana_google_flow';
export const googleFlowLifetime = 10 * 60_000;
export const googleStartInput = z.object({
  mode: z.enum(['login', 'register']),
  returnTo: z.string().max(1024),
}).strict();

const randomToken = z.string().regex(/^[a-zA-Z0-9_-]{43}$/);
const flowSchema = googleStartInput.extend({ state: randomToken, verifier: randomToken, origin: z.url() }).strip();
const googleIdentity = z.object({
  sub: z.string().min(1).max(255), email: emailSchema, email_verified: z.literal(true),
  name: z.string().optional(),
});
const jwtOptions = { issuer: 'interviewforge', audience: 'sadhana-google-flow' };

export function googleAuth(config: Config, providerFetch: typeof fetch = fetch) {
  const { GOOGLE_OAUTH_CLIENT_ID: clientId, GOOGLE_OAUTH_CLIENT_SECRET: clientSecret } = config;
  const enabled = Boolean(clientId && clientSecret);
  const failed = () => new AppError(502, 'GOOGLE_SIGNIN_FAILED', 'Google sign-in could not be completed. Try again.');

  return {
    start(input: z.infer<typeof googleStartInput>, origin: string) {
      if (!enabled) throw new AppError(503, 'GOOGLE_NOT_CONFIGURED', 'Google sign-in is not configured for this instance.');
      const state = randomBytes(32).toString('base64url');
      const verifier = randomBytes(32).toString('base64url');
      const flow = jwt.sign({ ...input, returnTo: authReturnPath(input.returnTo), origin, state, verifier }, config.JWT_SECRET, {
        ...jwtOptions, algorithm: 'HS256', expiresIn: googleFlowLifetime / 1000,
      });
      const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      url.search = new URLSearchParams({
        client_id: clientId!, redirect_uri: origin + googleCallback, response_type: 'code',
        scope: 'openid email profile', prompt: 'select_account', state,
        code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256',
      }).toString();
      return { url: url.href, flow };
    },
    readFlow(cookie: unknown) {
      if (!enabled || typeof cookie !== 'string') return null;
      try {
        const result = flowSchema.safeParse(jwt.verify(cookie, config.JWT_SECRET, { ...jwtOptions, algorithms: ['HS256'] }));
        return result.success ? result.data : null;
      } catch { return null; }
    },
    async identify(code: string, flow: z.infer<typeof flowSchema>) {
      const tokenResult = await providerFetch('https://oauth2.googleapis.com/token', {
        method: 'POST', signal: AbortSignal.timeout(10_000), redirect: 'error',
        body: new URLSearchParams({
          client_id: clientId!, client_secret: clientSecret!, redirect_uri: flow.origin + googleCallback,
          code, code_verifier: flow.verifier, grant_type: 'authorization_code',
        }),
      });
      if (!tokenResult.ok) throw failed();
      const tokens = z.object({ access_token: z.string().min(1) }).safeParse(await tokenResult.json());
      if (!tokens.success) throw failed();
      const profile = await providerFetch('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: { Authorization: 'Bearer ' + tokens.data.access_token },
        signal: AbortSignal.timeout(10_000), redirect: 'error',
      });
      if (!profile.ok) throw failed();
      const identity = googleIdentity.safeParse(await profile.json());
      if (!identity.success) throw failed();
      return identity.data;
    },
  };
}

export function passwordResetMail(config: Config, providerFetch: typeof fetch = fetch) {
  const { RESEND_API_KEY: key, PASSWORD_RESET_FROM: from } = config;
  return key && from ? async (email: string, token: string) => {
    const url = new URL('/reset-password', config.APP_ORIGIN);
    url.hash = new URLSearchParams({ token }).toString();
    const response = await providerFetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from, to: [email], subject: 'Reset your Sadhana Prep password',
        text: 'Open this link to set your Sadhana Prep password. It expires in 30 minutes and can be used once.\n\n' +
          url.href + '\n\nIf you did not make this request, you can ignore this email.',
      }),
      signal: AbortSignal.timeout(10_000), redirect: 'error',
    });
    if (!response.ok) throw new Error('Password reset delivery failed');
  } : undefined;
}
