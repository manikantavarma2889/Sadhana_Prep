import { waitUntil } from '@vercel/functions';
import { createApp } from '../backend/dist/backend/src/app.js';
import { loadConfig } from '../backend/dist/backend/src/config.js';
import { connectStore, memoryStore } from '../backend/dist/backend/src/db/store.js';
import { buildCoachingAI } from '../backend/dist/backend/src/services/ai/coaching.js';
import { reportWorker } from '../backend/dist/backend/src/services/reports.js';

let runtime;

function getRuntime() {
  runtime ??= (async () => {
    const config = loadConfig(process.env);
    const ai = await buildCoachingAI(config);
    const store = config.DATA_STORE === 'memory' ? memoryStore() : await connectStore(config.MONGO_URI);
    return {
      app: createApp({ config, store, ai }),
      worker: reportWorker(store, ai, config.AI_TIMEOUT_MS + 10_000),
    };
  })().catch(error => {
    runtime = undefined;
    throw error;
  });
  return runtime;
}

export default async function handler(request, response) {
  try {
    const { app, worker } = await getRuntime();
    // Report polling and submissions advance durable MongoDB jobs within
    // Vercel's request lifetime. Each instance reuses its database connection.
    if (request.url?.startsWith('/api/v1/interviews/')) {
      const completed = new Promise(resolve => {
        response.once('finish', resolve);
        response.once('close', resolve);
      });
      waitUntil(completed.then(async () => {
        if (response.locals?.user) await worker.tick();
      }).catch(error => console.error(JSON.stringify({ event: 'report_worker_error', category: error.name }))));
    }
    app(request, response);
  } catch (error) {
    console.error(JSON.stringify({ event: 'runtime_initialization_failed', category: error.name }));
    response.statusCode = 503;
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Sadhana Prep is temporarily unavailable.' } }));
  }
}
