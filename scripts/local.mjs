import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';

const envFile = fileURLToPath(new URL('../.env', import.meta.url));
if (process.env.FORGE_E2E !== '1' && existsSync(envFile)) loadEnvFile(envFile);

const port = process.env.FORGE_LOCAL_PORT ?? '3002';
process.env.PORT = port;
process.env.APP_ORIGIN = 'http://localhost:' + port;
process.env.DATA_STORE = process.env.FORGE_E2E === '1' ? 'memory' : process.env.DATA_STORE || 'memory';
process.env.AI_PROVIDER = process.env.FORGE_E2E === '1' ? 'local' : process.env.AI_PROVIDER || 'local';
process.env.JWT_SECRET = process.env.JWT_SECRET || randomBytes(48).toString('hex');
process.env.SECURE_COOKIES = 'false';
process.env.NODE_ENV = process.env.FORGE_E2E === '1' ? 'test' : 'development';
if (process.argv.includes('--preview-assets')) {
  process.env.SADHANA_PREVIEW_CLIENT_DIR = fileURLToPath(new URL('../.runtime/preview-3002/', import.meta.url));
}
process.chdir(fileURLToPath(new URL('../backend/', import.meta.url)));
await import('../backend/dist/backend/src/index.js');
