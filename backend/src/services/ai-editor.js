'use strict';
/*
 * AI photo editing. Providers:
 *   openai - OpenAI Images "edits" endpoint (gpt-image-1 by default)
 *   mock   - returns the photo unchanged after a short delay (for testing)
 *   none   - disabled; the app falls back to its on-device preview
 */
const config = require('../config');

class AiError extends Error {
  constructor(message, status = 502, code = 'AI_ERROR') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const QUALITIES = new Set(['low', 'medium', 'high', 'auto']);

function status() {
  const { provider, model } = config.ai;
  const enabled = provider === 'mock' || (provider === 'openai' && Boolean(config.ai.openaiKey));
  return { enabled, provider: enabled ? provider : 'none', model: enabled && provider === 'openai' ? model : null };
}

/** Pick the output size closest to the photo's shape. */
function sizeFor(width, height) {
  if (!width || !height) return 'auto';
  const r = width / height;
  if (r > 1.2) return '1536x1024';
  if (r < 0.83) return '1024x1536';
  return '1024x1024';
}

async function editWithOpenAI({ buffer, mime, prompt, width, height, quality }) {
  const { openaiKey, openaiBaseUrl, model, inputFidelity, timeoutMs } = config.ai;
  const ext = mime === 'image/jpeg' ? 'jpg' : mime.split('/')[1];
  const form = new FormData();
  form.append('model', model);
  form.append('prompt', prompt);
  form.append('image', new Blob([buffer], { type: mime }), `photo.${ext}`);
  form.append('size', sizeFor(width, height));
  form.append('quality', QUALITIES.has(quality) ? quality : config.ai.quality);
  form.append('n', '1');
  if (inputFidelity) form.append('input_fidelity', inputFidelity);

  let res;
  try {
    res = await fetch(`${openaiBaseUrl}/images/edits`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}` },
      body: form,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if (err.name === 'TimeoutError') throw new AiError('The AI took too long to answer. Please try again.', 504, 'AI_TIMEOUT');
    throw new AiError(`Could not reach the AI service: ${err.message}`, 502, 'AI_UNREACHABLE');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (body && body.error && body.error.message) || `AI service returned HTTP ${res.status}`;
    const code = res.status === 400 && /safety|moderation/i.test(msg) ? 'AI_REJECTED' : 'AI_ERROR';
    throw new AiError(msg, res.status === 429 ? 429 : 502, code);
  }
  const item = body && body.data && body.data[0];
  if (item && item.b64_json) return { mime: 'image/png', base64: item.b64_json };
  if (item && item.url) {
    const img = await fetch(item.url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!img.ok) throw new AiError('Could not download the edited image.');
    const type = img.headers.get('content-type') || 'image/png';
    return { mime: type, base64: Buffer.from(await img.arrayBuffer()).toString('base64') };
  }
  throw new AiError('The AI service returned no image.');
}

/**
 * @param {{buffer: Buffer, mime: string, prompt: string, width?: number, height?: number, quality?: string}} input
 * @returns {Promise<{mime: string, base64: string, provider: string}>}
 */
async function editImage(input) {
  const s = status();
  if (!s.enabled) throw new AiError('AI editing is not configured on the server.', 503, 'AI_NOT_CONFIGURED');
  if (s.provider === 'mock') {
    await new Promise((r) => setTimeout(r, process.env.NODE_ENV === 'test' ? 5 : 800));
    return { mime: input.mime, base64: input.buffer.toString('base64'), provider: 'mock' };
  }
  const out = await editWithOpenAI(input);
  return { ...out, provider: 'openai' };
}

module.exports = { editImage, status, sizeFor, AiError };
