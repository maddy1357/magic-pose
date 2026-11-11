'use strict';
const express = require('express');
const config = require('./config');
const catalogRoutes = require('./routes/catalog');
const editRoutes = require('./routes/edit');
const ai = require('./services/ai-editor');

function createApp() {
  const app = express();
  app.disable('x-powered-by');

  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'same-origin');
    // The camera may be used by this origin only; the microphone is never needed.
    res.set('Permissions-Policy', 'camera=(self), microphone=()');
    next();
  });

  app.use('/api', express.json({ limit: '20mb' }));

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', app: config.appName, version: config.version, uptime: Math.round(process.uptime()) });
  });
  app.get('/api/config', (req, res) => res.json({ app: config.appName, version: config.version, ai: ai.status() }));
  app.use('/api', catalogRoutes);
  app.use('/api', editRoutes);
  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

  // Errors from the JSON body parser (bad JSON, too large) and anything unexpected
  // eslint-disable-next-line no-unused-vars
  app.use('/api', (err, req, res, next) => {
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request is too large', code: 'TOO_LARGE' });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON', code: 'BAD_JSON' });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  });

  app.use(express.static(config.frontendDir, { extensions: ['html'] }));
  return app;
}

module.exports = { createApp };
