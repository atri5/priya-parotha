import { cpSync, rmSync } from 'node:fs';
import { basename } from 'node:path';
import { cloudflare } from '@cloudflare/vite-plugin';
import { defineConfig } from 'vite';

const publicDir = new URL('./.cloudflare/public/', import.meta.url);
rmSync(publicDir, { recursive: true, force: true });
cpSync(new URL('../frontend/', import.meta.url), publicDir, {
  recursive: true,
  filter: path => !path.endsWith('.md') && !basename(path).startsWith('.'),
});

export default defineConfig({
  plugins: [cloudflare()],
  publicDir: publicDir.pathname,
});
