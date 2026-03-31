import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { serve } from '@hono/node-server';
import { createIssuerApp } from './app.js';

const port = Number(process.env.PORT ?? '3001');
const dataDir = process.env.DATA_DIR ?? join(process.cwd(), 'data');

mkdirSync(dataDir, { recursive: true });

const { app, state } = createIssuerApp({ dataDir });

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    state.log('HTTP server listening', {
      port: info.port,
      publicKeyPem: state.getIssuerPublicKey(),
      groupSize: state.getGroupSize(),
    });
  },
);
