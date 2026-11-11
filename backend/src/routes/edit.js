'use strict';
const express = require('express');
const config = require('../config');
const { templateById, buildPrompt } = require('../services/catalog');
const { editImage, AiError } = require('../services/ai-editor');

const router = express.Router();
const DATA_URL = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/;

router.post('/edit', async (req, res) => {
  const { image, templateId, width, height, quality } = req.body || {};
  if (typeof image !== 'string') return res.status(400).json({ error: '"image" must be a data URL', code: 'BAD_IMAGE' });
  const m = image.match(DATA_URL);
  if (!m) return res.status(400).json({ error: 'Image must be a PNG, JPEG or WebP data URL', code: 'BAD_IMAGE' });
  const template = templateById.get(templateId);
  if (!template) return res.status(400).json({ error: 'Unknown template', code: 'BAD_TEMPLATE' });

  const buffer = Buffer.from(m[2], 'base64');
  if (!buffer.length) return res.status(400).json({ error: 'Image is empty', code: 'BAD_IMAGE' });
  if (buffer.length > config.maxImageBytes) return res.status(413).json({ error: 'Image is too large', code: 'TOO_LARGE' });

  const started = Date.now();
  try {
    const out = await editImage({
      buffer,
      mime: m[1],
      prompt: buildPrompt(template.id),
      width: Number(width) || 0,
      height: Number(height) || 0,
      quality: typeof quality === 'string' ? quality : undefined,
    });
    res.json({
      image: `data:${out.mime};base64,${out.base64}`,
      provider: out.provider,
      templateId: template.id,
      ms: Date.now() - started,
    });
  } catch (err) {
    const status = err instanceof AiError ? err.status : 500;
    if (status !== 503) console.error('[edit]', err.message);
    res.status(status).json({ error: err.message, code: err.code || 'AI_ERROR' });
  }
});

module.exports = router;
