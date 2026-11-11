'use strict';
const fs = require('fs');
const http = require('http');
const https = require('https');
const os = require('os');
const config = require('./src/config');
const { createApp } = require('./src/app');
const ai = require('./src/services/ai-editor');

const app = createApp();
const useHttps = Boolean(config.https.key && config.https.cert);
const server = useHttps
  ? https.createServer({ key: fs.readFileSync(config.https.key), cert: fs.readFileSync(config.https.cert) }, app)
  : http.createServer(app);

server.listen(config.port, () => {
  const scheme = useHttps ? 'https' : 'http';
  const s = ai.status();
  console.log(`${config.appName} v${config.version} running at ${scheme}://localhost:${config.port}`);
  for (const nets of Object.values(os.networkInterfaces())) {
    for (const n of nets || []) {
      if (n.family === 'IPv4' && !n.internal) console.log(`  on your network: ${scheme}://${n.address}:${config.port}`);
    }
  }
  if (!useHttps) console.log('  (phones need HTTPS to open the camera - see README "Use it on your phone")');
  console.log(
    s.enabled
      ? `AI templates: ${s.provider}${s.model ? ` (${s.model})` : ''}`
      : 'AI templates: off - set OPENAI_API_KEY in .env to enable (the instant preview still works)'
  );
});

function shutdown(signal) {
  console.log(`${signal} received, shutting down…`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
