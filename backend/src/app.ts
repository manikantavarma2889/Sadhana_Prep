import { randomUUID } from 'node:crypto';
import cookieParser from 'cookie-parser';
import express, { type ErrorRequestHandler, type Request, type RequestHandler, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import multer from 'multer';
import { z } from 'zod';
import { maxUploadBytes, type User } from '../../shared/contracts.ts';
import { prismaHeroVideo } from '../../shared/hero-media.ts';
import { loopbackPreviewOrigins, type Config } from './config.ts';
import type { Store } from './db/store.ts';
import { AppError, missing } from './errors.ts';
import type { CoachingAI } from './services/ai/coaching.ts';
import { googleAuth, googleCallback, googleCookie, googleFlowLifetime, googleStartInput, passwordResetMail } from './services/account-providers.ts';
import { authService, changePasswordSchema, loginSchema, profileSchema, refreshCookie, refreshLifetime, registerSchema, requestResetSchema, resetPasswordSchema } from './services/auth.ts';
import { answerSchema, cursorSchema, interviewService, keySchema, settingsSchema, trendsSchema } from './services/interviews.ts';
import { learningDetail, learningOutline } from './services/learning/catalog.ts';
import { createTranscriber } from './services/transcription.ts';
import { analysisInput, preparationInput, resumeEdit, resumeService } from './services/resumes.ts';

type Context = { user: User; requestId: string };
type ForgeResponse = Response<unknown, Context>;
const api = '/api/v1';
const cookiePath = api + '/auth';
const idSchema = z.uuid();

function envelope(response: Response, data: unknown, status = 200) {
  response.status(status).json({ data });
}

function body<T>(schema: z.ZodType<T>, request: Request): T { return schema.parse(request.body); }
const id = (request: Request) => idSchema.parse(request.params.id);
const cursor = (request: Request) => cursorSchema.parse(request.query).cursor;
const key = (request: Request) => keySchema.parse(request.header('Idempotency-Key'));

function sendError(response: Response, status: number, code: string, message: string) {
  response.status(status).json({ error: { code, message, requestId: response.locals.requestId } });
}

function limit(windowMs: number, count: number, accountScoped = false) {
  return rateLimit({
    windowMs, limit: count, standardHeaders: 'draft-8', legacyHeaders: false,
    ...(accountScoped ? { keyGenerator: (_request, response) => (response as ForgeResponse).locals.user.id } : {}),
    handler: (_request, response) => sendError(response, 429, 'RATE_LIMIT', 'Too many requests. Try again shortly.'),
  });
}

export function createApp(options: { config: Config; store: Store; ai: CoachingAI; clientDir?: string; now?: () => number; providerFetch?: typeof fetch }) {
  const { config, store, ai, clientDir, now, providerFetch } = options;
  const auth = authService(store, config);
  const transcribe = createTranscriber(config, providerFetch);
  const google = googleAuth(config, providerFetch);
  const sendReset = passwordResetMail(config, providerFetch);
  const previewOrigins = loopbackPreviewOrigins(config);
  const trustedOrigins = new Set([config.APP_ORIGIN, ...previewOrigins]);
  const interview = interviewService(store, ai, now);
  const resumes = resumeService(store, ai);
  const app = express();
  if (config.TRUST_PROXY) app.set('trust proxy', config.TRUST_PROXY);
  app.disable('x-powered-by');
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        upgradeInsecureRequests: config.SECURE_COOKIES ? [] : null,
        mediaSrc: ["'self'", 'blob:', prismaHeroVideo],
      },
    },
    strictTransportSecurity: config.SECURE_COOKIES ? undefined : false,
  }));
  app.use((request, response, next) => {
    const requestId = randomUUID();
    response.locals.requestId = requestId;
    response.setHeader('X-Request-Id', requestId);
    response.setHeader('Permissions-Policy', 'microphone=(self), camera=(self)');
    if (config.NODE_ENV !== 'test') {
      const start = performance.now();
      response.once('finish', () => {
        console.info(JSON.stringify({ event: 'http_request', requestId, method: request.method,
          route: request.route?.path ?? null, status: response.statusCode, ms: Math.round(performance.now() - start) }));
      });
    }
    next();
  });
  app.get('/health/live', (_request, response) => envelope(response, { status: 'ok' }));
  app.get('/health/ready', async (_request, response) => {
    if (!await store.ready()) throw new AppError(503, 'DATABASE_NOT_READY', 'The database is temporarily unavailable.');
    envelope(response, { status: 'ready' });
  });
  app.use(api, (_request, response, next) => {
    response.set('Cache-Control', 'no-store');
    next();
  }, limit(60_000, 180), express.json({ limit: '64kb' }), cookieParser());

  const upload = multer({
    storage: multer.memoryStorage(), limits: { files: 1, fields: 0, parts: 2, fileSize: maxUploadBytes },
    fileFilter: (_request, file, callback) => {
      if (file.mimetype !== 'application/pdf') return callback(new AppError(415, 'INVALID_FILE', 'Choose a PDF resume.'));
      callback(null, true);
    },
  }).single('resume');
  const uploadAnswerAudio = multer({
    storage: multer.memoryStorage(), limits: { files: 1, fields: 0, parts: 2, fileSize: maxUploadBytes },
  }).single('audio');
  const sameOrigin: RequestHandler = (request, _response, next) => {
    if (!trustedOrigins.has(request.get('Origin') ?? '')) {
      next(new AppError(403, 'ORIGIN_DENIED', 'This request must come from the app’s configured origin.'));
    } else next();
  };
  const protect: RequestHandler = async (request, response, next) => {
    const user = await auth.authenticate(request.get('Authorization'));
    if (user.role !== 'candidate') throw new AppError(403, 'FORBIDDEN', 'This action requires a candidate account.');
    response.locals.user = user;
    next();
  };
  const cookieOptions = { httpOnly: true, secure: config.SECURE_COOKIES, sameSite: 'strict' as const, path: cookiePath };
  const googleCookieOptions = { ...cookieOptions, sameSite: 'lax' as const, path: api + '/auth/google' };
  function setRefreshCookie(response: Response, refreshToken: string) {
    response.cookie(refreshCookie, refreshToken, { ...cookieOptions, maxAge: refreshLifetime });
  }
  function setCredential(response: Response, { refreshToken, ...session }: Awaited<ReturnType<typeof auth.login>>, status = 200) {
    setRefreshCookie(response, refreshToken);
    envelope(response, session, status);
  }

  app.post(api + '/auth/register', sameOrigin, limit(15 * 60_000, 8), async (request, response) => {
    setCredential(response, await auth.register(body(registerSchema, request)), 201);
  });
  app.post(api + '/auth/login', sameOrigin, limit(15 * 60_000, 20), async (request, response) => {
    setCredential(response, await auth.login(body(loginSchema, request)));
  });
  app.post(api + '/auth/google/start', sameOrigin, limit(15 * 60_000, 15), (request, response) => {
    const { url, flow } = google.start(body(googleStartInput, request), request.get('Origin')!);
    response.cookie(googleCookie, flow, { ...googleCookieOptions, maxAge: googleFlowLifetime });
    envelope(response, { url });
  });
  app.get(googleCallback, limit(15 * 60_000, 25), async (request, response) => {
    const flow = google.readFlow(request.cookies[googleCookie]);
    response.clearCookie(googleCookie, googleCookieOptions);
    function back(reason: string) {
      const params = new URLSearchParams({ google: reason, next: flow?.returnTo ?? '/dashboard' });
      response.redirect(303, (flow?.mode === 'register' ? '/register' : '/login') + '?' + params.toString());
    }
    if (!flow || !trustedOrigins.has(flow.origin) || request.query.state !== flow.state) return back('retry');
    if (request.query.error === 'access_denied') return back('cancelled');
    const code = request.query.code;
    if (typeof code !== 'string' || !code || code.length > 4096) return back('retry');
    try {
      const session = await auth.googleLogin(await google.identify(code, flow));
      setRefreshCookie(response, session.refreshToken);
      response.redirect(303, flow.returnTo);
    } catch (error) {
      back(error instanceof AppError && error.code === 'GOOGLE_EMAIL_IN_USE' ? 'email-in-use' : 'retry');
    }
  });
  app.post(api + '/auth/password/forgot', sameOrigin, limit(15 * 60_000, 10), (request, response) => {
    const { email } = body(requestResetSchema, request);
    if (!sendReset) throw new AppError(503, 'RESET_NOT_CONFIGURED', 'Email password recovery is not configured for this instance.');
    void auth.requestReset(email, sendReset).catch(() => {
      console.error(JSON.stringify({ event: 'password_reset_delivery_failed', requestId: response.locals.requestId }));
    });
    envelope(response, null, 202);
  });
  app.post(api + '/auth/password/reset', sameOrigin, limit(15 * 60_000, 15), async (request, response) => {
    await auth.resetPassword(body(resetPasswordSchema, request));
    response.clearCookie(refreshCookie, cookieOptions).sendStatus(204);
  });
  app.post(api + '/auth/password/change', sameOrigin, protect, limit(15 * 60_000, 10, true), async (request, response: ForgeResponse) => {
    setCredential(response, await auth.changePassword(response.locals.user, body(changePasswordSchema, request)));
  });
  app.post(api + '/auth/refresh', sameOrigin, limit(60_000, 30), async (request, response) => {
    setCredential(response, await auth.refresh(request.cookies[refreshCookie]));
  });
  app.post(api + '/auth/logout', sameOrigin, async (request, response) => {
    await auth.logout(request.cookies[refreshCookie]);
    response.clearCookie(refreshCookie, cookieOptions).sendStatus(204);
  });
  app.use(api + '/auth', () => missing());
  app.get(api + '/learning/:track', (request, response) => envelope(response, learningOutline(request.params.track)));

  const router = express.Router();
  router.use(protect);
  router.get('/learning/:track/:item', (request, response) => {
    envelope(response, learningDetail(request.params.track, request.params.item));
  });
  router.get('/me', (_request, response: ForgeResponse) => envelope(response, response.locals.user));
  router.patch('/me', async (request, response: ForgeResponse) => {
    envelope(response, await auth.profile(response.locals.user, body(profileSchema, request)));
  });
  router.get('/resumes', async (request, response: ForgeResponse) => {
    envelope(response, await resumes.list(response.locals.user.id, cursor(request)));
  });
  router.post('/resumes', limit(60_000, 5, true), upload, async (request, response: ForgeResponse) => {
    envelope(response, await resumes.upload(response.locals.user.id, request.file), 201);
  });
  router.get('/resumes/:id', async (request, response: ForgeResponse) => {
    envelope(response, await resumes.get(response.locals.user.id, id(request)));
  });
  router.patch('/resumes/:id', async (request, response: ForgeResponse) => {
    envelope(response, await resumes.edit(response.locals.user.id, id(request), body(resumeEdit, request)));
  });
  router.delete('/resumes/:id', async (request, response: ForgeResponse) => {
    await resumes.remove(response.locals.user.id, id(request));
    response.sendStatus(204);
  });
  router.get('/role-analyses', async (request, response: ForgeResponse) => {
    envelope(response, await resumes.listAnalyses(response.locals.user.id, cursor(request)));
  });
  router.post('/role-analyses', limit(60_000, 6, true), async (request, response: ForgeResponse) => {
    envelope(response, await resumes.analyze(response.locals.user.id, body(analysisInput, request)), 201);
  });
  router.post('/interview-preparations', limit(60_000, 6, true), async (request, response: ForgeResponse) => {
    envelope(response, await resumes.prepare(response.locals.user.id, body(preparationInput, request)), 201);
  });
  router.get('/role-analyses/:id', async (request, response: ForgeResponse) => {
    envelope(response, await resumes.analysis(response.locals.user.id, id(request)));
  });
  router.delete('/role-analyses/:id', async (request, response: ForgeResponse) => {
    await resumes.removeAnalysis(response.locals.user.id, id(request));
    response.sendStatus(204);
  });
  router.get('/interviews', async (request, response: ForgeResponse) => {
    envelope(response, await interview.list(response.locals.user.id, cursor(request)));
  });
  router.post('/interviews', limit(60_000, 6, true), async (request, response: ForgeResponse) => {
    envelope(response, await interview.create(response.locals.user.id, body(settingsSchema, request), key(request)), 201);
  });
  router.get('/interviews/:id', async (request, response: ForgeResponse) => {
    envelope(response, await interview.read(response.locals.user.id, id(request)));
  });
  router.get('/speech/options', (_request, response) => envelope(response, {
    transcription: Boolean(transcribe), verifyTranscript: Boolean(transcribe),
  }));
  router.post('/interviews/:id/transcription', sameOrigin, limit(60_000, 5, true), uploadAnswerAudio, async (request, response: ForgeResponse) => {
    if (!transcribe) return missing();
    const session = await interview.read(response.locals.user.id, id(request));
    if (session.status !== 'active') throw new AppError(409, 'INTERVIEW_ENDED', 'This interview has already ended.');
    if (!request.file) throw new AppError(400, 'MISSING_AUDIO', 'Include an audio recording.');
    envelope(response, await transcribe(request.file,
      [response.locals.user.name, session.role, session.question?.text].filter(Boolean).join('. '),
      [response.locals.user.name, session.role, session.question?.topic].filter((term): term is string => Boolean(term))));
  });
  router.post('/interviews/:id/answers', limit(60_000, 25, true), async (request, response: ForgeResponse) => {
    envelope(response, await interview.answer(response.locals.user.id, id(request), body(answerSchema, request), key(request)));
  });
  router.post('/interviews/:id/finish', async (request, response: ForgeResponse) => {
    envelope(response, await interview.finish(response.locals.user.id, id(request)));
  });
  router.post('/interviews/:id/next', limit(60_000, 12, true), async (request, response: ForgeResponse) => {
    envelope(response, await interview.nextQuestion(response.locals.user.id, id(request)));
  });
  router.delete('/interviews/:id', async (request, response: ForgeResponse) => {
    await interview.remove(response.locals.user.id, id(request));
    response.sendStatus(204);
  });
  router.get('/interviews/:id/report', async (request, response: ForgeResponse) => {
    envelope(response, await interview.report(response.locals.user.id, id(request)));
  });
  router.post('/interviews/:id/report/retry', limit(60_000, 5, true), async (request, response: ForgeResponse) => {
    envelope(response, await interview.retry(response.locals.user.id, id(request)), 202);
  });
  router.get('/metrics/interview-trends', async (request, response: ForgeResponse) => {
    envelope(response, await interview.trends(response.locals.user.id, trendsSchema.parse(request.query)));
  });
  app.use(api, router);
  app.use('/api', (_request, _response) => missing());

  if (clientDir) {
    app.get('/speech/vosk-worker.js', (_request, response) => {
      response.setHeader('Content-Security-Policy',
        "default-src 'none'; script-src 'self' 'unsafe-eval'; connect-src 'self' blob:");
      response.sendFile('speech/vosk-worker.js', { root: clientDir });
    });
    app.use(express.static(clientDir));
    app.get('/{*path}', (_request, response) => response.sendFile('index.html', { root: clientDir }));
  }
  const handler: ErrorRequestHandler = (error, _request, response, next) => {
    if (response.headersSent) { next(error); return; }
    if (error instanceof AppError) {
      if (error.retryAfterMs) response.setHeader('Retry-After', String(Math.ceil(error.retryAfterMs / 1000)));
      return sendError(response, error.status, error.code, error.message);
    }
    if (error instanceof z.ZodError) {
      const fields = error.issues.map(issue => issue.path.join('.')).filter(Boolean);
      return sendError(response, 400, 'INVALID_INPUT', fields.length
        ? 'Check these fields: ' + [...new Set(fields)].join(', ') + '.'
        : 'The request has missing or invalid fields.');
    }
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') return sendError(response, 413, 'FILE_TOO_LARGE', 'Uploads must be 4 MB or smaller.');
      return sendError(response, 400, 'INVALID_UPLOAD', 'Upload one PDF resume.');
    }
    if (error.type === 'entity.too.large') return sendError(response, 413, 'BODY_TOO_LARGE', 'Request is too large.');
    if (error.type === 'entity.parse.failed') return sendError(response, 400, 'BAD_JSON', 'The request body is invalid JSON.');
    console.error(JSON.stringify({ event: 'request_error', requestId: response.locals.requestId, category: error.name }));
    return sendError(response, 500, 'INTERNAL_ERROR', 'Something went wrong. Try again shortly.');
  };
  app.use(handler);
  return app;
}
