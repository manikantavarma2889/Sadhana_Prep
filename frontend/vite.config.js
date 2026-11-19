import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

// Serve Vosk's bundled worker as its own asset so its WebAssembly runtime
// can use a worker-specific policy without enabling script evaluation in pages.
const voskSource = readFileSync(createRequire(import.meta.url).resolve('vosk-browser'), 'utf8')
const workerFactory = /var WorkerFactory = createBase64WorkerFactory\((['"])([A-Za-z0-9+/=]+)\1[^;]*\);/
const embeddedWorker = voskSource.match(workerFactory)
if (!embeddedWorker) throw new Error('The pinned Vosk worker could not be found.')
const decodedWorker = Buffer.from(embeddedWorker[2], 'base64').toString('utf8')
const finalResult = /(retrieveFinalResult\(recognizerId\)[\s\S]*?event: "result",)/
if (!finalResult.test(decodedWorker)) throw new Error('The pinned Vosk final-result handler could not be found.')
// Distinguish the explicit flush from results still arriving for earlier audio.
const captionWorker = decodedWorker.replace(finalResult, '$1\n                    final: true,')
const workerPolicy = "default-src 'none'; script-src 'self' 'unsafe-eval'; connect-src 'self' blob:"
// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), {
    name: 'local-caption-worker',
    enforce: 'pre',
    transform(code, id) {
      if (id.includes('vosk-browser')) {
        return code.replace(workerFactory,
          'var WorkerFactory = function(options) { return new Worker("/speech/vosk-worker.js", options); };')
      }
    },
    configureServer(server) {
      server.middlewares.use('/speech/vosk-worker.js', (_request, response) => {
        response.setHeader('Content-Type', 'text/javascript')
        response.setHeader('Content-Security-Policy', workerPolicy)
        response.end(captionWorker)
      })
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'speech/vosk-worker.js', source: captionWorker })
      for (const name of ['NOTICE.txt', 'Apache-2.0.txt']) {
        this.emitFile({ type: 'asset', fileName: 'speech/' + name,
          source: readFileSync(new URL('./src/assets/speech/' + name, import.meta.url), 'utf8') })
      }
    },
  }],
  publicDir: false,
  server: {
    host: 'localhost',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:3000',
      '/health': 'http://localhost:3000',
    },
  },
})
