'use strict';
/* API tests that need no internet access. The AI provider is the built-in "mock". */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.AI_PROVIDER = 'mock';
const { createApp } = require('../src/app');

let server;
let base;

before(async () => {
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const call = async (method, url, body) => {
  const res = await fetch(base + url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, json, text, headers: res.headers };
};

// 1x1 transparent PNG
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

test('health and config', async () => {
  const h = await call('GET', '/api/health');
  assert.equal(h.status, 200);
  assert.equal(h.json.status, 'ok');
  const c = await call('GET', '/api/config');
  assert.equal(c.json.ai.enabled, true);
  assert.equal(c.json.ai.provider, 'mock');
});

test('serves the app and allows the camera', async () => {
  const r = await call('GET', '/');
  assert.equal(r.status, 200);
  assert.match(r.text, /Magic Pose/);
  assert.match(r.headers.get('permissions-policy'), /camera=\(self\)/);
});

test('categories cover every pose', async () => {
  const { json } = await call('GET', '/api/categories');
  const poses = (await call('GET', '/api/poses')).json;
  const total = json.categories.reduce((n, c) => n + c.count, 0);
  assert.equal(total, poses.count);
  assert.ok(json.categories.every((c) => c.count > 0), 'no empty categories');
});

test('poses come with drawable joints and a view box', async () => {
  const { json } = await call('GET', '/api/poses');
  assert.ok(json.count >= 30);
  for (const p of json.poses) {
    assert.equal(p.view.length, 4, p.id);
    assert.ok(p.figures.length >= 1, p.id);
    for (const f of p.figures) {
      for (const [x, y] of Object.values(f.joints)) {
        assert.ok(Number.isFinite(x) && Number.isFinite(y), `${p.id} has finite joints`);
      }
    }
  }
  const ids = json.poses.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length, 'pose ids are unique');
});

test('pose filters and lookup', async () => {
  const couple = await call('GET', '/api/poses?category=couple');
  assert.ok(couple.json.count > 0);
  assert.ok(couple.json.poses.every((p) => p.category === 'couple' && p.people === 2));
  const search = await call('GET', '/api/poses?q=yoga');
  assert.ok(search.json.poses.some((p) => p.id === 'warrior-two'));
  assert.equal((await call('GET', '/api/poses/tree-pose')).json.pose.name, 'Tree Pose');
  assert.equal((await call('GET', '/api/poses/nope')).status, 404);
});

test('templates reference real poses and have a look', async () => {
  const { json } = await call('GET', '/api/templates');
  const poses = new Set((await call('GET', '/api/poses')).json.poses.map((p) => p.id));
  assert.ok(json.count >= 10);
  for (const t of json.templates) {
    assert.ok(poses.has(t.poseId), `${t.id} pose exists`);
    assert.ok(t.look && t.look.filter, `${t.id} has a look`);
    assert.equal(t.prompt, undefined, 'prompts stay on the server');
  }
});

test('edit validates input', async () => {
  assert.equal((await call('POST', '/api/edit', {})).status, 400);
  assert.equal((await call('POST', '/api/edit', { image: 'hello', templateId: 'anime' })).json.code, 'BAD_IMAGE');
  assert.equal((await call('POST', '/api/edit', { image: PNG, templateId: 'nope' })).json.code, 'BAD_TEMPLATE');
  assert.equal((await call('POST', '/api/edit', '{bad json')).json.code, 'BAD_JSON');
});

test('edit returns an image from the provider', async () => {
  const r = await call('POST', '/api/edit', { image: PNG, templateId: 'neon-nights', width: 3, height: 4 });
  assert.equal(r.status, 200);
  assert.equal(r.json.provider, 'mock');
  assert.equal(r.json.templateId, 'neon-nights');
  assert.match(r.json.image, /^data:image\/png;base64,/);
});

test('unknown API routes are JSON 404s', async () => {
  const r = await call('GET', '/api/nothing-here');
  assert.equal(r.status, 404);
  assert.equal(r.json.error, 'Not found');
});
