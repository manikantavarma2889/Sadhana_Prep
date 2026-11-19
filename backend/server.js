import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const settings = fileURLToPath(new URL('../.env', import.meta.url));
if (existsSync(settings)) process.loadEnvFile(settings);
await import('./src/index.ts');
