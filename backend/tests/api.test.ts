import { createHash, randomUUID } from 'node:crypto';
import { createConnection } from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { syntheticResume } from '../../tests/fixtures/resume.ts';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import { connectStore, memoryStore, type Store } from '../src/db/store.ts';
import { AppError } from '../src/errors.ts';
import { buildCoachingAI, type CoachingAI } from '../src/services/ai/coaching.ts';
import { reportWorker } from '../src/services/reports.ts';

const origin = 'http://localhost:5173';
const prefix = '/api/v1';
const config = loadConfig({ NODE_ENV: 'test', DATA_STORE: 'memory', JWT_SECRET: 't'.repeat(64), APP_ORIGIN: origin });
const password = 'This is a test-only password';
const setup = { track: 'mern', difficulty: 'intermediate', minutes: 20 };
let store: Store;
let app: ReturnType<typeof createApp>;
let ai: CoachingAI;
let clock: number;
let database: URL | null;

beforeAll(async () => {
  const uri = process.env.TEST_MONGO_URI;
  database = uri ? new URL(uri) : null;
  if (database) database.pathname = '/forge_test_' + randomUUID().replaceAll('-', '').slice(0, 24);
  store = database ? await connectStore(database.href) : memoryStore();
  ai = await buildCoachingAI(config);
  clock = Date.now();
  app = createApp({ config, store, ai, now: () => clock });
});
afterAll(async () => {
  if (store) await store.close();
  if (database) {
    const connection = await createConnection(database.href).asPromise();
    try { await connection.dropDatabase(); } finally { await connection.close(); }
  }
});

async function register(name: string, server = app) {
  const email = randomUUID() + '@example.com';
  const result = await request(server).post(prefix + '/auth/register').set('Origin', origin)
    .send({ name, email, password }).expect(201);
  const cookie = (result.headers['set-cookie'] as unknown as string[])[0]!;
  return { token: 'Bearer ' + result.body.data.accessToken, email, cookie, id: result.body.data.user.id };
}

describe('Google sign-in and password management', () => {
  it('uses Google state and PKCE, resumes the requested route, and keeps existing password accounts separate', async () => {
    const email = randomUUID() + '@gmail.com';
    const sub = randomUUID();
    const providerFetch = vi.fn<typeof fetch>(async input => String(input).includes('/token')
      ? Response.json({ access_token: 'test-provider-token' })
      : Response.json({ sub, email, name: 'Google Example', email_verified: true }));
    const googleApp = createApp({ config: { ...config, GOOGLE_OAUTH_CLIENT_ID: 'test-client', GOOGLE_OAUTH_CLIENT_SECRET: 'test-secret' },
      store, ai, providerFetch });
    async function start(returnTo: string) {
      const result = await request(googleApp).post(prefix + '/auth/google/start').set('Origin', origin)
        .send({ mode: 'register', returnTo }).expect(200);
      const [flowCookie] = result.headers['set-cookie'] as unknown as string[];
      expect(flowCookie).toMatch(/HttpOnly; SameSite=Lax/);
      return { cookie: flowCookie.split(';')[0]!, url: new URL(result.body.data.url) };
    }
    const { cookie, url } = await start('/prep-hub/dsa?view=sheet');
    expect(url.origin).toBe('https://accounts.google.com');
    expect(url.searchParams.get('redirect_uri')).toBe(origin + prefix + '/auth/google/callback');
    const callback = prefix + '/auth/google/callback';
    await request(googleApp).get(callback).set('Cookie', cookie).query({ state: 'wrong', code: 'test-code' }).expect(303);
    expect(providerFetch).not.toHaveBeenCalled();
    const result = await request(googleApp).get(callback).set('Cookie', cookie)
      .query({ state: url.searchParams.get('state'), code: 'test-code' }).expect(303);
    expect(result.headers.location).toBe('/prep-hub/dsa?view=sheet');
    const [, tokenOptions] = providerFetch.mock.calls[0]!;
    const verifier = (tokenOptions?.body as URLSearchParams).get('code_verifier')!;
    expect(url.searchParams.get('code_challenge')).toBe(createHash('sha256').update(verifier).digest('base64url'));
    const refresh = (result.headers['set-cookie'] as unknown as string[]).find(value => value.startsWith('forge_refresh='))!;
    const session = await request(googleApp).post(prefix + '/auth/refresh').set('Origin', origin).set('Cookie', refresh.split(';')[0]!).expect(200);
    expect(session.body.data.user).toMatchObject({ email, name: 'Google Example', passwordEnabled: false });

    const existing = await register('Password Example');
    providerFetch.mockImplementation(async input => String(input).includes('/token')
      ? Response.json({ access_token: 'test-provider-token' })
      : Response.json({ sub: randomUUID(), email: existing.email, email_verified: true }));
    const duplicate = await start('//example.com');
    const refusal = await request(googleApp).get(callback).set('Cookie', duplicate.cookie)
      .query({ state: duplicate.url.searchParams.get('state'), code: 'other-code' }).expect(303);
    expect(refusal.headers.location).toBe('/register?google=email-in-use&next=%2Fdashboard');
    expect((await store.accounts.get({ id: existing.id }))?.googleSub).toBeUndefined();
  });

  it('requires an authenticated session and matching confirmation and invalidates old sessions on change', async () => {
    const user = await register('Password Change Example');
    const newPassword = 'A different test password';
    await request(app).post(prefix + '/auth/password/change').set('Origin', origin)
      .send({ password: newPassword, confirmPassword: newPassword }).expect(401);
    const change = (confirmPassword: string) => request(app).post(prefix + '/auth/password/change')
      .set('Origin', origin).set('Authorization', user.token).send({ password: newPassword, confirmPassword });
    await change('Does not match the password').expect(400);
    const result = await change(newPassword).expect(200);
    await request(app).get(prefix + '/me').set('Authorization', user.token).expect(401);
    await request(app).post(prefix + '/auth/refresh').set('Origin', origin).set('Cookie', user.cookie.split(';')[0]!).expect(401);
    await request(app).get(prefix + '/me').set('Authorization', 'Bearer ' + result.body.data.accessToken).expect(200);
    await request(app).post(prefix + '/auth/login').set('Origin', origin).send({ email: user.email, password }).expect(401);
    await request(app).post(prefix + '/auth/login').set('Origin', origin).send({ email: user.email, password: newPassword }).expect(200);
  });

  it('sends an email reset link with a one-use token and rejects revoked credentials', async () => {
    const delivery = vi.fn<typeof fetch>(async () => Response.json({ id: 'test-mail-delivery' }));
    const resetApp = createApp({ config: { ...config, RESEND_API_KEY: 'test-key', PASSWORD_RESET_FROM: 'reset@example.org' },
      store, ai, providerFetch: delivery });
    const user = await register('Recovery Example', resetApp);
    const forgot = (email: string) => request(resetApp).post(prefix + '/auth/password/forgot').set('Origin', origin).send({ email });
    await forgot('missing@example.org').expect(202, { data: null });
    await forgot(user.email).expect(202, { data: null });
    await expect.poll(() => delivery.mock.calls.length).toBe(1);
    const [endpoint, options] = delivery.mock.calls[0]!;
    const payload = JSON.parse(String(options?.body));
    expect(endpoint).toBe('https://api.resend.com/emails');
    expect(payload.to).toEqual([user.email]);
    const link = new URL(payload.text.split('\n\n')[1]);
    expect(link.origin + link.pathname).toBe(origin + '/reset-password');
    const token = new URLSearchParams(link.hash.slice(1)).get('token')!;
    expect((await store.accounts.get({ id: user.id }))?.resetHash).toBe(createHash('sha256').update(token).digest('hex'));
    const newPassword = 'A recovered test password';
    const reset = () => request(resetApp).post(prefix + '/auth/password/reset').set('Origin', origin).send({ token, password: newPassword });
    await reset().expect(204);
    await reset().expect(400);
    await request(resetApp).get(prefix + '/me').set('Authorization', user.token).expect(401);
    await request(resetApp).post(prefix + '/auth/login').set('Origin', origin).send({ email: user.email, password: newPassword }).expect(200);
  });
});

describe('private interview API', () => {
  it('limits local preview auth to its two addresses and accepts email and password', async () => {
    const previewStore = memoryStore();
    const config = loadConfig({
      NODE_ENV: 'test', PORT: '3002', DATA_STORE: 'memory', JWT_SECRET: 't'.repeat(64), APP_ORIGIN: 'http://localhost:3002',
    });
    const preview = createApp({ config, store: previewStore, ai });
    const email = randomUUID() + '@example.com';
    try {
      await request(preview).post(prefix + '/auth/demo').set('Origin', 'http://localhost:3002').expect(404);
      await request(preview).post(prefix + '/auth/register').set('Origin', 'http://localhost:3001').expect(403);
      await request(preview).post(prefix + '/auth/login').set('Origin', 'https://example.org').expect(403);
      const registration = await request(preview).post(prefix + '/auth/register').set('Origin', 'http://127.0.0.1:3002')
        .send({ name: 'Local Candidate', email, password }).expect(201);
      const login = await request(preview).post(prefix + '/auth/login').set('Origin', 'http://localhost:3002')
        .send({ email, password }).expect(200);
      expect(login.body.data.user.id).toBe(registration.body.data.user.id);
    } finally {
      await previewStore.close();
    }
  });

  it('registers, protects, rotates, revokes a replayed cookie and signs out', async () => {
    await request(app).get(prefix + '/me').expect(401);
    await request(app).post(prefix + '/auth/register').set('Origin', 'https://example.org').expect(403);
    const user = await register('Alex Example');
    expect(user.cookie).toMatch(/HttpOnly; SameSite=Strict/i);
    await request(app).get(prefix + '/me').set('Authorization', user.token).expect(200).expect(response => {
      expect(response.body.data).not.toHaveProperty('passwordHash');
      expect(response.body.data.role).toBe('candidate');
    });
    await request(app).post(prefix + '/auth/login').set('Origin', origin).send({ email: user.email, password: 'incorrect' }).expect(401);
    const rotated = await request(app).post(prefix + '/auth/refresh').set('Origin', origin).set('Cookie', user.cookie.split(';')[0]!).expect(200);
    await request(app).post(prefix + '/auth/refresh').set('Origin', origin).set('Cookie', user.cookie.split(';')[0]!).expect(401);
    await request(app).get(prefix + '/me').set('Authorization', 'Bearer ' + rotated.body.data.accessToken).expect(401);
    const login = await request(app).post(prefix + '/auth/login').set('Origin', origin).send({ email: user.email, password }).expect(200);
    const cookie = (login.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;
    await request(app).post(prefix + '/auth/logout').set('Origin', origin).set('Cookie', cookie).expect(204);
    await request(app).get(prefix + '/me').set('Authorization', 'Bearer ' + login.body.data.accessToken).expect(401);
  });

  it('parses a real PDF, checks ownership and generates a role-based session', async () => {
    const user = await register('Resume Tester');
    const stranger = await register('Second Candidate');
    await request(app).post(prefix + '/resumes').set('Authorization', user.token)
      .attach('resume', Buffer.from('bad upload'), { filename: 'fake.pdf', contentType: 'application/pdf' }).expect(415);
    const uploaded = await request(app).post(prefix + '/resumes').set('Authorization', user.token)
      .attach('resume', syntheticResume(), { filename: 'example.pdf', contentType: 'application/pdf' }).expect(201);
    const resume = uploaded.body.data;
    expect(resume.skills).toEqual(expect.arrayContaining(['React', 'TypeScript', 'Node.js']));
    expect(resume).not.toHaveProperty('text');
    await request(app).get(prefix + '/resumes/' + resume.id).set('Authorization', stranger.token).expect(404);
    const result = await request(app).post(prefix + '/role-analyses').set('Authorization', user.token)
      .send({ title: 'React Developer', description: 'React and Docker are required. Preferred qualifications include Kubernetes.', resumeId: resume.id }).expect(201);
    expect(result.body.data.matches).toContain('React');
    expect(result.body.data.gaps).toContain('Docker');
    const created = await request(app).post(prefix + '/interviews').set('Authorization', user.token).set('Idempotency-Key', randomUUID())
      .send({ ...setup, analysisId: result.body.data.id }).expect(201);
    expect(created.body.data.question.text).toContain('interested in the React Developer role');
    expect(created.body.data.question).not.toHaveProperty('criterion');
    const next = await request(app).post(prefix + '/interviews/' + created.body.data.id + '/answers').set('Authorization', user.token)
      .set('Idempotency-Key', randomUUID()).send({
        action: 'skip', questionId: created.body.data.question.id, expectedRevision: created.body.data.revision,
      }).expect(200);
    expect(next.body.data.question.topic).toBe('Docker');
    await request(app).get(prefix + '/interviews/' + created.body.data.id).set('Authorization', stranger.token).expect(404);
  });

  it('persists a follow-up, handles concurrent duplicate writes and verifies report evidence', async () => {
    const user = await register('Concurrency Tester');
    const key = randomUUID();
    const create = () => request(app).post(prefix + '/interviews').set('Authorization', user.token).set('Idempotency-Key', key).send(setup).expect(201);
    const [first, other] = await Promise.all([create(), create()]);
    const initial = first.body.data;
    const path = prefix + '/interviews/' + initial.id;
    expect(other.body.data.id).toBe(initial.id);
    const opened = await request(app).post(path + '/answers').set('Authorization', user.token).set('Idempotency-Key', randomUUID())
      .send({ action: 'skip', questionId: initial.question.id, expectedRevision: initial.revision }).expect(200);
    const session = opened.body.data;
    const body = { action: 'answer', questionId: session.question.id, expectedRevision: session.revision, text: 'I update the cache first.' };
    const submission = randomUUID();
    const answer = (key: string, value: typeof body) => request(app).post(path + '/answers').set('Authorization', user.token)
      .set('Idempotency-Key', key).send(value);
    await answer(randomUUID(), { ...body, text: '' }).expect(400);
    const [a, b] = await Promise.all([answer(submission, body).expect(200), answer(submission, body).expect(200)]);
    expect(a.body.data.turns).toHaveLength(2);
    expect(b.body.data.turns).toHaveLength(2);
    await answer(submission, { ...body, text: 'Different answer' }).expect(409);
    const resumed = await request(app).get(path).set('Authorization', user.token).expect(200);
    expect(resumed.body.data.question.followUp).toBe(true);
    expect(resumed.body.data.turns[1].answer).toBe(body.text);
    await answer(randomUUID(), body).expect(409);
    await request(app).post(path + '/finish').set('Authorization', user.token).expect(200);
    await answer(randomUUID(), body).expect(409);
    const worker = reportWorker(store, ai, 10_000);
    await worker.tick();
    await worker.tick();
    const { body: report } = await request(app).get(path + '/report').set('Authorization', user.token).expect(200);
    expect(report.data.status).toBe('ready');
    expect(report.data.dimensions).toHaveLength(7);
    expect(report.data.answers[0].grades[0].evidence.quote).toBe(body.text);
  });

  it('transcribes bounded audio for the active interview owner when the fallback is configured', async () => {
    const providerFetch = vi.fn<typeof fetch>(async (_url, init) => {
      const data = init?.body as FormData;
      expect(data.get('model')).toBe('gpt-transcribe');
      expect(data.get('prompt')).toContain('MongoDB');
      expect(data.get('prompt')).toContain('Speech Example');
      expect((data.get('file') as File).name).toBe('answer.webm');
      return Response.json({ text: ' I enjoy designing accessible interfaces. ' });
    });
    const withSpeech = createApp({ config: { ...config, OPENAI_API_KEY: 'test-key', AUDIO_TRANSCRIPTION_MODEL: 'gpt-transcribe' },
      store, ai, providerFetch });
    const owner = await register('Speech Example', withSpeech);
    const stranger = await register('Other Speech Example', withSpeech);
    const created = await request(app).post(prefix + '/interviews').set('Authorization', owner.token).set('Idempotency-Key', randomUUID())
      .send(setup).expect(201);
    const endpoint = prefix + '/interviews/' + created.body.data.id + '/transcription';
    const upload = (token: string) => request(withSpeech).post(endpoint).set('Origin', origin).set('Authorization', token)
      .attach('audio', Buffer.from('fixture audio bytes'), { filename: 'fixture.webm', contentType: 'audio/webm' });
    await upload(stranger.token).expect(404);
    expect(providerFetch).not.toHaveBeenCalled();
    await upload(owner.token).expect(200, { data: { text: 'I enjoy designing accessible interfaces.' } });
    expect(providerFetch).toHaveBeenCalledTimes(1);
  });

  it('verifies Gemini recordings verbatim with vocabulary and rejects missing model output', async () => {
    const audio = Buffer.from('fixture audio bytes');
    const providerFetch = vi.fn<typeof fetch>(async (url, init) => {
      expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/interactions');
      expect(init?.headers).toMatchObject({ 'x-goog-api-key': 'test-gemini-key' });
      const data = JSON.parse(String(init?.body));
      expect(data).toMatchObject({ model: 'gemini-3.5-transcribe', store: false,
        input: [{ type: 'audio', data: audio.toString('base64'), mime_type: 'audio/webm' }],
        generation_config: { transcription_config: { language_codes: ['en'], mode: { type: 'verbatim' } } },
      });
      expect(data.generation_config.transcription_config.custom_vocabulary).toEqual(expect.arrayContaining(['MongoDB', 'Gemini Speech Example']));
      return Response.json({ status: 'completed', steps: [
        { type: 'thought', content: [{ type: 'text', text: 'Private reasoning is not a transcript.' }] },
        { type: 'model_output', content: [{ type: 'text', text: ' Um, I use MongoDB indexes. ' }] },
      ] });
    });
    const withSpeech = createApp({ config: { ...config, AUDIO_TRANSCRIPTION_PROVIDER: 'gemini',
      GOOGLE_API_KEY: 'test-gemini-key', AUDIO_TRANSCRIPTION_MODEL: 'gemini-3.5-transcribe' }, store, ai, providerFetch });
    const owner = await register('Gemini Speech Example', withSpeech);
    const created = await request(withSpeech).post(prefix + '/interviews').set('Authorization', owner.token)
      .set('Idempotency-Key', randomUUID()).send(setup).expect(201);
    const endpoint = prefix + '/interviews/' + created.body.data.id + '/transcription';
    const upload = () => request(withSpeech).post(endpoint).set('Origin', origin).set('Authorization', owner.token)
      .attach('audio', audio, { filename: 'fixture.webm', contentType: 'video/webm' });
    await upload().expect(200, { data: { text: 'Um, I use MongoDB indexes.' } });
    providerFetch.mockResolvedValueOnce(Response.json({ status: 'completed', steps: [{ type: 'thought', content: [] }] }));
    await upload().expect(503);
    providerFetch.mockResolvedValueOnce(Response.json({ error: { message: 'Private provider error' } }, { status: 429 }));
    const failed = await upload().expect(503);
    expect(failed.body.error.code).toBe('TRANSCRIPTION_UNAVAILABLE');
    expect(JSON.stringify(failed.body)).not.toContain('Private provider error');
    expect(providerFetch).toHaveBeenCalledTimes(3);
  });

  it('finalizes expired sessions and fails closed on missing provider output', async () => {
    const original = clock;
    const user = await register('Timebox Tester');
    const unavailable = createApp({
      config, store, ai: { ...ai, async plan() { throw new AppError(503, 'PROVIDER_UNAVAILABLE', 'Provider timed out.'); } },
    });
    await request(unavailable).post(prefix + '/interviews').set('Authorization', user.token).set('Idempotency-Key', randomUUID()).send(setup).expect(503);
    const session = (await request(app).post(prefix + '/interviews').set('Authorization', user.token)
      .set('Idempotency-Key', randomUUID()).send(setup).expect(201)).body.data;
    clock += 21 * 60_000;
    try {
      const result = await request(app).get(prefix + '/interviews/' + session.id).set('Authorization', user.token).expect(200);
      expect(result.body.data).toMatchObject({ status: 'completed', score: null, question: null, reportStatus: 'ready' });
    } finally {
      clock = original;
    }
  });
});
