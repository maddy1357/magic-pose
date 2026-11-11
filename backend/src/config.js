'use strict';
const path = require('path');
const { loadEnvFile } = require('./lib/env');

const ROOT = path.join(__dirname, '..', '..');
if (process.env.NODE_ENV !== 'test') loadEnvFile(path.join(ROOT, '.env'));

const pkg = require(path.join(ROOT, 'package.json'));
const env = process.env;

function aiProvider() {
  const p = (env.AI_PROVIDER || '').trim().toLowerCase();
  if (p) return p;
  return env.OPENAI_API_KEY ? 'openai' : 'none';
}

module.exports = {
  appName: 'Magic Pose',
  version: pkg.version,
  root: ROOT,
  frontendDir: path.join(ROOT, 'frontend'),
  port: Number(env.PORT) || 3000,
  https: {
    key: env.HTTPS_KEY ? path.resolve(ROOT, env.HTTPS_KEY) : '',
    cert: env.HTTPS_CERT ? path.resolve(ROOT, env.HTTPS_CERT) : '',
  },
  ai: {
    provider: aiProvider(),
    openaiKey: env.OPENAI_API_KEY || '',
    openaiBaseUrl: (env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, ''),
    model: env.AI_IMAGE_MODEL || 'gpt-image-1',
    quality: env.AI_IMAGE_QUALITY || 'medium',
    inputFidelity: env.AI_INPUT_FIDELITY === undefined ? 'high' : env.AI_INPUT_FIDELITY,
    timeoutMs: Number(env.AI_TIMEOUT_MS) || 120000,
  },
  // Largest photo accepted by /api/edit (decoded bytes)
  maxImageBytes: 12 * 1024 * 1024,
};
