import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { serve } from '@hono/node-server';
import { createIssuerApp } from './app.js';
import { resolveIssuerBindHost } from './local-only.js';

const port = Number(process.env.PORT ?? '3001');
const dataDir = process.env.DATA_DIR ?? join(process.cwd(), 'data');
const host = resolveIssuerBindHost();

mkdirSync(dataDir, { recursive: true });

const { app, state } = createIssuerApp({ dataDir });

serve(
  {
    fetch: app.fetch,
    port,
    hostname: host,
  },
  (info) => {
    state.log('HTTP server listening', {
      host,
      port: info.port,
      publicKeyPem: state.getIssuerPublicKey(),
      groupSize: state.getGroupSize(),
    });
  },
);
