import { bindings, defineConfig } from 'cf/config';
import * as entrypoint from './src/worker.js' with { type: 'cf-worker' };

// Default-deny: every request runs the Worker (dashboard authorization) except these exact public files.
// Never exclude a directory or a dashboard file; a missing entry only costs one Worker request.
const publicAssets = ['css/styles.css', 'js/main.js', 'js/auth.js', 'images/flower.svg', 'images/home-cooked-meal.jpg', 'fonts/manrope-latin.woff2']
  .map(file => `!/assets/${file}`);

export default defineConfig(({ mode }) => ({
  accountId: '32ee31eda5b52d8dbd8dbb8ea7269626',
  worker: {
    name: 'priya-parotha',
    entrypoint,
    compatibilityDate: '2026-11-12',
    compatibilityFlags: ['nodejs_compat'],
    workersDev: true,
    placement: { region: 'aws:us-west-2' },
    assets: { runWorkerFirst: ['/*', ...publicAssets], notFoundHandling: '404-page' },
    env: {
      ASSETS: bindings.assets(),
      DATABASE_URL: bindings.secret(),
      APP_ORIGIN: bindings.text('https://priya-parotha.priya-parotha.workers.dev'),
      GOOGLE_CLIENT_ID: bindings.secret(),
      GOOGLE_CLIENT_SECRET: bindings.secret(),
      AUTH_RATE_LIMIT: bindings.rateLimit({ namespace: '1001', simple: { limit: 10, period: 60 } }),
      LOCAL_PRODUCT_WRITES: bindings.text(mode === 'development' ? 'true' : 'false'),
      PRODUCT_IMAGES: mode === 'development' ? bindings.r2({ name: 'priya-product-images-local' }) : undefined,
    },
    observability: {
      enabled: true,
      redactQueryString: true,
      logs: { enabled: true },
      traces: { enabled: true, headSamplingRate: 0.01 },
    },
  },
}));
