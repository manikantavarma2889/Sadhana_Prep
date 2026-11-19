import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.ts';
import { loadConfig, loopbackPreviewOrigins } from './config.ts';
import { connectStore, memoryStore } from './db/store.ts';
import { buildCoachingAI } from './services/ai/coaching.ts';
import { reportWorker } from './services/reports.ts';

async function main() {
  const config = loadConfig(process.env);
  const ai = await buildCoachingAI(config);
  const store = config.DATA_STORE === 'memory' ? memoryStore() : await connectStore(config.MONGO_URI!);
  const isLocalPreview = loopbackPreviewOrigins(config).length > 0;
  const clientRelative = import.meta.url.endsWith('.ts') ? '../../frontend/dist' : '../../../../frontend/dist';
  const clientDir = (isLocalPreview && process.env.SADHANA_PREVIEW_CLIENT_DIR) || fileURLToPath(new URL(clientRelative, import.meta.url));
  const app = createApp({ config, store, ai, clientDir: existsSync(resolve(clientDir, 'index.html')) ? clientDir : undefined });
  const worker = reportWorker(store, ai, config.AI_TIMEOUT_MS + 10_000);
  const timer = setInterval(() => {
    void worker.tick().catch(error => console.error(JSON.stringify({ event: 'worker_error', category: error.name })));
  }, 500).unref();
  function listening(error?: Error) {
    if (error) {
      clearInterval(timer);
      console.error('InterviewForge could not listen on port ' + config.PORT + ': ' + error.message);
      process.exitCode = 1;
      void store.close();
      return;
    }
    console.info('InterviewForge API listening on http://localhost:' + config.PORT + ' (' + config.AI_PROVIDER + ', ' + config.DATA_STORE + ')');
  }
  const server = isLocalPreview
    ? app.listen(config.PORT, '127.0.0.1', listening)
    : app.listen(config.PORT, listening);

  function stop() {
    clearInterval(timer);
    server.close(() => { void store.close().finally(() => process.exit(0)); });
    setTimeout(() => process.exit(1), 10_000).unref();
  }
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
}

void main().catch(error => {
  console.error(error instanceof Error && error.message.startsWith('Invalid environment settings:')
    ? error.message : 'InterviewForge could not start. Check MongoDB and provider settings.');
  process.exitCode = 1;
});
