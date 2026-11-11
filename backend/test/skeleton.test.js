'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildFigure, autoView, LENGTHS, JOINTS } = require('../src/lib/skeleton');
const { buildPrompt } = require('../src/services/catalog');
const { sizeFor } = require('../src/services/ai-editor');

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

test('default figure stands upright with natural proportions', () => {
  const { joints } = buildFigure();
  assert.deepEqual(Object.keys(joints).sort(), [...JOINTS].sort());
  assert.ok(joints.head[1] < joints.neck[1] && joints.neck[1] < joints.pelvis[1], 'head above neck above pelvis');
  assert.ok(joints.lShoulder[0] < joints.rShoulder[0], 'l is screen-left');
  assert.ok(Math.abs(dist(joints.lShoulder, joints.lElbow) - LENGTHS.upperArm) < 0.2);
  assert.ok(Math.abs(dist(joints.lHip, joints.lKnee) - LENGTHS.thigh) < 0.2);
  assert.ok(joints.lAnkle[1] > 150 && joints.lAnkle[1] < 158, 'feet near the ground');
});

test('angles follow the screen convention', () => {
  const { joints } = buildFigure({ rArm: [90, 180] }); // upper arm right, forearm up
  assert.ok(joints.rElbow[0] - joints.rShoulder[0] > 23, 'elbow to the right');
  assert.ok(joints.rElbow[1] - joints.rWrist[1] > 21, 'wrist above elbow');
});

test('scaled figures keep their feet on the ground', () => {
  const a = buildFigure({ hip: [30, 88] });
  const b = buildFigure({ hip: [30, 88], scale: 0.7 });
  assert.ok(Math.abs(a.joints.lAnkle[1] - b.joints.lAnkle[1]) < 1.5);
  assert.ok(b.joints.head[1] > a.joints.head[1], 'smaller figure is shorter');
});

test('auto view is portrait 3:4 and contains the figure', () => {
  const f = buildFigure({ lArm: [-90, -90], rArm: [90, 90] });
  const [x, y, w, h] = autoView([f]);
  assert.ok(Math.abs(w / h - 0.75) < 0.01);
  for (const [px, py] of Object.values(f.joints)) {
    assert.ok(px > x && px < x + w && py > y && py < y + h);
  }
  const half = autoView([f], 'half');
  assert.ok(half[1] + half[3] < f.joints.lKnee[1], 'half framing crops the legs');
});

test('prompt keeps identity and mentions the pose', () => {
  const p = buildPrompt('superhero');
  assert.match(p, /preserve their face/);
  assert.match(p, /hands on hips/);
  assert.match(buildPrompt('sunset-couple'), /every person/);
  assert.equal(buildPrompt('missing'), null);
});

test('output size follows the photo shape', () => {
  assert.equal(sizeFor(3000, 4000), '1024x1536');
  assert.equal(sizeFor(1600, 900), '1536x1024');
  assert.equal(sizeFor(1000, 1000), '1024x1024');
  assert.equal(sizeFor(0, 0), 'auto');
});
