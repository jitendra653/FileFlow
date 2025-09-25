import { log } from 'console';
import express from 'express';
import path from 'path';
import logger from '../utils/logger';

const router = express.Router();

router.get('/openapi.json', (req, res) => {
  const openApiPath = path.join(process.cwd(), 'public', 'docs', 'openapi.json');
  logger.debug(`Attempting to serve OpenAPI spec from: ${openApiPath}`);
  res.sendFile(openApiPath, (err) => {
    if (err) {
      logger.error('Error serving OpenAPI spec:', { error: err.message });
      res.status(500).json({ error: 'Could not load API documentation' });
    } else {
      logger.info('Successfully served OpenAPI spec');
    }
  });
});

router.get('/', (req, res) => {

  logger.info('Serving API docs');
  res.send(`<!doctype html>
  <html>
  <head>
    <title>API Docs</title>
    <meta charset="utf-8" />
  </head>
  <body>
    <redoc spec-url="/docs/openapi.json"></redoc>
    <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
  </body>
  </html>`);
});

export default router;
