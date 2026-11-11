'use strict';
/*
 * A tiny forward-kinematics model of a person facing the camera.
 *
 * Poses are written as bone angles instead of raw coordinates, so every pose
 * keeps natural body proportions. Angles are in degrees on the screen:
 *     0 = straight down, 90 = towards screen-right, -90 = towards screen-left,
 *   180 = straight up.
 * "l" and "r" always mean the SCREEN left and right (for a person facing the
 * camera, "l" is their right hand).
 *
 * Coordinates live in a 100 x 160 box: the default figure stands with its hip
 * centre at (50, 88) and its feet near y = 155.
 */

const LENGTHS = Object.freeze({
  torso: 42, // pelvis -> neck
  neck: 14, // neck -> head centre
  headR: 9,
  shoulder: 13, // half shoulder width
  hip: 8, // half hip width
  upperArm: 24,
  foreArm: 22,
  thigh: 34,
  shin: 33,
});

const GROUND_Y = 156;

const DEFAULTS = Object.freeze({
  hip: [50, 88],
  torso: 180,
  head: 180,
  lArm: [-10, -5],
  rArm: [10, 5],
  lLeg: [-4, -2],
  rLeg: [4, 2],
  scale: 1,
});

/** Joint names, in a stable order. */
const JOINTS = Object.freeze([
  'head', 'neck', 'pelvis',
  'lShoulder', 'lElbow', 'lWrist',
  'rShoulder', 'rElbow', 'rWrist',
  'lHip', 'lKnee', 'lAnkle',
  'rHip', 'rKnee', 'rAnkle',
]);

/** Bones as [from, to] joint pairs (used for drawing and pose matching). */
const BONES = Object.freeze([
  ['pelvis', 'neck'],
  ['neck', 'head'],
  ['lShoulder', 'rShoulder'],
  ['lHip', 'rHip'],
  ['lShoulder', 'lElbow'], ['lElbow', 'lWrist'],
  ['rShoulder', 'rElbow'], ['rElbow', 'rWrist'],
  ['lHip', 'lKnee'], ['lKnee', 'lAnkle'],
  ['rHip', 'rKnee'], ['rKnee', 'rAnkle'],
]);

const rad = (deg) => (deg * Math.PI) / 180;
const dir = (deg) => [Math.sin(rad(deg)), Math.cos(rad(deg))];
const step = (p, d, len) => [p[0] + d[0] * len, p[1] + d[1] * len];
const round = (n) => Math.round(n * 10) / 10;

/** Two-segment limb: [angle1, angle2, lengthFactor1 = 1, lengthFactor2 = 1]. */
function limb(start, spec, len1, len2) {
  const [a1, a2, f1 = 1, f2 = 1] = spec;
  const mid = step(start, dir(a1), len1 * f1);
  const end = step(mid, dir(a2), len2 * f2);
  return [mid, end];
}

/**
 * Turn a figure spec into joint coordinates.
 * @param {object} spec Partial figure spec (see DEFAULTS).
 * @returns {{joints: Record<string, number[]>, headR: number}}
 */
function buildFigure(spec = {}) {
  const s = { ...DEFAULTS, ...spec };
  const pelvis = [...s.hip];
  const up = dir(s.torso);
  const left = [up[1], -up[0]]; // perpendicular, towards screen-left when upright
  const neck = step(pelvis, up, LENGTHS.torso);
  const head = step(neck, dir(s.head), LENGTHS.neck);

  const lShoulder = step(neck, left, LENGTHS.shoulder);
  const rShoulder = step(neck, left, -LENGTHS.shoulder);
  const lHip = step(pelvis, left, LENGTHS.hip);
  const rHip = step(pelvis, left, -LENGTHS.hip);

  const [lElbow, lWrist] = limb(lShoulder, s.lArm, LENGTHS.upperArm, LENGTHS.foreArm);
  const [rElbow, rWrist] = limb(rShoulder, s.rArm, LENGTHS.upperArm, LENGTHS.foreArm);
  const [lKnee, lAnkle] = limb(lHip, s.lLeg, LENGTHS.thigh, LENGTHS.shin);
  const [rKnee, rAnkle] = limb(rHip, s.rLeg, LENGTHS.thigh, LENGTHS.shin);

  const raw = {
    head, neck, pelvis,
    lShoulder, lElbow, lWrist,
    rShoulder, rElbow, rWrist,
    lHip, lKnee, lAnkle,
    rHip, rKnee, rAnkle,
  };

  // Scale the figure about the point on the ground under its hips, so smaller
  // people in group shots still stand on the same floor.
  const k = s.scale;
  const ax = s.hip[0];
  const joints = {};
  for (const name of JOINTS) {
    const [x, y] = raw[name];
    joints[name] = [round(ax + (x - ax) * k), round(GROUND_Y + (y - GROUND_Y) * k)];
  }
  return { joints, headR: round(LENGTHS.headR * k), scale: k };
}

/**
 * Work out a viewBox [x, y, w, h] that frames the figures with some padding,
 * at a 3:4 (portrait) aspect ratio. "half" framing crops just below the hips
 * and keeps the frame around the body, so a selfie arm can leave the picture.
 */
function autoView(figures, framing = 'full') {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const grow = (x, y, r) => {
    minX = Math.min(minX, x - r); maxX = Math.max(maxX, x + r);
    minY = Math.min(minY, y - r); maxY = Math.max(maxY, y + r);
  };
  for (const f of figures) {
    const j = f.joints;
    if (framing === 'half') {
      grow(j.head[0], j.head[1], f.headR);
      for (const n of ['lShoulder', 'rShoulder']) grow(j[n][0], j[n][1], 12 * f.scale);
      for (const n of ['lWrist', 'rWrist']) minY = Math.min(minY, j[n][1] - 4 * f.scale);
      maxY = Math.max(maxY, j.pelvis[1] + 4 * f.scale);
    } else {
      for (const n of JOINTS) grow(j[n][0], j[n][1], n === 'head' ? f.headR : 5 * f.scale);
    }
  }
  const pad = framing === 'half' ? 5 : 8;
  let x = minX - pad, y = minY - pad, w = maxX - minX + pad * 2, h = maxY - minY + pad * 2;
  const aspect = 3 / 4;
  if (w / h < aspect) { const nw = h * aspect; x -= (nw - w) / 2; w = nw; }
  else { const nh = w / aspect; y -= (nh - h) / 2; h = nh; }
  return [round(x), round(y), round(w), round(h)];
}

module.exports = { LENGTHS, DEFAULTS, JOINTS, BONES, buildFigure, autoView };
