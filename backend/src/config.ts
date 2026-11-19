import { z } from 'zod';

const environment = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  APP_ORIGIN: z.url().default('http://localhost:5173').transform(value => new URL(value).origin),
  MONGO_URI: z.string().min(1).optional(),
  JWT_SECRET: z.string().min(32),
  DATA_STORE: z.enum(['mongo', 'memory']).default('mongo'),
  SECURE_COOKIES: z.enum(['true', 'false']).default('false').transform(value => value === 'true'),
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
  AI_PROVIDER: z.enum(['local', 'openai', 'openrouter', 'gemini', 'ollama']).default('local'),
  AI_MODEL: z.string().optional(),
  AI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(45000).default(12000),
  OPENAI_API_KEY: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_BASE_URL: z.url().default('https://openrouter.ai/api/v1'),
  AUDIO_TRANSCRIPTION_MODEL: z.string().trim().optional(),
  GOOGLE_API_KEY: z.string().optional(),
  GOOGLE_OAUTH_CLIENT_ID: z.string().trim().optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().trim().optional(),
  RESEND_API_KEY: z.string().trim().optional(),
  PASSWORD_RESET_FROM: z.string().trim().optional(),
  OLLAMA_URL: z.url().default('http://127.0.0.1:11434'),
}).superRefine((env, ctx) => {
  function requireField(condition: boolean, field: string) {
    if (!condition) ctx.addIssue({ code: 'custom', path: [field], message: 'Required for this configuration' });
  }
  if (env.DATA_STORE === 'mongo') requireField(Boolean(env.MONGO_URI), 'MONGO_URI');
  if (env.AI_PROVIDER !== 'local') requireField(Boolean(env.AI_MODEL?.trim()), 'AI_MODEL');
  if (env.AI_PROVIDER === 'openai') requireField(Boolean(env.OPENAI_API_KEY), 'OPENAI_API_KEY');
  if (env.AI_PROVIDER === 'openrouter') requireField(Boolean(env.OPENROUTER_API_KEY), 'OPENROUTER_API_KEY');
  if (env.AUDIO_TRANSCRIPTION_MODEL) requireField(Boolean(env.OPENAI_API_KEY), 'OPENAI_API_KEY');
  if (env.AI_PROVIDER === 'gemini') requireField(Boolean(env.GOOGLE_API_KEY), 'GOOGLE_API_KEY');
  if (env.NODE_ENV === 'production') {
    requireField(env.DATA_STORE === 'mongo', 'DATA_STORE');
    requireField(env.SECURE_COOKIES && env.APP_ORIGIN.startsWith('https://'), 'SECURE_COOKIES');
  }
});

export type Config = z.output<typeof environment>;

export function loopbackPreviewOrigins(config: Config): string[] {
  const origin = new URL(config.APP_ORIGIN);
  const loopback = ['localhost', '127.0.0.1'];
  if (config.NODE_ENV === 'production' || origin.protocol !== 'http:' ||
    !loopback.includes(origin.hostname) || Number(origin.port || 80) !== config.PORT) return [];
  return loopback.map(host => new URL('http://' + host + ':' + config.PORT).origin);
}

export function loadConfig(env: NodeJS.ProcessEnv): Config {
  const config = environment.safeParse(env);
  if (!config.success) {
    throw new Error('Invalid environment settings: ' + [...new Set(config.error.issues.map(issue => issue.path.join('.')))].join(', '));
  }
  return config.data;
}
