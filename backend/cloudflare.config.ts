import { bindings, defineConfig } from 'cf/config';
import * as entrypoint from './src/worker.js' with { type: 'cf-worker' };

export default defineConfig({
  accountId: '32ee31eda5b52d8dbd8dbb8ea7269626',
  worker: {
    name: 'priya-parotha',
    entrypoint,
    compatibilityDate: '2026-11-12',
    compatibilityFlags: ['nodejs_compat'],
    workersDev: true,
    assets: { runWorkerFirst: ['/api/*'], notFoundHandling: '404-page' },
    env: { ASSETS: bindings.assets(), DATABASE_URL: bindings.secret() },
    observability: {
      enabled: true,
      logs: { enabled: true },
      traces: { enabled: true, headSamplingRate: 0.01 },
    },
  },
});
